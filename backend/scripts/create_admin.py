#!/usr/bin/env python3
"""
Script para crear un usuario administrador en la base de datos.
Uso: python3 create_admin.py <email> <nombre_completo>
"""
import sys
import os
from pathlib import Path
import uuid
from datetime import datetime, timezone

# Añadir el directorio del backend al path para poder importar sus módulos
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

# Cargar variables de entorno desde el .env del backend
from dotenv import load_dotenv
load_dotenv(backend_path / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Importar el enum UserType desde server.py para asegurar consistencia
from server import UserType

async def main():
    if len(sys.argv) != 3:
        print("Error: Debes proporcionar el email y el nombre del administrador.")
        print("Uso: python3 create_admin.py <email> \"<nombre_completo>\"")
        sys.exit(1)

    admin_email = sys.argv[1]
    admin_name = sys.argv[2]

    print(f"Intentando crear administrador con email: {admin_email} y nombre: {admin_name}")

    # Conexión a la base de datos
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Verificar si el usuario ya existe
    existing_user = await db.users.find_one({"email": admin_email})
    if existing_user:
        print(f"❌ Error: Ya existe un usuario con el email {admin_email}.")
        client.close()
        return

    # Crear el nuevo usuario administrador
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": admin_email,
        "name": admin_name,
        "user_type": UserType.ADMIN.value, # Usamos el valor del enum
        "university_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = await db.users.insert_one(admin_user)
    print(f"✓ Administrador '{admin_name}' creado exitosamente con ID: {result.inserted_id}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())