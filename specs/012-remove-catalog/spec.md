# Spec 012 — Eliminar el catálogo de ejercicios, los favoritos y el plan semanal

- **Feature:** `012-remove-catalog` · **Tipo:** refactor
- **Ámbito:** ambos

## 1. Contexto y problema

Desde el rediseño centrado en los datos del usuario (specs 006–010, en producción desde el 13 de octubre de 2026), el catálogo de ejercicios (región → categoría → ejercicio), los favoritos y el plan semanal están **ocultos** detrás de un interruptor del frontend que vale "apagado". Sin embargo, todo lo demás sigue vivo:

- el backend sigue exponiendo sus endpoints (`/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites` y `/api/weekly-plan`), incluidos los de administración del catálogo;
- la base de datos de local y de producción conserva sus cinco tablas con datos (regiones, categorías, ejercicios, favoritos y entradas del plan semanal);
- el frontend conserva las pantallas, la navegación condicional y los textos (pantalla de acceso y páginas legales) que hablan del catálogo, los favoritos o el plan.

Ese código muerto aumenta la superficie de mantenimiento y de ataque, confunde a quien lee el repositorio y hace que las páginas legales describan datos que la app ya no ofrece. El objetivo es retirar estas tres funciones por completo, sin que cambie nada del resto de la app (autenticación, perfil y onboarding, métricas, macros, coach, feedback, home, páginas legales y tienda).

Nota de despliegue: el backend se despliega solo al hacer push a `main` y las migraciones se aplican a mano. Como el frontend en producción ya no llama a ninguno de estos endpoints, retirarlos no rompe a ningún cliente activo.

## 2. Historia de usuario

Como **mantenedor de fitnerd**, quiero **eliminar del todo el catálogo de ejercicios, los favoritos y el plan semanal (código, endpoints, datos y textos)** para **tener una app más pequeña, coherente con el rediseño y sin funciones ocultas que mantener ni datos que custodiar sin motivo**.

Como **usuario de fitnerd**, quiero **que la app y sus páginas legales describan solo lo que la app hace de verdad** para **saber qué datos míos se guardan**.

## 3. Alcance

**Incluye:**
- Retirar del backend los endpoints de regiones, categorías, ejercicios (incluidos los de administración), favoritos y plan semanal, junto con su lógica, su acceso a datos, su modelo y sus tests.
- Retirar el script de migración del catálogo a producción.
- Una migración de base de datos que borre las cinco tablas (regiones, categorías, ejercicios, favoritos y entradas del plan semanal) y sus datos, en local y en producción.
- **Paso previo operativo (manual, no automatizable):** copia de seguridad **completa** de la base de datos de producción (esquema y datos de todas las tablas, no solo de las cinco retiradas), hecha por el usuario antes de aplicar la migración y guardada fuera del repositorio en `C:/Users/alber/fitnerd-backups`. En local no hace falta (Q5, resuelta).
- Retirar del frontend las pantallas del catálogo, de favoritos y del plan semanal, el interruptor que las ocultaba y todos sus usos (rutas, navegación de escritorio y móvil, y pantalla de acceso).
- Actualizar las páginas legales (política de privacidad y términos de servicio) para que no mencionen el catálogo, los favoritos ni el plan semanal, y cambiar su fecha de última actualización a la del día en que se cierre la feature (Q3, resuelta).
- Actualizar la documentación del proyecto (README, CLAUDE.md y documentación de despliegue) para que no describa estas funciones y para registrar el paso de copia de seguridad completa y la migración en los pasos de despliegue; lo ejecuta el `doc-keeper` en la etapa `docs`.

**Fuera de alcance:**
- Cualquier cambio de comportamiento en autenticación, perfil y onboarding, métricas corporales, macros, coach de IA, feedback, home, páginas legales (salvo los textos citados) y tienda.
- El rol de administrador de las cuentas: se conserva tal como está, aunque deje de haber endpoints de administración (Q4, resuelta).
- El corpus de transcripciones del coach y su pipeline: no dependen del catálogo y no se tocan.
- Exportar o avisar a los usuarios sobre la pérdida de sus favoritos o su plan semanal: las secciones están ocultas desde el rediseño y la copia de seguridad queda solo para el mantenedor (Q1, resuelta).
- Una página propia de "no encontrado" en el frontend: las URL antiguas siguen redirigiendo como hasta ahora (Q6, resuelta).
- Responder `410 Gone` en los endpoints retirados: responden `404` como cualquier ruta inexistente (Q7, resuelta).

## 4. Requisitos funcionales

### REQ-001 — Endpoints del catálogo, favoritos y plan semanal retirados
WHEN un cliente llama a cualquiera de los endpoints retirados (listados en la sección 6), con o sin sesión y con cualquier rol, THE SYSTEM SHALL responder `404` con un cuerpo JSON `{"error": "…"}`, sin ejecutar ninguna lógica del catálogo, los favoritos ni el plan semanal.

