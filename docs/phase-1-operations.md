# Operación y migraciones de Fase 1

## Configuración inicial

1. Copia `.env.example` como `.env` y modifica los valores locales.
2. No confirmes `.env`, credenciales OAuth, tokens de bots, copias de seguridad ni URLs privadas de reuniones.
3. Para producción configura HTTPS, `COOKIE_SECURE=true`, una lista exacta en `CORS_ORIGINS`, una `MEETING_URL_ENCRYPTION_KEY` aleatoria de al menos 32 caracteres y un `VITE_BACKEND_URL` público. `CORS_ORIGINS` también alimenta la protección de origen para mutaciones autenticadas por cookie. `VITE_BACKEND_URL` se incorpora durante `docker compose build frontend`.
4. Las importaciones automáticas están desactivadas por defecto para que un reinicio no dependa de servicios externos. Ejecútalas de forma explícita o habilítalas de manera consciente.

Validación y arranque:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 backend frontend
```

Los servicios tienen healthchecks. El healthcheck del backend ejecuta un `ping` real a MongoDB; `frontend` y `worker` esperan a que `backend` esté sano y este espera a MongoDB. Los puertos publicados se enlazan a `127.0.0.1`; en producción un proxy TLS debe ser el único punto de entrada público.

## Worker, Telegram y Calendar

El outbox utiliza entrega al menos una vez. Las claves `dedupe_key` impiden crear dos notificaciones o dos eventos de calendario ante una reentrega. MongoDB se ejecuta aquí como instancia única, por lo que la escritura del agregado y la del outbox no forman una transacción multi-documento; monitoriza y reconcilia asignaciones/sesiones sin evento antes de cada despliegue. Si se requiere atomicidad estricta, despliega MongoDB como replica set y encapsula ambas escrituras en una transacción.

Para Telegram, registra `POST {PUBLIC_API_URL}/api/webhooks/telegram` en Bot API y pasa exactamente `TELEGRAM_WEBHOOK_SECRET` como `secret_token`. Nunca registres el token del bot ni el contenido del mensaje en logs. Para desactivar el canal, retira las variables y reinicia `backend` y `worker`; el centro de notificaciones seguirá funcionando.

La sincronización institucional de Google Calendar usa OAuth de servidor con refresh token. Concede únicamente el calendario configurado, rota el secreto si se expone y revisa `calendar_event_links.status`/`last_error`. El feed ICS se considera un secreto portador: una rotación invalida inmediatamente el enlace anterior.

Comandos operativos habituales:

```bash
docker compose logs --tail=200 worker
docker compose restart worker
```

## Comprobaciones antes de desplegar

```bash
python -m pytest -q
docker compose build backend worker frontend
```

Comprueba además:

- Ningún `.env` está versionado y los secretos históricos se han rotado.
- El backup más reciente se puede restaurar en un entorno aislado.
- Las pruebas de autorización incluyen una denegación por cada permiso concedido.
- No hay eventos `failed` sin investigar en `outbox_events` ni entregas `abandoned` recientes.
- Los logs no contienen contraseñas, hashes, cookies, tokens o enlaces de reunión.
- La compilación frontend usa el origen API correcto.

## Procedimiento de migración

Mientras el núcleo use MongoDB, cada cambio de datos debe implementarse como una migración versionada, reejecutable y observable. La migración inicial de seguridad, inscripciones y sesiones usa un marcador en `schema_migrations` y solo se confirma después de completar el backfill.

1. Documenta precondición, documentos afectados, índice nuevo y estrategia de vuelta atrás.
2. Crea una copia consistente y prueba su restauración fuera de producción.
3. Ensaya la migración con una copia anonimizada y registra recuentos antes/después.
4. Despliega primero código compatible tanto con el esquema anterior como con el nuevo.
5. Ejecuta el backfill por lotes con checkpoint; repetirlo no debe duplicar datos.
6. Crea o valida índices después del backfill cuando su construcción pueda bloquear.
7. Reconciliación: usuarios, contenidos, inscripciones, progreso y sesiones deben conservar el mismo total e identificadores estables.
8. Retira la compatibilidad antigua en un despliegue posterior.

Para una futura migración a PostgreSQL, añade una fase de doble lectura comparada o exportación/importación verificable, pero evita mantener escritura dual indefinida. La transición debe hacerse por agregado y con un único almacén como fuente de verdad en cada momento.

## Recuperación y rollback

- Código: conserva la imagen anterior y revierte el despliegue; nunca uses un reset destructivo sobre el repositorio de trabajo.
- Datos: si el cambio es aditivo, desactiva la funcionalidad con configuración y conserva los campos nuevos. Si es destructivo, restaura la copia verificada en una instancia aislada, valida recuentos y después promuévela.
- Integraciones: pausa workers y recordatorios antes de recuperar datos para evitar mensajes o eventos duplicados. Al reanudarlos, las claves de idempotencia deben absorber reentregas.
- Clave de reuniones: no sustituyas `MEETING_URL_ENCRYPTION_KEY` directamente; primero descifra y vuelve a cifrar los enlaces con una migración controlada. Un cambio sin reenvoltura vuelve ilegibles las sesiones existentes.
- Incidente de secretos: revoca primero en el proveedor, rota la aplicación después y audita los accesos ocurridos durante la ventana de exposición.

La eliminación de volúmenes (`docker compose down -v`) borra los datos locales de MongoDB y no forma parte de ningún procedimiento normal de parada o actualización.
