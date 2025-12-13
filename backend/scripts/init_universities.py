#!/usr/bin/env python3
"""
Script para inicializar universidades de ejemplo en la base de datos
"""
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

from pymongo import MongoClient
from datetime import datetime, timezone
import uuid

# Load env
from dotenv import load_dotenv
load_dotenv(backend_path / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

client = MongoClient(mongo_url)
db = client[db_name]

# Universities to create
universities = [
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad Complutense de Madrid",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Barcelona",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Sevilla",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Valencia",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad Autónoma de Madrid",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

print("Inicializando universidades...")

# Check if universities already exist
existing_count = db.universities.count_documents({})
if existing_count > 0:
    print(f"Ya existen {existing_count} universidades en la base de datos.")
    response = input("¿Deseas eliminar todas y crear nuevas? (s/n): ")
    if response.lower() == 's':
        db.universities.delete_many({})
        print("Universidades eliminadas.")
    else:
        print("Operación cancelada.")
        sys.exit(0)

# Insert universities
result = db.universities.insert_many(universities)
print(f"✓ {len(result.inserted_ids)} universidades creadas exitosamente:")

for uni in universities:
    print(f"  - {uni['name']}")
    print(f"    ID: {uni['id']}")

print("\n¡Listo! Las universidades están disponibles para registro.")