- **AC-001.1:** Given un usuario autenticado con rol `user`, When hace `GET` a `/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites` y `/api/weekly-plan`, Then cada respuesta es `404` y su cuerpo JSON contiene la clave `error`.
- **AC-001.2:** Given un usuario autenticado con rol `admin`, When hace `POST` a `/api/body-regions`, `/api/exercise-categories` y `/api/exercises` con un cuerpo válido según el contrato anterior, y `DELETE` a `/api/body-regions/{id}`, `/api/exercise-categories/{id}` y `/api/exercises/{id}` con un UUID cualquiera, Then cada respuesta es `404` con la clave `error` en el cuerpo.
- **AC-001.3:** Given un usuario autenticado, When hace `POST` y `DELETE` a `/api/exercises/{id}/favorites`, `POST` a `/api/weekly-plan` con un cuerpo válido según el contrato anterior y `DELETE` a `/api/weekly-plan/{id}`, Then cada respuesta es `404` con la clave `error` en el cuerpo.
- **AC-001.4:** Given una petición sin cabecera de autorización, When se hace `GET` a `/api/exercises` y `GET` a `/api/weekly-plan`, Then la respuesta es `404` (no `401`), con la clave `error` en el cuerpo.

### REQ-002 — El resto del backend sigue igual
THE SYSTEM SHALL mantener sin cambios el comportamiento de los endpoints de autenticación, perfil, métricas corporales (incluido el análisis con IA), coach, feedback y salud.

- **AC-002.1:** Given el backend con esta feature aplicada, When se ejecuta la suite completa de tests del backend, sin los tests propios del catálogo, de favoritos ni del plan semanal, Then todos los tests pasan sin modificar, saltar ni debilitar ninguno de los de las demás áreas.
- **AC-002.2:** Given el backend con esta feature aplicada, When se hace `GET /api/health`, Then la respuesta es `200`.
- **AC-002.3:** Given un usuario autenticado con perfil, When hace `GET /api/profile` y `GET /api/body-metrics`, Then ambas respuestas son `200` con el mismo formato que antes de la feature.

### REQ-003 — Datos del catálogo, favoritos y plan semanal eliminados
WHEN se aplica la migración de esta feature a una base de datos, THE SYSTEM SHALL eliminar las tablas de regiones, categorías, ejercicios, favoritos y entradas del plan semanal con todos sus datos, y conservar intactas las demás tablas y sus filas.

- **AC-003.1:** Given una base de datos en la revisión anterior a esta feature, con filas en las cinco tablas del catálogo, los favoritos y el plan semanal, y con al menos un usuario con perfil y una medición corporal, When se aplica la migración, Then las cinco tablas ya no existen y el usuario, su perfil y su medición siguen existiendo con los mismos valores.
- **AC-003.2:** Given una base de datos ya migrada por esta feature, When se revierte la migración, Then las cinco tablas vuelven a existir con su estructura anterior y **vacías** (los datos solo se recuperan desde la copia de seguridad; Q2, resuelta).
- **AC-003.3:** Given la base de datos que crean los tests a partir del modelo de la app, When se inspeccionan sus tablas, Then no existe ninguna de las cinco tablas retiradas.

### REQ-004 — Rutas antiguas del frontend redirigen al inicio
WHEN un usuario navega a `/categories`, `/categories/{regionId}`, `/categories/{regionId}/{categoryId}` o `/favorites`, THE SYSTEM SHALL tratar la URL como desconocida y redirigir como cualquier otra ruta inexistente.

- **AC-004.1:** Given un usuario con sesión y onboarding completado, When abre cada una de esas cuatro URL, Then termina en `/home` y no se muestra ningún contenido del catálogo, de favoritos ni del plan semanal.
- **AC-004.2:** Given un visitante sin sesión, When abre `/favorites`, Then termina en `/login`.

### REQ-005 — Navegación sin catálogo ni favoritos
THE SYSTEM SHALL mostrar en la navegación solo las secciones activas, sin enlaces a "Catálogo" ni a "Favoritos".

- **AC-005.1:** Given un usuario con sesión, When se muestra la barra de navegación de escritorio, Then sus enlaces de sección son exactamente "Macros", "Métricas", "Coach" y "Tienda", en ese orden, y no hay ningún enlace con el texto "Catálogo" o "Favoritos".
- **AC-005.2:** Given un usuario con sesión, When se muestra la barra inferior móvil, Then sus pestañas son exactamente "Inicio", "Macros", "Métricas", "Coach" y "Tienda", en ese orden, y no hay ninguna con el texto "Catálogo" o "Favoritos".

