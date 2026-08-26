# Resultado del test de despliegue

Última ejecución: 26 de agosto de 2026.

## Resultado

El despliegue aislado `ritsi-deploytest` terminó correctamente. Se construyeron las imágenes de backend, worker y frontend, se inició MongoDB y los cuatro servicios alcanzaron estado saludable. Tras la prueba se eliminaron los contenedores, la red y el volumen efímero.

Controles superados:

- salud de contenedores, API y MongoDB;
- frontend servido por Nginx y cabeceras de seguridad;
- manifiesto y service worker PWA;
- creación de administrador efímero, autenticación y cookie de sesión;
- alta de universidad y persona, contenido con cuestionario y asignación;
- procesamiento asíncrono y notificación de asignación;
- notificaciones idempotentes al iniciar y finalizar una formación;
- convocatoria de sesión y aviso de sesión para el mismo día;
- enlace de Meet cifrado y ausente de las respuestas ordinarias;
- acceso autorizado mediante redirección temporal `303`;
- feed ICS sin URL privada y con acceso a través de la plataforma;
- persistencia de autenticación y datos tras reiniciar backend y worker;
- outbox drenado sin eventos fallidos.

Validaciones complementarias de la misma revisión:

- backend: `61 passed` con `pytest` dentro de la imagen Python 3.12 de producción;
- frontend: compilación Vite de producción correcta (`1640` módulos);
- el runner es reproducible con `scripts/deployment-smoke.ps1` y se ejecuta en CI.

## Incidencias detectadas y resueltas por el test

La prueba end-to-end permitió corregir dos defectos que las pruebas unitarias simuladas no exponían: la interpretación de fechas BSON UTC sin `tzinfo` en backend/worker y la falta de propagación explícita de `CORS_ORIGINS` en Docker Compose. Ambos casos cuentan ahora con cobertura de regresión o comprobación de despliegue.

Las llamadas reales a Telegram y Google Calendar no se realizan en este smoke test: los proveedores quedan deliberadamente desactivados para evitar efectos externos. Se validan el outbox, las preferencias, estados de entrega, payloads sin enlace privado y el comportamiento degradado sin credenciales; la certificación contra cuentas reales corresponde al checklist previo a producción.
