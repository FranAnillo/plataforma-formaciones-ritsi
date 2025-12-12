#!/usr/bin/env python3
"""
delete_user.py
Script para borrar usuarios de la base de datos MongoDB.

Uso:
  python delete_user.py --email "correo@ejemplo.com"
  python delete_user.py --id "uuid-del-usuario"
  python delete_user.py --role administrador
  python delete_user.py --all --force   -> Borra TODOS los usuarios (requiere --force)

Requisitos:
  - python-dotenv
  - motor (motor.motor_asyncio)
  - archivo backend/.env con MONGO_URL y DB_NAME
"""

import os
import argparse
from pathlib import Path
import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Cargar variables del backend
backend_path = Path(__file__).parent.parent / "backend"
load_dotenv(backend_path / ".env")


async def delete_users(mongo_url, db_name, email=None, user_id=None, role=None, delete_all=False):
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    query = {}

    if email:
        query["email"] = email

    if user_id:
        query["id"] = user_id

    if role:
        query["user_type"] = role

    if delete_all:
        query = {}  # elimina todo

    # Confirmación visual
    print(f"→ Eliminando usuarios con filtro: {query}")

    result = await db.users.delete_many(query)

    print(f"✓ Usuarios eliminados: {result.deleted_count}")

    client.close()


def main():
    parser = argparse.ArgumentParser(description="Eliminar usuarios en MongoDB")

    parser.add_argument("--email", "-e", help="Eliminar usuario por email exacto")
    parser.add_argument("--id", "-i", help="Eliminar usuario por ID (UUID)")
    parser.add_argument("--role", "-r", help="Eliminar todos los usuarios con ese rol (user_type)")
    parser.add_argument("--all", action="store_true", help="Eliminar TODOS los usuarios")
    parser.add_argument("--force", action="store_true", help="Obligatorio para usar --all")

    args = parser.parse_args()

    # Si se usa --all, debe confirmarse con --force
    if args.all and not args.force:
        print("⚠️  Debes usar también --force para borrar TODOS los usuarios.")
        print("Ejemplo: python delete_user.py --all --force")
        return

    if not (args.email or args.id or args.role or args.all):
        print("⚠️  Debes indicar un criterio de borrado.")
        print("Ejemplos:")
        print("  python delete_user.py --email user@mail.com")
        print("  python delete_user.py --id 1234-uuid")
        print("  python delete_user.py --role administrador")
        print("  python delete_user.py --all --force")
        return

    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")

    if not mongo_url or not db_name:
        print("❌ Error: No se encontró MONGO_URL o DB_NAME en backend/.env")
        return

    asyncio.run(
        delete_users(
            mongo_url,
            db_name,
            email=args.email,
            user_id=args.id,
            role=args.role,
            delete_all=args.all
        )
    )


if __name__ == "__main__":
    main()
