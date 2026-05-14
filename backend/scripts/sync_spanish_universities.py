#!/usr/bin/env python3
"""
Sincroniza universidades españolas desde la sección de universidades del RUCT.

El script es idempotente: actualiza universidades existentes por código RUCT,
por nombre normalizado o por alias conocido, e inserta las que falten.
"""
import argparse
import html
import os
import re
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from pymongo import MongoClient


RUCT_UNIVERSITIES_URL = "https://www.educacion.gob.es/ruct/consultauniversidades?actual=universidades"
EXCLUDED_NAME_PREFIXES = (
    "Centros ",
    "Otros Centros",
)
ALIASES_BY_RUCT_CODE = {
    "018": [
        "Universidad de Valencia",
        "Universidad de València",
    ],
}


class UniversityOptionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_university_select = False
        self.in_option = False
        self.current_value = ""
        self.current_text = []
        self.options = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "select" and attrs.get("name") == "codigoUniversidad":
            self.in_university_select = True
            return

        if self.in_university_select and tag == "option":
            self.in_option = True
            self.current_value = attrs.get("value", "")
            self.current_text = []

    def handle_endtag(self, tag):
        if tag == "select" and self.in_university_select:
            self.in_university_select = False
            return

        if tag == "option" and self.in_option:
            name = clean_display_name("".join(self.current_text))
            self.options.append({"ruct_code": self.current_value.strip(), "name": name})
            self.in_option = False
            self.current_value = ""
            self.current_text = []

    def handle_data(self, data):
        if self.in_option:
            self.current_text.append(data)


def clean_display_name(value):
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def normalize_key(value):
    value = clean_display_name(value)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-zA-Z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip().lower()


def fetch_ruct_universities(url=RUCT_UNIVERSITIES_URL):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        raw_html = response.read().decode("iso-8859-15")

    parser = UniversityOptionParser()
    parser.feed(raw_html)

    universities = []
    for option in parser.options:
        code = option["ruct_code"]
        name = option["name"]
        if not code.isdigit() or not name:
            continue
        if name.startswith(EXCLUDED_NAME_PREFIXES):
            continue
        universities.append({"ruct_code": code, "name": name})

    return universities


def find_existing_university(university, existing_by_ruct_code, existing_by_name):
    ruct_code = university["ruct_code"]
    name_key = normalize_key(university["name"])

    if ruct_code in existing_by_ruct_code:
        return existing_by_ruct_code[ruct_code]

    if name_key in existing_by_name:
        return existing_by_name[name_key]

    for alias in ALIASES_BY_RUCT_CODE.get(ruct_code, []):
        alias_key = normalize_key(alias)
        if alias_key in existing_by_name:
            return existing_by_name[alias_key]

    return None


def sync_universities(db, dry_run=False):
    now = datetime.now(timezone.utc).isoformat()
    ruct_universities = fetch_ruct_universities()
    existing = list(db.universities.find({}))

    existing_by_ruct_code = {
        doc["ruct_code"]: doc
        for doc in existing
        if doc.get("ruct_code")
    }
    existing_by_name = {}
    for doc in existing:
        existing_by_name.setdefault(normalize_key(doc.get("name", "")), doc)

    inserted = []
    updated = []
    matched_existing_ids = set()

    for university in ruct_universities:
        existing_doc = find_existing_university(university, existing_by_ruct_code, existing_by_name)
        set_data = {
            "name": university["name"],
            "is_active": True,
            "ruct_code": university["ruct_code"],
            "ruct_source_url": RUCT_UNIVERSITIES_URL,
            "ruct_synced_at": now,
        }

        if existing_doc:
            matched_existing_ids.add(existing_doc["_id"])
            if "zone" not in existing_doc:
                set_data["zone"] = None
            if "created_at" not in existing_doc:
                set_data["created_at"] = now

            if not dry_run:
                db.universities.update_one({"_id": existing_doc["_id"]}, {"$set": set_data})
            updated.append(university)
            continue

        new_doc = {
            "id": str(uuid.uuid4()),
            "name": university["name"],
            "is_active": True,
            "zone": None,
            "created_at": now,
            "ruct_code": university["ruct_code"],
            "ruct_source_url": RUCT_UNIVERSITIES_URL,
            "ruct_synced_at": now,
        }
        if not dry_run:
            db.universities.insert_one(new_doc)
        inserted.append(university)

    unmatched_existing = [
        doc for doc in existing
        if doc["_id"] not in matched_existing_ids and not doc.get("ruct_code")
    ]

    return {
        "source_url": RUCT_UNIVERSITIES_URL,
        "source_count": len(ruct_universities),
        "inserted": inserted,
        "updated": updated,
        "unmatched_existing": unmatched_existing,
    }


def main():
    parser = argparse.ArgumentParser(description="Sincroniza universidades españolas desde RUCT.")
    parser.add_argument("--dry-run", action="store_true", help="Muestra el resultado sin escribir en MongoDB.")
    args = parser.parse_args()

    backend_path = Path(__file__).resolve().parent.parent
    project_root = backend_path.parent
    load_dotenv(project_root / ".env")
    load_dotenv(backend_path / ".env", override=False)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("Error: configura MONGO_URL y DB_NAME en .env", file=sys.stderr)
        sys.exit(1)

    client = MongoClient(mongo_url)
    db = client[db_name]
    result = sync_universities(db, dry_run=args.dry_run)
    total = db.universities.count_documents({}) if not args.dry_run else "sin cambios"

    mode = "DRY RUN" if args.dry_run else "SINCRONIZADO"
    print(f"{mode}: {result['source_count']} universidades detectadas en RUCT")
    print(f"Fuente: {result['source_url']}")
    print(f"Insertadas: {len(result['inserted'])}")
    print(f"Actualizadas: {len(result['updated'])}")
    if result["unmatched_existing"]:
        print(f"Universidades locales no emparejadas con RUCT: {len(result['unmatched_existing'])}")
        for doc in result["unmatched_existing"]:
            print(f"  - {doc.get('name')} ({doc.get('id')})")
    print(f"Total en la colección: {total}")


if __name__ == "__main__":
    main()
