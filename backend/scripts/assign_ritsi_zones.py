#!/usr/bin/env python3
"""
Asigna zonas RITSI a las universidades cargadas desde RUCT.

La asignación usa la administración educativa responsable del RUCT y la
distribución territorial publicada por RITSI.
"""
import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from pymongo import MongoClient

from sync_spanish_universities import (
    RUCT_UNIVERSITIES_URL,
    UniversityOptionParser,
    clean_display_name,
)


RITSI_ZONE_SOURCE_URL = "https://ritsi.org/socios/"

CCAA_TO_ZONE = {
    "01": "I",    # Andalucía
    "08": "I",    # Castilla-La Mancha
    "14": "I",    # Región de Murcia
    "13": "II",   # Comunidad de Madrid
    "03": "III",  # Principado de Asturias
    "06": "III",  # Cantabria
    "11": "III",  # Galicia
    "12": "III",  # La Rioja
    "15": "III",  # Navarra
    "17": "III",  # País Vasco
    "02": "IV",   # Aragón
    "07": "IV",   # Castilla y León
    "10": "IV",   # Extremadura
    "05": "IV",   # Canarias
    "09": "V",    # Cataluña
    "04": "V",    # Illes Balears
    "16": "V",    # Comunidad Valenciana
}

CCAA_NAMES = {
    "01": "Andalucía",
    "02": "Aragón",
    "03": "Asturias",
    "04": "Illes Balears",
    "05": "Canarias",
    "06": "Cantabria",
    "07": "Castilla y León",
    "08": "Castilla-La Mancha",
    "09": "Cataluña",
    "10": "Extremadura",
    "11": "Galicia",
    "12": "La Rioja",
    "13": "Madrid",
    "14": "Murcia",
    "15": "Navarra",
    "16": "Comunidad Valenciana",
    "17": "País Vasco",
}

# Algunas universidades figuran en RUCT bajo administración educativa estatal.
# Se asignan por sede territorial principal para que todas tengan zona RITSI.
STATE_UNIVERSITY_OVERRIDES = {
    "028": {"zone": "II", "community": "Madrid"},
    "030": {"zone": "III", "community": "País Vasco"},
    "031": {"zone": "III", "community": "Navarra"},
    "032": {"zone": "IV", "community": "Castilla y León"},
    "033": {"zone": "II", "community": "Madrid"},
    "071": {"zone": "II", "community": "Madrid"},
}


def fetch_universities_for_ccaa(ccaa_code):
    url = f"{RUCT_UNIVERSITIES_URL}&{urlencode({'cccaa': ccaa_code})}"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        raw_html = response.read().decode("iso-8859-15")

    parser = UniversityOptionParser()
    parser.feed(raw_html)

    universities = []
    for option in parser.options:
        ruct_code = option["ruct_code"]
        name = clean_display_name(option["name"])
        if not ruct_code.isdigit() or not name:
            continue
        if name.startswith(("Centros ", "Otros Centros")):
            continue
        universities.append({"ruct_code": ruct_code, "name": name})
    return universities


def build_zone_assignments():
    assignments = {}
    for ccaa_code, zone in CCAA_TO_ZONE.items():
        community = CCAA_NAMES[ccaa_code]
        for university in fetch_universities_for_ccaa(ccaa_code):
            assignments[university["ruct_code"]] = {
                "zone": zone,
                "community": community,
                "name": university["name"],
            }

    for ruct_code, override in STATE_UNIVERSITY_OVERRIDES.items():
        assignments[ruct_code] = {
            "zone": override["zone"],
            "community": override["community"],
            "name": None,
        }

    return assignments


def assign_ritsi_zones(db, dry_run=False):
    now = datetime.now(timezone.utc).isoformat()
    assignments = build_zone_assignments()
    universities = list(db.universities.find({}))

    updated = []
    unchanged = []
    missing_assignment = []

    for university in universities:
        ruct_code = university.get("ruct_code")
        assignment = assignments.get(ruct_code)

        if not assignment:
            missing_assignment.append(university)
            continue

        update_data = {
            "zone": assignment["zone"],
            "ritsi_zone_source_url": RITSI_ZONE_SOURCE_URL,
            "ritsi_zone_synced_at": now,
            "ruct_autonomous_community": assignment["community"],
        }

        if university.get("zone") == assignment["zone"] and university.get("ruct_autonomous_community") == assignment["community"]:
            unchanged.append(university)
            continue

        if not dry_run:
            db.universities.update_one({"_id": university["_id"]}, {"$set": update_data})
        updated.append({
            "id": university.get("id"),
            "name": university.get("name"),
            "ruct_code": ruct_code,
            "zone": assignment["zone"],
            "community": assignment["community"],
        })

    return {
        "updated": updated,
        "unchanged": unchanged,
        "missing_assignment": missing_assignment,
        "assignments_count": len(assignments),
    }


def main():
    parser = argparse.ArgumentParser(description="Asigna zonas RITSI a universidades RUCT.")
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
    result = assign_ritsi_zones(db, dry_run=args.dry_run)

    mode = "DRY RUN" if args.dry_run else "ZONAS ASIGNADAS"
    print(f"{mode}: {result['assignments_count']} códigos RUCT con zona calculada")
    print(f"Actualizadas: {len(result['updated'])}")
    print(f"Sin cambios: {len(result['unchanged'])}")
    print(f"Sin asignación: {len(result['missing_assignment'])}")

    if result["missing_assignment"]:
        for university in result["missing_assignment"]:
            print(f"  - {university.get('ruct_code')}: {university.get('name')}")


if __name__ == "__main__":
    main()
