#!/usr/bin/env python3
"""
Script para inicializar universidades de ejemplo en la base de datos.

Este script crea un conjunto de universidades predefinidas que pueden
ser usadas durante el desarrollo o inicialización del sistema.

Uso: 
    python3 init_universities.py

Nota:
    Si ya existen universidades en la base de datos, se pedirá confirmación
    antes de eliminarlas y crear las nuevas.
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

try:
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("\n❌ Error: Variables de entorno MONGO_URL y/o DB_NAME no configuradas.")
        print("   Verifica que el archivo .env existe en el directorio backend/\n")
        sys.exit(1)
    
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    # Test connection
    client.server_info()
    
except Exception as e:
    print(f"\n❌ Error al conectar con MongoDB: {str(e)}")
    print("   Verifica que MongoDB está corriendo y que las credenciales son correctas.\n")
    sys.exit(1)

# Universities to create
universities = [
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad Complutense de Madrid",
        "description": "Universidad pública de Madrid",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Barcelona",
        "description": "Universidad pública de Barcelona",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Sevilla",
        "description": "Universidad pública de Sevilla",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad de Valencia",
        "description": "Universidad pública de Valencia",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Universidad Autónoma de Madrid",
        "description": "Universidad pública autónoma de Madrid",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

print("\n" + "="*70)
print("  Inicializando Universidades de Ejemplo")
print("="*70 + "\n")

# Check if universities already exist
existing_count = db.universities.count_documents({})
if existing_count > 0:
    print(f"⚠️  Ya existen {existing_count} universidades en la base de datos.")
    print("\n   Universidades actuales:")
    for uni in db.universities.find():
        print(f"   - {uni['name']} (ID: {uni['id']})")
    
    response = input("\n¿Deseas eliminar todas y crear nuevas? (s/n): ")
    if response.lower() == 's':
        db.universities.delete_many({})
        print("✓ Universidades eliminadas.\n")
    else:
        print("❌ Operación cancelada.")
        sys.exit(0)

try:
    # Insert universities
    result = db.universities.insert_many(universities)
    print(f"✅ ¡Éxito! {len(result.inserted_ids)} universidades creadas:\n")

    for uni in universities:
        print(f"  📚 {uni['name']}")
        print(f"     ID: {uni['id']}")
        print(f"     Descripción: {uni['description']}\n")

    print("="*70)
    print("  ¡Listo! Las universidades están disponibles para registro.")
    print("="*70 + "\n")
    
except Exception as e:
    print(f"\n❌ Error al crear universidades: {str(e)}\n")
    sys.exit(1)
