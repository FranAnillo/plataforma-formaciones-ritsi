#!/usr/bin/env python3
"""Crea o actualiza la cuenta de administración inicial."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")
from server import UserType, password_hash  # noqa: E402


async def main():
    if len(sys.argv) != 4:
        print('Uso: python scripts/create_admin.py correo@ejemplo.org "Nombre" "contraseña-segura"')
        raise SystemExit(1)
    email, name, password = sys.argv[1].lower(), sys.argv[2], sys.argv[3]
    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.")
        raise SystemExit(1)
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    payload = {"email": email, "name": name, "password_hash": password_hash(password),
        "user_type": UserType.ADMIN.value, "board_position": None, "vocalia_ids": [],
        "university_id": None, "is_active": True}
    result = await database.users.update_one({"email": email},
        {"$set": payload, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}}, upsert=True)
    print("Cuenta de administración preparada." if result.acknowledged else "No se pudo preparar la cuenta.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
