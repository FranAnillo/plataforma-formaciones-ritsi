#!/usr/bin/env python3
"""
Script para crear un usuario con un rol específico en la base de datos.

Este script permite crear usuarios con diferentes roles en la plataforma:
- representante: Usuario que accede a contenidos formativos
- universidad: Usuario que gestiona representantes de su universidad
- junta_directiva: Usuario que asigna contenidos a todos los representantes
- escuela_formacion: Usuario que crea y gestiona contenidos
- admin: Usuario con acceso completo al sistema

Uso: 
    python3 create_user.py <email> <nombre_completo> <rol> [university_id]

Ejemplos:
    python3 create_user.py rep@uni.es "Ana López" representante uni-uuid-123
    python3 create_user.py junta@ritsi.es "Pedro García" junta_directiva
    python3 create_user.py escuela@ritsi.es "María Ruiz" escuela_formacion
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
    print("  Script de Creación de Usuario")
    print("="*70)
    print("\nUSO:")
    print('  python3 create_user.py <email> "<nombre>" <rol> [university_id]')
    print("\nROLES DISPONIBLES:")
    for member in UserType:
        print(f"  - {member.value}")
    print("\nEJEMPLOS:")
    print('  python3 create_user.py rep@uni.es "Ana López" representante uni-123')
    print('  python3 create_user.py junta@ritsi.es "Pedro García" junta_directiva')
    print('  python3 create_user.py escuela@ritsi.es "María Ruiz" escuela_formacion')
    print("\nNOTAS:")
    print("  - El university_id es OBLIGATORIO para el rol 'universidad'")
    print("  - El university_id es OPCIONAL para 'representante'")
    print("  - Otros roles no requieren university_id")
    print("="*70 + "\n")

async def main():
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print("\n❌ Error: Número de argumentos incorrecto.\n")
        print_usage()
        sys.exit(1)

    user_email = sys.argv[1]
    user_name = sys.argv[2]
    user_type_str = sys.argv[3]
    university_id = sys.argv[4] if len(sys.argv) == 5 else None

    # Validar el rol
    try:
        user_type = UserType(user_type_str)
    except ValueError:
        print(f"\n❌ Error: Rol '{user_type_str}' no es válido.\n")
        print_usage()
        sys.exit(1)

    print(f"\n🔄 Intentando crear usuario:")
    print(f"   Email: {user_email}")
    print(f"   Nombre: {user_name}")
    print(f"   Rol: {user_type.value}")
    if university_id:
        print(f"   Universidad ID: {university_id}")
    print()

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
        existing_user = await db.users.find_one({"email": user_email})
        if existing_user:
            print(f"❌ Error: Ya existe un usuario con el email {user_email}.")
            print(f"   Tipo de usuario existente: {existing_user.get('user_type', 'desconocido')}")
            client.close()
            return

        # Si el rol es 'universidad', el ID de la universidad es obligatorio
        if user_type == UserType.UNIVERSIDAD:
            if not university_id:
                print("❌ Error: Para el rol 'universidad', debes proporcionar un 'id_universidad'.")
                print("   Usa: python3 create_user.py <email> <nombre> universidad <university_id>")
                client.close()
                sys.exit(1)
            # Verificar que la universidad existe
            university = await db.universities.find_one({"id": university_id})
            if not university:
                print(f"❌ Error: No se encontró ninguna universidad con el ID '{university_id}'.")
                print("\n   Universidades disponibles:")
                async for uni in db.universities.find():
                    print(f"   - {uni['name']} (ID: {uni['id']})")
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
        print(f"✅ ¡Éxito! Usuario creado correctamente:")
        print(f"   Nombre: {user_name}")
        print(f"   Email: {user_email}")
        print(f"   ID: {new_user['id']}")
        print(f"   Rol: {user_type.value}")
        if university_id:
            print(f"   Universidad ID: {university_id}")
        print()
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error inesperado: {str(e)}")
        print("   Verifica la configuración de MongoDB y las variables de entorno.\n")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())