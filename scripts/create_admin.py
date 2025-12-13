#!/usr/bin/env python3
"""
Script para crear un usuario administrador en la base de datos.

Este script crea un usuario con privilegios de administrador en la plataforma.
El administrador tiene acceso completo a todas las funcionalidades del sistema.

Uso: 
    python3 create_admin.py <email> <nombre_completo>

Ejemplo:
    python3 create_admin.py admin@ritsi.es "Juan Pérez Admin"
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

def print_usage():
    """Imprime las instrucciones de uso del script"""
    print("\n" + "="*70)
    print("  Script de Creación de Usuario Administrador")
    print("="*70)
    print("\nUSO:")
    print('  python3 create_admin.py <email> "<nombre_completo>"')
    print("\nEJEMPLOS:")
    print('  python3 create_admin.py admin@ritsi.es "Juan Pérez Admin"')
    print('  python3 create_admin.py super@university.es "María García"')
    print("\nNOTA:")
    print("  - El email debe ser único en el sistema")
    print("  - El nombre debe estar entre comillas si contiene espacios")
    print("  - El usuario tendrá privilegios completos de administrador")
    print("="*70 + "\n")

async def main():
    if len(sys.argv) != 3:
        print("\n❌ Error: Número incorrecto de argumentos.\n")
        print_usage()
        sys.exit(1)

    admin_email = sys.argv[1]
    admin_name = sys.argv[2]

    print(f"\n🔄 Intentando crear administrador:")
    print(f"   Email: {admin_email}")
    print(f"   Nombre: {admin_name}\n")

    try:
        # Conexión a la base de datos
        mongo_url = os.environ.get('MONGO_URL')
        db_name = os.environ.get('DB_NAME')
        
        if not mongo_url or not db_name:
            print("❌ Error: Variables de entorno MONGO_URL y/o DB_NAME no configuradas.")
            print("   Verifica que el archivo .env existe en el directorio backend/")
            sys.exit(1)
        
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]

        # Verificar conexión a la base de datos
        await db.command('ping')
        
        # Verificar si el usuario ya existe
        existing_user = await db.users.find_one({"email": admin_email})
        if existing_user:
            print(f"❌ Error: Ya existe un usuario con el email {admin_email}.")
            print(f"   Tipo de usuario existente: {existing_user.get('user_type', 'desconocido')}")
            client.close()
            return

        # Crear el nuevo usuario administrador
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": admin_name,
            "user_type": UserType.ADMIN.value,
            "university_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        result = await db.users.insert_one(admin_user)
        print(f"✅ ¡Éxito! Administrador creado correctamente:")
        print(f"   Nombre: {admin_name}")
        print(f"   Email: {admin_email}")
        print(f"   ID: {admin_user['id']}")
        print(f"   Tipo: {UserType.ADMIN.value}\n")
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error inesperado: {str(e)}")
        print("   Verifica la configuración de MongoDB y las variables de entorno.\n")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())