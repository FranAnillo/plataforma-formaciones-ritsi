# Plataforma Formativa RITSI

Aplicación para consultar, crear, asignar y seguir la formación interna de RITSI. Incluye un catálogo histórico sincronizado con el registro oficial, gestión de Vocalías, composición protegida de Junta Directiva y una interfaz adaptable a móvil, tableta y escritorio.

## Perfiles

- Administración: usuarios, universidades, Junta Directiva, Vocalías, catálogo e importación.
- Junta Directiva: publicación de formaciones y gestión de las Vocalías que tenga asignadas.
- Persona formadora: creación de contenidos sujetos a revisión.
- Universidad: consulta y asignación dentro de su ámbito.
- Representante y colaboración externa: acceso a formaciones publicadas y seguimiento personal.

## Junta Directiva y Vocalías

La Junta se valida como un conjunto de cinco cargos obligatorios: Presidencia, Vicepresidencia de Política Universitaria, Tesorería, Secretaría y Vicepresidencia de Comunicación. Admite hasta dos miembros adicionales. Cada Vocalía se vincula a una persona activa de Junta y puede incorporar a cualquier conjunto de miembros activos.

## Universidades

La administración puede sincronizar el listado publicado en `https://ritsi.org/socios/`. Se conservan universidad, siglas, comunidad autónoma, zona, centro y enlaces. Una universidad activa se considera socia de RITSI; una universidad inactiva se considera no socia y no está disponible para nuevos registros.

## Catálogo oficial

El backend importa la hoja configurada mediante `FORMATIONS_SHEET_ID`. La sincronización conserva código, curso, fecha, audiencia, duración, asistencia, valoración, etiquetas, personas formadoras y las URLs de los recursos. Los recursos reciben identificadores estables y una reimportación conserva publicación, visibilidad, categorías, cuestionarios y autoría locales.

## Aprendizaje y sesiones

- “Mi formación” reúne inscripciones asignadas, avance y finalización.
- Administración, Junta y Universidad pueden asignar dentro de su ámbito y revocar sus asignaciones.
- El progreso se valida en servidor y nunca entrega las respuestas correctas de un cuestionario.
- Los cuestionarios se corrigen en servidor y conservan un historial de intentos; la finalización exige recursos consultados y evaluaciones superadas.
- Las sesiones síncronas tienen audiencia, zona horaria y ventana de acceso. El enlace de reunión se cifra y solo se resuelve mediante `POST /api/sessions/{id}/join` durante la ventana autorizada.
- Las personas gestoras pueden registrar asistencia y consultar informes agregados limitados a su ámbito.
- Administración y Junta pueden componer itinerarios ordenados; administración, Junta y Universidad pueden asignarlos dentro de su ámbito.
- Al completar todos los requisitos se emite un certificado con código público de verificación.

## Notificaciones e integraciones

- Un outbox persistente en MongoDB desacopla asignaciones y sesiones del envío. El servicio `worker` reclama eventos con bloqueo, reintentos, backoff y claves de idempotencia.
- El centro de notificaciones reúne asignaciones, formaciones iniciadas o finalizadas y avisos de sesiones para mañana, para hoy, reprogramadas o canceladas. Cada persona puede filtrar, marcar como leído y configurar por separado asignaciones, progreso, sesiones y Telegram.
- Telegram se vincula mediante un token aleatorio, de un solo uso y diez minutos de validez. El webhook exige el secreto configurado y usa los identificadores numéricos de Telegram; nunca el nombre de usuario como identidad.
- Cada persona puede crear o rotar un feed ICS privado. Tanto ICS como Google Calendar institucional incluyen un enlace de acceso a la plataforma, nunca la URL de la videollamada.
- Google Calendar es opcional: si faltan credenciales, las sesiones continúan funcionando y la sincronización queda desactivada.
- La recuperación de cuenta usa enlaces de un solo uso con 30 minutos de validez y revoca todas las sesiones al cambiar la contraseña.

La aplicación web incluye manifiesto PWA y un service worker que solo conserva el shell y recursos versionados; las rutas `/api` y los datos autenticados no se almacenan en caché.

Cada persona puede exportar sus datos desde `GET /api/privacy/export`. Las solicitudes de supresión requieren volver a introducir la contraseña, desactivan accesos y quedan pendientes de revisión para respetar obligaciones de conservación. Los intentos de inicio de sesión se limitan en MongoDB de forma compartida entre réplicas.

## Puesta en marcha con Docker

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000/api`
- Salud: `http://localhost:8000/api/health`

Variables principales:

- `MONGO_URL` y `DB_NAME`
- `VITE_BACKEND_URL` (se incorpora al compilar la imagen del frontend)
- `PUBLIC_APP_URL` y `PUBLIC_API_URL` (enlaces de plataforma y feeds ICS)
- `CORS_ORIGINS`
- `COOKIE_SECURE` (`true` en producción con HTTPS)
- `MEETING_URL_ENCRYPTION_KEY` (obligatoria para almacenar enlaces de sesión)
- `DEFAULT_TIMEZONE` y `DEFAULT_JOIN_WINDOW_MINUTES`
- `FORMATIONS_SHEET_ID`
- `AUTO_IMPORT_FORMATIONS` (`true` para cargar el catálogo si está vacío; desactivado por defecto)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` y `TELEGRAM_WEBHOOK_SECRET` (opcionales)
- `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN` (opcionales)

MongoDB queda publicado únicamente en `127.0.0.1`. El frontend se compila como archivos estáticos y se sirve con Nginx; cambiar `VITE_BACKEND_URL` requiere reconstruir su imagen. En producción usa orígenes exactos en `CORS_ORIGINS`, HTTPS y `COOKIE_SECURE=true`. Las mutaciones autenticadas por cookie rechazan orígenes de navegador no autorizados.

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
python -m pytest -q
cd frontend && npm run build
```

Prueba el despliegue completo en un proyecto Docker aislado (puertos `13000`, `18000` y `27018`), incluyendo reinicios y persistencia:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deployment-smoke.ps1
```

El script crea datos efímeros, comprueba los servicios y elimina contenedores, red y volumen al terminar. Usa `-KeepRunning` únicamente para diagnóstico local.

Consulta [la revisión global y criterios de aceptación](docs/global-review-and-acceptance.md), [el último resultado del test de despliegue](docs/deployment-test-result.md) y [Operación y migraciones](docs/phase-1-operations.md) antes de cambiar el esquema o desplegar en producción.
