#!/usr/bin/env python3
"""
Script para crear una categoría en la base de datos.
Uso: python3 create_category.py "<nombre_de_la_categoria>"
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

async def main():
    if len(sys.argv) != 2:
        print("Error: Debes proporcionar el nombre de la categoría.")
        print("Uso: python3 create_category.py \"<nombre_de_la_categoria>\"")
        sys.exit(1)

    category_name = sys.argv[1]
    print(f"Intentando crear categoría: {category_name}")

    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Usar el endpoint de la API para crear la categoría (simulado)
    # Esto es una simplificación. En un caso real, podrías llamar a la API
    # o replicar su lógica de validación.
    from server import create_category, CategoryCreate, User, UserType
    # Simular un usuario admin para la dependencia
    admin_user = User(id="script_user", email="script@local.host", name="Script", user_type=UserType.ADMIN)
    await create_category(CategoryCreate(name=category_name), admin_user)
    print(f"✓ Categoría '{category_name}' creada o ya existente.")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
