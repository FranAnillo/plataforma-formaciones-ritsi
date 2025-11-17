#!/usr/bin/env python3
"""
Script para crear un usuario con un rol específico en la base de datos.
Uso: python3 create_user.py <email> <nombre_completo> <rol> [university_id]
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
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print("Error: Número de argumentos incorrecto.")
        print("Uso: python3 create_user.py <email> \"<nombre_completo>\" <rol> [id_universidad]")
        print(f"Roles disponibles: {', '.join([member.value for member in UserType])}")
        sys.exit(1)

    user_email = sys.argv[1]
    user_name = sys.argv[2]
    user_type_str = sys.argv[3]
    university_id = sys.argv[4] if len(sys.argv) == 5 else None

    # Validar el rol
    try:
        user_type = UserType(user_type_str)
    except ValueError:
        print(f"Error: Rol '{user_type_str}' no es válido.")
        print(f"Roles disponibles: {', '.join([member.value for member in UserType])}")
        sys.exit(1)

    print(f"Intentando crear usuario con email: {user_email}, nombre: {user_name} y rol: {user_type.value}")

    # Conexión a la base de datos
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Verificar si el usuario ya existe
    existing_user = await db.users.find_one({"email": user_email})
    if existing_user:
        print(f"❌ Error: Ya existe un usuario con el email {user_email}.")
        client.close()
        return

    # Si el rol es 'universidad' o 'representante', el ID de la universidad es obligatorio
    if user_type in [UserType.UNIVERSIDAD, UserType.REPRESENTANTE]:
        if not university_id:
            print(f"Error: Para el rol '{user_type.value}', debes proporcionar un 'id_universidad'.")
            sys.exit(1)
        # Opcional: Verificar que la universidad existe
        university = await db.universities.find_one({"id": university_id})
        if not university:
            print(f"❌ Error: No se encontró ninguna universidad con el ID '{university_id}'.")
            client.close()
            return

    # Crear el nuevo usuario
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_email,
        "name": user_name,
        "user_type": user_type.value,
        "university_id": university_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    result = await db.users.insert_one(new_user)
    print(f"✓ Usuario '{user_name}' creado exitosamente con el rol '{user_type.value}'.")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())