### REQ-006 — Pantalla de acceso sin funciones retiradas
THE SYSTEM SHALL mostrar en la cabecera de las pantallas de inicio de sesión y registro solo las funciones que existen.

- **AC-006.1:** Given un visitante sin sesión, When abre `/login`, Then ve la etiqueta "AI Coach online" y no ve los textos "Catálogo de ejercicios con técnica de ejecución" ni "Guarda tus ejercicios favoritos".
- **AC-006.2:** Given un visitante sin sesión, When abre `/register`, Then ve la etiqueta "AI Coach online" y no ve los textos "Catálogo de ejercicios con técnica de ejecución" ni "Guarda tus ejercicios favoritos".

### REQ-007 — Páginas legales coherentes con la app
THE SYSTEM SHALL mostrar una política de privacidad y unos términos de servicio que no mencionen el catálogo de ejercicios, los favoritos ni el plan semanal, con la fecha de última actualización cambiada.

- **AC-007.1:** Given la política de privacidad, When se lee la entrada "Actividad en la app", Then menciona las preguntas al AI Coach y sus valoraciones y no contiene "favoritos" ni "plan semanal".
- **AC-007.2:** Given la política de privacidad, When se lee la sección "Para qué usamos tu información", Then no contiene "catálogo", "favoritos" ni "plan".
- **AC-007.3:** Given la política de privacidad, When se lee su fecha de última actualización, Then tiene el formato "D de mes de AAAA" y es distinta de "8 de octubre de 2026".
- **AC-007.4:** Given los términos de servicio, When se lee la sección "No es asesoría médica", Then sigue advirtiendo que las respuestas del AI Coach son información general que no reemplaza a un profesional y no contiene "catálogo".
- **AC-007.5:** Given los términos de servicio, When se lee su fecha de última actualización, Then tiene el formato "D de mes de AAAA" y es distinta de "2 de septiembre de 2026".
- **AC-007.6:** Given ambas páginas legales, When se lee su texto completo, Then no contienen formas de voseo ("registrás", "iniciás", "vos mismo", "hacés", "usás", "usá ", "Podés").

### REQ-008 — El resto del frontend sigue igual
THE SYSTEM SHALL mantener sin cambios el comportamiento de las pantallas de autenticación, onboarding, home, perfil, macros, métricas, coach, feedback, legales (salvo los textos de REQ-007) y tienda.

- **AC-008.1:** Given el frontend con esta feature aplicada, When se ejecuta la suite completa de tests del frontend, Then todos los tests pasan sin modificar, saltar ni debilitar ninguno de los de esas áreas (salvo los de las páginas legales que dependan de las fechas o textos que cambia REQ-007).
- **AC-008.2:** Given un usuario con sesión y onboarding completado, When abre `/macros`, `/body-metrics`, `/coach`, `/store` y `/profile`, Then cada URL se mantiene y muestra su pantalla, sin redirigir a `/home`.

## 5. Requisitos no funcionales

### NFR-001 — Sin restos de las funciones retiradas
THE SYSTEM SHALL no conservar en el código de la app (frontend y backend, excluido el historial de migraciones y los artefactos de `specs/` y `docs/`) referencias a los endpoints retirados ni al interruptor que ocultaba el catálogo.

- **AC-N001.1:** Given el código fuente del frontend, When se busca cualquiera de las rutas `/api/body-regions`, `/api/exercise-categories`, `/api/exercises`, `/api/favorites` o `/api/weekly-plan`, o el interruptor de las secciones del catálogo, Then no hay ninguna coincidencia.
- **AC-N001.2:** Given el código fuente del backend fuera del historial de migraciones, When se busca cualquiera de esas rutas o el nombre de cualquiera de las cinco tablas retiradas, Then no hay ninguna coincidencia, salvo en la propia migración de esta feature.
- **AC-N001.3:** Given el frontend con esta feature aplicada, When se ejecutan el lint, la comprobación de tipos y el build de producción, Then terminan sin errores; y Given el backend, When se ejecuta el ratchet de ruff, Then no aparecen violaciones nuevas.

## 6. Datos y contratos visibles

**Endpoints retirados** (todos responden `404` con `{"error": "…"}`, con o sin sesión; el texto del mensaje es el genérico del servidor y no forma parte del contrato):

| Método | Ruta |
|---|---|
| `GET`, `POST` | `/api/body-regions` |
| `DELETE` | `/api/body-regions/{id}` |
| `GET`, `POST` | `/api/exercise-categories` |
| `DELETE` | `/api/exercise-categories/{id}` |
| `GET`, `POST` | `/api/exercises` |
| `DELETE` | `/api/exercises/{id}` |
| `POST`, `DELETE` | `/api/exercises/{id}/favorites` |
| `GET` | `/api/favorites` |
| `GET`, `POST` | `/api/weekly-plan` |
| `DELETE` | `/api/weekly-plan/{id}` |

