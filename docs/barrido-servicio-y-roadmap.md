# Barrido del servicio y propuesta de incrementos funcionales

## Resumen ejecutivo

La plataforma ya tiene una base funcional sólida: autenticación Google/dev, roles diferenciados, gestión de contenidos, asignaciones, progreso y cuestionarios. El mayor riesgo de evolución no está en una feature aislada, sino en la concentración de demasiada lógica en pocos archivos grandes (`backend/server.py`, `AdminDashboard.jsx`, `EscuelaFormacionDashboard.jsx`, `ContentViewer.jsx`).

Este barrido prioriza dos líneas: primero, hacer que el frontend sea más componible y consistente; segundo, convertir el servicio en una plataforma de formación más completa, trazable y operable.

## Componentización aplicada

Se extrajeron componentes reutilizables para los flujos de asignación y visualización repetidos entre Universidad, Junta Directiva y Vocalía:

- `frontend/src/components/training/ContentAssignmentDialog.jsx`
  - Diálogo común para seleccionar contenido y, opcionalmente, representantes.
- `frontend/src/components/training/ContentRadioList.jsx`
  - Selector accesible de contenidos.
- `frontend/src/components/training/RepresentativeCheckboxList.jsx`
  - Selector múltiple de representantes.
- `frontend/src/components/training/RepresentativeGrid.jsx`
  - Tarjetas reutilizables para representantes.
- `frontend/src/components/training/ContentSummaryList.jsx`
  - Listado homogéneo de contenidos con número de archivos y cuestionarios.

También se amplió `DashboardLayout` con `pageActions`, para colocar acciones principales junto al título de página sin duplicar cabeceras completas.

Pantallas simplificadas:

- `UniversityDashboard.jsx`
- `JuntaDashboard.jsx`
- `CoordinadorTematicoDashboard.jsx`

## Hallazgos principales

### 1. Frontend

- Las cabeceras de varios dashboards estaban duplicadas; ahora se centralizan mejor en `DashboardLayout`.
- Los flujos de asignación repetían estructura, estilos y validación visual; ahora hay componentes comunes.
- Quedan tres candidatos grandes para una segunda ola de refactor:
  - `AdminDashboard.jsx`: gestión de usuarios, universidades, vocalías, zonas, importación/exportación y actividad en un solo archivo.
  - `EscuelaFormacionDashboard.jsx`: creación de contenidos, categorías, archivos, quizzes, drag/drop y listado en un solo componente.
  - `ContentViewer.jsx`: visor de archivos, navegación, cuestionarios y progreso en una única pantalla.

### 2. Backend

- `backend/server.py` concentra modelos, auth, permisos, endpoints, reglas de asignación, progreso y healthcheck. Funciona, pero crecerá mejor separado por dominios: `auth`, `users`, `content`, `assignments`, `progress`, `admin`.
- La autorización aparece repartida por endpoints. Conviene extraer políticas RBAC explícitas para reducir errores al añadir roles.
- El rechazo de contenido elimina el contenido. Funcionalmente sería más trazable tener estados como `draft`, `pending_review`, `published`, `rejected`, `archived`.
- Las asignaciones pueden evolucionar de “registro simple” a “campañas” con fecha límite, audiencia, estado, duplicados controlados y trazabilidad.
- El login con cookies es correcto, pero los endpoints mutantes se beneficiarían de protección CSRF explícita si la app crece en producción.

### 3. Producto

La plataforma cubre el ciclo mínimo de formación, pero todavía puede ganar mucha completitud si se orienta a tres experiencias:

- Persona representante: saber qué tiene que hacer, cuánto le queda y qué obtiene al terminar.
- Responsables de universidad/vocalía/junta: asignar con intención, hacer seguimiento y actuar sobre retrasos.
- Escuela/Admin: gobernar calidad, versiones, permisos, auditoría y métricas.

## Propuesta de incrementos funcionales

### P0 — Cimientos de calidad y seguridad

1. **RBAC centralizado**
   - Crear funciones/políticas por acción: `can_create_content`, `can_assign_content`, `can_manage_users`, etc.
   - Reduce regresiones cuando se añadan roles o permisos finos.

2. **Separación del backend por routers y servicios**
   - Extraer `auth_router`, `users_router`, `content_router`, `assignments_router`, `progress_router`.
   - Mantener modelos/esquemas fuera de `server.py`.

3. **Índices y caducidad de sesiones**
   - Índice único por email/google_sub.
   - TTL index para `user_sessions.expires_at`.
   - Índices por `content_id`, `user_id`, `university_id`, `zone`.

4. **CSRF para endpoints con cookie**
   - Añadir token CSRF para `POST/PUT/DELETE`.
   - Especialmente importante si se despliega en dominio público con cookies cross-site.

5. **Auditoría ampliada**
   - Registrar creación/aprobación/rechazo/archivo de contenidos, asignaciones y cambios de universidad/rol.

### P1 — Completitud de formación

1. **Ciclo de vida real del contenido**
   - Estados: `draft`, `pending_review`, `published`, `rejected`, `archived`.
   - Rechazo con comentario, no borrado.
   - Historial de versiones.

2. **Editor de contenido modular**
   - Separar formulario en componentes: metadata, categorías, archivos, quizzes, revisión.
   - Guardado como borrador.
   - Vista previa antes de enviar a aprobación.

3. **Asignaciones como campañas**
   - Fecha límite, audiencia, motivo, asignador, estado.
   - Audiencias: todos, zona, universidad, vocalía, representantes concretos.
   - Prevención de duplicados y panel de retirada/reasignación.

4. **Seguimiento avanzado**
   - Dashboard por contenido: asignados, iniciados, completados, atascados.
   - Dashboard por universidad/zona.
   - Export CSV/XLSX por progreso.

5. **Feedback de cuestionarios**
   - Mostrar revisión tras intento: qué falló y explicación opcional.
   - Banco de preguntas y orden aleatorio.
   - Límite configurable de intentos si se necesita.

### P2 — Experiencia y operación

1. **Certificados o constancias**
   - Generar certificado al completar una formación.
   - Validación con código único.

2. **Notificaciones**
   - Aviso por nueva asignación.
   - Recordatorios antes de fecha límite.
   - Notificación cuando un contenido sea aprobado/rechazado.

3. **Búsqueda y filtros globales**
   - Filtrar por categoría, estado, público/privado, creador, fecha y progreso.

4. **Importación guiada de usuarios**
   - Preview, validación por filas, errores descargables y modo dry-run.

5. **Accesibilidad y UX móvil**
   - Revisión de foco, labels, navegación por teclado y estados vacíos.
   - Mejorar tablas largas con vistas responsive.

## Siguiente refactor recomendado

El mejor siguiente corte es `EscuelaFormacionDashboard.jsx`, porque concentra la creación de valor principal: contenido, archivos y cuestionarios. Propuesta de extracción:

- `ContentFormDialog`
- `ContentMetadataFields`
- `CategorySelector`
- `ContentFilesEditor`
- `QuizEditor`
- `QuestionEditor`
- `ContentManagementList`

Ese refactor dejaría la pantalla preparada para borradores, edición de contenido y revisión con comentarios.
