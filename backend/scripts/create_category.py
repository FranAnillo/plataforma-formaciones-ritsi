#!/usr/bin/env python3
"""
Script para crear una categoría de contenido.
Uso: python3 create_category.py "Nombre de la Categoría"
"""
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

backend_path = Path(__file__).resolve().parent.parent
project_root = backend_path.parent
load_dotenv(project_root / ".env")
load_dotenv(backend_path / ".env", override=False)


def main():
    if len(sys.argv) != 2:
        print('Uso: python3 create_category.py "Nombre de la Categoría"')
        sys.exit(1)

    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    if not mongo_url or not db_name:
        print("Error: No se han encontrado MONGO_URL o DB_NAME en el entorno ni en .env")
        sys.exit(1)

    category_name = sys.argv[1].strip()
    if not category_name:
        print("Error: El nombre de la categoría no puede estar vacío.")
        sys.exit(1)

    client = MongoClient(mongo_url)
    db = client[db_name]

    existing = db.categories.find_one({"name": {"$regex": f"^{re.escape(category_name)}$", "$options": "i"}})
    if existing:
        print(f"Error: La categoría '{category_name}' ya existe.")
        client.close()
        return

    category = {
        "id": str(uuid.uuid4()),
        "name": category_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.categories.insert_one(category)
    print(f"✓ Categoría '{category_name}' creada con ID: {category['id']}")
    client.close()


if __name__ == "__main__":
    main()
