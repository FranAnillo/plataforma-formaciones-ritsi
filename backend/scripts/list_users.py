#!/usr/bin/env python3
"""
list_users.py
Lista usuarios en la base de datos MongoDB.

Uso:
  python list_users.py                -> lista todos los usuarios (limit 100)
  python list_users.py --role admin   -> filtra por rol
  python list_users.py --email foo@x  -> filtra por email
  python list_users.py --limit 50     -> limita el número de resultados

Requisitos:
  - Tener instalado python-dotenv y motor (motor.motor_asyncio)
  - Tener el archivo backend/.env con MONGO_URL y DB_NAME
"""

import os
import argparse
from pathlib import Path
import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Añadir el backend al path (coincide con create_user.py)
backend_path = Path(__file__).resolve().parent.parent
project_root = backend_path.parent
# Cargar variables locales sin pisar las que ya vengan del entorno
load_dotenv(project_root / ".env")
load_dotenv(backend_path / ".env", override=False)

async def list_users(mongo_url, db_name, role=None, email=None, limit=100):
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    query = {}
    if role:
        # suponer que user_type es el campo que almacena el rol (como en create_user.py)
        query["user_type"] = role
    if email:
        query["email"] = email

    cursor = db.users.find(query).limit(limit)
    count = 0
    async for doc in cursor:
        count += 1
        # Imprimir campos principales de forma legible
        print(f"--- Usuario {count} ---")
        print(f"ID          : {doc.get('id')}")
        print(f"Email       : {doc.get('email')}")
        print(f"Nombre      : {doc.get('name')}")
        print(f"Rol         : {doc.get('user_type')}")
        if doc.get("university_id"):
            print(f"University  : {doc.get('university_id')}")
        print(f"Creado      : {doc.get('created_at')}")
        # Imprimir otros campos si quieres
        extras = {k: v for k, v in doc.items() if k not in ("_id","id","email","name","user_type","university_id","created_at")}
        if extras:
            print("Otros campos:")
            for k, v in extras.items():
                print(f"  {k}: {v}")
        print("")

    if count == 0:
        print("No se encontraron usuarios con esos filtros.")
    client.close()

def main():
    parser = argparse.ArgumentParser(description="Listar usuarios en la base de datos")
    parser.add_argument("--role", "-r", help="Filtrar por rol (user_type). Ej: administrador, universidad, formador")
    parser.add_argument("--email", "-e", help="Filtrar por email exacto")
    parser.add_argument("--limit", "-l", type=int, default=100, help="Límite de resultados (por defecto 100)")
    args = parser.parse_args()

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("Error: No se han encontrado MONGO_URL o DB_NAME en el entorno ni en .env")
        return

    asyncio.run(list_users(mongo_url, db_name, role=args.role, email=args.email, limit=args.limit))

if __name__ == "__main__":
    main()
