# Plataforma Formativa RITSI

Aplicación para consultar, crear, asignar y seguir la formación interna de RITSI. Incluye un catálogo histórico sincronizado con el registro oficial, gestión de Vocalías, composición protegida de Junta Directiva y una interfaz adaptable a móvil, tableta y escritorio.

## Perfiles

- Administración: usuarios, universidades, Junta Directiva, Vocalías, catálogo e importación.
- Junta Directiva: publicación de formaciones y gestión de las Vocalías que tenga asignadas.
- Persona formadora: creación de contenidos sujetos a revisión.
- Universidad: consulta y asignación dentro de su ámbito.
- Representante y colaboración externa: acceso a formaciones publicadas y seguimiento personal.

## Junta Directiva y Vocalías

La Junta se configura de forma atómica con cinco cargos obligatorios: Presidencia, Vicepresidencia de Política Universitaria, Tesorería, Secretaría y Vicepresidencia de Comunicación. Admite hasta dos miembros adicionales. Cada Vocalía se vincula a una persona activa de Junta y puede incorporar a cualquier conjunto de miembros activos.

## Universidades

La administración puede sincronizar el listado publicado en `https://ritsi.org/socios/`. Se conservan universidad, siglas, comunidad autónoma, zona, centro y enlaces. Una universidad activa se considera socia de RITSI; una universidad inactiva se considera no socia y no está disponible para nuevos registros.

## Catálogo oficial

El backend importa la hoja configurada mediante `FORMATIONS_SHEET_ID`. La sincronización conserva código, curso, fecha, audiencia, duración, asistencia, valoración, etiquetas, personas formadoras y las URLs de los recursos. El proceso es idempotente: actualiza registros existentes y evita duplicados.

## Puesta en marcha con Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000/api`
- Salud: `http://localhost:8000/api/health`

Variables principales:

- `MONGO_URL` y `DB_NAME`
- `CORS_ORIGINS`
- `COOKIE_SECURE` (`true` en producción con HTTPS)
- `FORMATIONS_SHEET_ID`
- `AUTO_IMPORT_FORMATIONS` (`true` para cargar el catálogo si está vacío)

## Desarrollo local

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

Prepara la primera cuenta de administración:

```bash
cd backend
python scripts/create_admin.py admin@ejemplo.org "Nombre" "contraseña-segura"
```

```bash
cd frontend
npm ci
npm start
```

## Pruebas

```bash
pytest
cd frontend && npm run build
```