**Endpoints que no cambian:** `/api/auth/*`, `/api/profile`, `/api/body-metrics` (y `/analysis`, `/{id}`), `/api/coach/ask`, `/api/coach/feedback`, `/api/feedback` y `/api/health`.

**Rutas del frontend retiradas** (redirigen como cualquier ruta desconocida: a `/home` con sesión y a `/login` sin ella): `/categories`, `/categories/{regionId}`, `/categories/{regionId}/{categoryId}` y `/favorites`.

**Navegación resultante:**
- Escritorio: logo (a `/home`), "Macros", "Métricas", "Coach" y "Tienda".
- Móvil: "Inicio", "Macros", "Métricas", "Coach" y "Tienda".

**Pantalla de acceso:** solo la etiqueta "AI Coach online" bajo el titular.

**Datos eliminados:** todas las filas de regiones, categorías, ejercicios, favoritos de los usuarios y entradas de sus planes semanales, en local y en producción. En producción, antes de aplicar la migración, se hace una copia de seguridad completa de la base de datos (esquema y datos de todas las tablas), guardada fuera del repositorio. Se conservan sin cambios las cuentas (incluido su rol), los perfiles, las mediciones corporales, los análisis de progreso, el feedback y los datos del coach.

**Textos legales afectados:**
- Política de privacidad: entrada "Actividad en la app" (sin "tus ejercicios favoritos, tu plan semanal"), sección "Para qué usamos tu información" (sin "catálogo/favoritos/plan") y fecha de última actualización.
- Términos de servicio: sección "No es asesoría médica" (sin "El catálogo de ejercicios") y fecha de última actualización.

## 7. Preguntas abiertas

Todas resueltas (usuario: "Todas las propuestas, en Q5 volcado completo").

| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | Los favoritos y planes semanales que los usuarios guardaron en producción se pierden para siempre (salvo la copia de seguridad). ¿Hay que avisarles o darles una exportación antes? | **Resuelta:** no. Las secciones están ocultas desde el despliegue del rediseño y la copia de seguridad queda solo para el mantenedor. Incorporada en "Fuera de alcance". |
| Q2 | ¿Qué hace la migración al revertirse? | **Resuelta:** vuelve a crear las cinco tablas con su estructura anterior, **vacías**; los datos solo se recuperan desde la copia de seguridad. Incorporada en AC-003.2. |
| Q3 | ¿Se actualizan ahora las páginas legales (privacidad y términos) para quitar las menciones al catálogo, los favoritos y el plan, con nueva fecha? | **Resuelta:** sí, dentro de esta feature, con la fecha del día en que se cierre la feature. Incorporada en "Incluye" y en REQ-007 (AC-007.3 y AC-007.5). |
| Q4 | Al desaparecer los únicos endpoints de administración, ¿se conserva el rol `admin` de las cuentas y el mecanismo de autorización de administrador? | **Resuelta:** sí, se conservan sin cambios; quitarlos sería otra feature. Incorporada en "Fuera de alcance" y en la sección 6. |
| Q5 | ¿Cómo y dónde se hace la copia de seguridad previa de producción? | **Resuelta (con cambio sobre la propuesta):** volcado **completo** de la base de datos de producción en Supabase (esquema y datos de todas las tablas, no solo de las cinco retiradas), guardado fuera del repositorio en `C:/Users/alber/fitnerd-backups`, hecho por el usuario antes de aplicar la migración en producción y documentado en los pasos de despliegue. En local no hace falta. Incorporada en "Incluye" y en la sección 6. |
| Q6 | Las URL antiguas (`/categories…`, `/favorites`), ¿siguen redirigiendo a `/home` sin aviso o muestran una página de "no encontrado"? | **Resuelta:** siguen redirigiendo a `/home` (o a `/login` sin sesión) sin aviso, como ahora. Incorporada en REQ-004. |
| Q7 | ¿Los endpoints retirados responden `404` o `410 Gone`? | **Resuelta:** `404` con el `{"error": …}` genérico del servidor, igual que cualquier ruta inexistente. Incorporada en REQ-001 y en la sección 6. |

## 8. Glosario

- **Catálogo de ejercicios:** jerarquía región del cuerpo → categoría muscular → ejercicio, con endpoints públicos de lectura y endpoints de administración para crear y borrar.
- **Favoritos:** ejercicios del catálogo que un usuario marcó con el corazón.
- **Plan semanal:** asignación de ejercicios favoritos a días de la semana mediante arrastrar y soltar.
- **Interruptor del catálogo:** valor del frontend que ocultaba las rutas, los enlaces y las etiquetas de estas tres funciones desde el rediseño.
