# Spec 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Feature:** `027-restore-token-hardening` · **Tipo:** fix
- **Ámbitos:** backend

## 1. Contexto y problema

La spec 026 (ADR-0035) añadió «Deshacer» al quitar un alimento del diario: `DELETE /api/meals/{id}/items/{item_id}?undo=1`
devuelve un `restore_token` (una copia del alimento firmada con HMAC de `SECRET_KEY`, ligada al usuario y con caducidad
de 120 s) y `POST /api/meals/restore` lo recrea en su sitio. La misma clave firma el `feedback_id` del coach (ADR-0018).

La revisión de la 026 dejó dos hallazgos menores en el backlog del proyecto:

- **F2.** Si `SECRET_KEY` falta en el entorno, la configuración usa un valor por defecto conocido (`"DEFAULT SECRET"`),
  también en producción. Con esa clave cualquiera podría fabricar `restore_token` válidos para su propia cuenta (y
  `feedback_id`). Hoy nada impide que producción arranque así; solo lo evita una comprobación manual del runbook.
- **F3.** Al leer el contenido de un `restore_token` ya verificado, el servidor acepta una versión `1.0` (número con
  decimales) como si fuera `1`, y no pone tope a la posición del alimento. Una posición mayor que la que admite la base
  de datos haría fallar la restauración con un error interno (500) en lugar de con el 404 habitual de token no válido.

Los dos son defensa en profundidad: hoy solo explotables si se conoce la clave. Esta spec cierra ambos sin migración
ni variables nuevas.

**Restricción conocida:** el CI de GitHub no define `SECRET_KEY` y los tests que crean una app de producción
(spec 020, `make_app("production", …)`) dependen hoy del valor por defecto. Esos tests deben seguir pasando sin
debilitarse; cómo se les da una clave propia lo decide el plan.

## 2. Historia de usuario

Como **responsable del despliegue de fitnerd**, quiero **que el backend de producción se niegue a arrancar sin una
`SECRET_KEY` propia y que el servidor rechace cualquier `restore_token` con un contenido fuera de lo que él mismo
emite** para **que nadie pueda firmar tokens con una clave conocida y que un token anómalo nunca provoque un error
interno**.

## 3. Alcance

**Incluye:**
- Fallo al arrancar en la configuración de producción si `SECRET_KEY` falta, está vacía, solo tiene espacios o es un
  valor por defecto conocido.
- Desarrollo y pruebas siguen arrancando sin `SECRET_KEY` propia, como hoy.
- Validación estricta del contenido del `restore_token` en `POST /api/meals/restore`: versión entera exactamente `1`
  y posición entera dentro del rango que admite la base de datos.
- Un token con contenido fuera de esas reglas se trata igual que un token no válido (404 con el mensaje habitual).

**Fuera de alcance:**
- Cambiar el formato del `restore_token`, su caducidad (120 s) o la firma del `feedback_id` del coach.
- Rotar la `SECRET_KEY` de producción o exigir una longitud mínima (Q3: se anota en el backlog para una spec
  posterior, p. ej. 32 caracteres).
- Validar la longitud del nombre, del `catalog_id` o del tipo de dato dentro del token (se anota en el backlog).
- Cambios en el frontend, migraciones o variables nuevas.
- Actualizar el runbook y `CLAUDE.md` (lo hace el `doc-keeper`).

## 4. Requisitos funcionales

### REQ-001 — Producción no arranca sin una SECRET_KEY propia
IF la aplicación se crea con la configuración de producción AND `SECRET_KEY` falta, está vacía, solo contiene
espacios en blanco o, tras quitar los espacios en blanco de los extremos, es igual a uno de los valores por defecto
conocidos (`"DEFAULT SECRET"` y `"change-me"`; Q1) THEN
THE SYSTEM SHALL negarse a arrancar con un error cuyo mensaje es exactamente
«SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto».

- **AC-001.1:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y sin `SECRET_KEY` en el
  entorno, When se crea la aplicación, Then la creación falla con un `ValueError` cuyo mensaje es exactamente
  «SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto».
- **AC-001.2:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y `SECRET_KEY` igual a
  `"DEFAULT SECRET"`, When se crea la aplicación, Then falla con el mismo `ValueError` y mensaje.
- **AC-001.3:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y `SECRET_KEY` igual a
  `"change-me"`, When se crea la aplicación, Then falla con el mismo `ValueError` y mensaje.
- **AC-001.4:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y `SECRET_KEY` vacía o formada
  solo por espacios, tabuladores o saltos de línea, When se crea la aplicación, Then falla con el mismo `ValueError` y
  mensaje.
- **AC-001.5:** Given la configuración de producción con `SECRET_KEY` igual a `" DEFAULT SECRET "` o
  `"DEFAULT SECRET\n"` o `"\tchange-me "` (un valor por defecto con espacios en los extremos), When se crea la aplicación, Then falla con
  el mismo `ValueError` y mensaje.
- **AC-001.6:** Given la configuración de producción con `FRONTEND_BASE_URL` no válido y `SECRET_KEY` no válida,
  When se crea la aplicación, Then la creación falla con un `ValueError` (con el mensaje de `FRONTEND_BASE_URL` o con
  el de `SECRET_KEY`) y la aplicación no queda creada.

### REQ-002 — Producción arranca con una SECRET_KEY propia y la usa sin modificarla
WHEN la aplicación se crea con la configuración de producción, un `FRONTEND_BASE_URL` válido y una `SECRET_KEY` que
no está vacía ni es un valor por defecto conocido THE SYSTEM SHALL arrancar y usar esa clave exactamente como llega,
sin recortarla ni transformarla.

- **AC-002.1:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y `SECRET_KEY` igual a
  `"una-clave-propia-de-produccion"`, When se crea la aplicación, Then arranca y su `SECRET_KEY` es
  `"una-clave-propia-de-produccion"`.
- **AC-002.2:** Given la configuración de producción con un `FRONTEND_BASE_URL` válido y `SECRET_KEY` igual a
  `"  clave con espacios  "`, When se crea la aplicación, Then arranca y su `SECRET_KEY` conserva el valor exacto
  `"  clave con espacios  "`.
- **AC-002.3:** Given una aplicación de producción arrancada con una `SECRET_KEY` propia, When un usuario quita un
  alimento con `?undo=1` y restaura con el `restore_token` recibido, Then la restauración responde como en la 026
  (el alimento vuelve a su comida y posición).

### REQ-003 — Desarrollo y pruebas no exigen SECRET_KEY propia
WHILE la aplicación usa la configuración de desarrollo o de pruebas THE SYSTEM SHALL arrancar aunque `SECRET_KEY`
falte o sea un valor por defecto conocido.

- **AC-003.1:** Given la configuración de desarrollo sin `SECRET_KEY` en el entorno, When se crea la aplicación,
  Then arranca y su `SECRET_KEY` es `"DEFAULT SECRET"`.
- **AC-003.2:** Given la configuración de desarrollo con `SECRET_KEY` igual a `"change-me"`, When se crea la
  aplicación, Then arranca y su `SECRET_KEY` es `"change-me"`.
- **AC-003.3:** Given la configuración de pruebas, When se crea la aplicación con `SECRET_KEY` sin valor propio,
  Then arranca sin error.

### REQ-004 — Versión del token: entero estricto igual a 1
IF el contenido verificado de un `restore_token` tiene una versión que no es el entero `1` (por ejemplo `1.0`, `true`,
`"1"`, `2`, `0`, `null` o ausente) THEN THE SYSTEM SHALL rechazar la restauración con 404 y
`{"error": "No encontramos ese alimento en la comida."}`, sin crear ni modificar ninguna comida.

- **AC-004.1:** Given un contenido de token válido salvo la versión, que vale `1.0`, When se interpreta, Then se
  considera no válido.
- **AC-004.2:** Given un contenido de token válido salvo la versión, que vale `true`, `"1"`, `2`, `0`, `null` o falta,
  When se interpreta, Then se considera no válido en cada caso.
- **AC-004.3:** Given un contenido de token completamente válido con versión `1`, When se interpreta, Then se acepta
  y devuelve la copia del alimento con todos sus campos.
- **AC-004.4:** Given un usuario autenticado y un `restore_token` firmado correctamente para él, sin caducar, cuyo
  contenido tiene la versión `1.0`, When llama a `POST /api/meals/restore`, Then responde 404 con
  `{"error": "No encontramos ese alimento en la comida."}` y sus comidas quedan como estaban.

### REQ-005 — Posición del token: entero dentro del rango de la base de datos
IF el contenido verificado de un `restore_token` tiene una posición que no es un entero entre 0 y 2.147.483.647
(ambos incluidos) THEN THE SYSTEM SHALL rechazar la restauración con 404 y
`{"error": "No encontramos ese alimento en la comida."}`, sin crear ni modificar ninguna comida y sin un error
interno.

- **AC-005.1:** Given un contenido de token válido con posición `2147483647`, When se interpreta, Then se acepta con
  esa posición.
- **AC-005.2:** Given un contenido de token válido salvo la posición, que vale `2147483648`, When se interpreta, Then
  se considera no válido.
- **AC-005.3:** Given un contenido de token válido salvo la posición, que vale `-1`, `1.0`, `true`, `"3"`, `null` o
  falta, When se interpreta, Then se considera no válido en cada caso.
- **AC-005.4:** Given un contenido de token válido con posición `0`, When se interpreta, Then se acepta con posición
  `0`.
- **AC-005.5:** Given un usuario autenticado y un `restore_token` firmado correctamente para él, sin caducar, cuyo
  contenido tiene la posición `2147483648`, When llama a `POST /api/meals/restore`, Then responde 404 (no 500) con
  `{"error": "No encontramos ese alimento en la comida."}` y sus comidas quedan como estaban.

### REQ-006 — Identificador de USDA del token dentro del rango de la base de datos
IF el contenido verificado de un `restore_token` trae un identificador de USDA que no es un entero entre 1 y
2.147.483.647 (ambos incluidos) THEN THE SYSTEM SHALL rechazar la restauración con 404 y
`{"error": "No encontramos ese alimento en la comida."}`, sin crear ni modificar ninguna comida y sin un error
interno (Q2).

- **AC-006.1:** Given un contenido de token válido de un alimento de USDA con identificador `2147483648`, When se
  interpreta, Then se considera no válido.
- **AC-006.2:** Given un contenido de token válido de un alimento de USDA con identificador `0`, `-5` o `1.0`, When se
  interpreta, Then se considera no válido en cada caso.
- **AC-006.3:** Given un contenido de token válido de un alimento de USDA con identificador `2147483647`, When se
  interpreta, Then se acepta con ese identificador.
- **AC-006.4:** Given un contenido de token válido de un alimento del catálogo o personalizado, sin identificador de
  USDA, When se interpreta, Then se acepta como hoy.
- **AC-006.5:** Given un usuario autenticado y un `restore_token` firmado correctamente para él, sin caducar, de un
  alimento de USDA con identificador `2147483648`, When llama a `POST /api/meals/restore`, Then responde 404 (no 500)
  con `{"error": "No encontramos ese alimento en la comida."}` y sus comidas quedan como estaban.

## 5. Requisitos no funcionales

### NFR-001 — Sin regresiones en el deshacer de la 026
THE SYSTEM SHALL seguir emitiendo y aceptando los `restore_token` que genera él mismo exactamente como en la 026: el
formato del token y del contenido firmado no cambia, y un token emitido antes del despliegue de la 027 (dentro de sus
120 s) sigue siendo válido.

- **AC-N001.1:** Given un alimento real quitado con `?undo=1` en cualquier posición, When se interpreta el contenido
  de su `restore_token`, Then se acepta y la copia coincide campo a campo con el alimento quitado.
- **AC-N001.2:** Given la suite de tests existente de la 026 (servicio y rutas del diario), When se ejecuta, Then pasa
  completa sin borrar, saltar ni debilitar ningún test.

### NFR-002 — Los tests de configuración de producción no dependen de la clave por defecto
THE SYSTEM SHALL permitir que los tests que crean una aplicación de producción arranquen sin depender de que el
entorno (CI o `.env` local) defina `SECRET_KEY`.

- **AC-N002.1:** Given un entorno sin `SECRET_KEY` (como el CI de GitHub), When se ejecutan los tests de configuración
  de producción de la spec 020, Then pasan sin cambiar lo que comprueban.

## 6. Datos y contratos visibles

**Arranque en producción (lo ve quien despliega, en el log del contenedor):**

| Condición | Resultado |
|---|---|
| `SECRET_KEY` ausente, vacía, solo espacios, `"DEFAULT SECRET"` o `"change-me"` (con o sin espacios en los extremos) | No arranca. `ValueError`: «SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto» |
| `SECRET_KEY` con cualquier otro valor | Arranca; la clave se usa tal cual, sin recortar |
| Desarrollo o pruebas | Arranca con cualquier valor, también el por defecto |

**`POST /api/meals/restore` (contrato de la 026, sin cambios de forma):** un token cuyo contenido tenga una versión
distinta del entero `1`, una posición fuera de 0–2.147.483.647 o un identificador de USDA fuera de 1–2.147.483.647
responde **404** `{"error": "No encontramos ese alimento en la comida."}`, igual que un token mal firmado, de otro
usuario o caducado.

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | **Resuelta** (REQ-001). ¿Qué valores se consideran «por defecto» y se rechazan en producción? | `"DEFAULT SECRET"` (el de `config.py`) y `"change-me"` (el de `backend/.env.example`), comparados tras quitar los espacios de los extremos; además, ausente, vacía o solo espacios. Consecuencia: el comando local `FLASK_ENV=production … flask db upgrade` del runbook necesitará también la `SECRET_KEY` de producción (o una propia) si el `.env` local trae `change-me`; el `doc-keeper` lo anota. | Todas las propuestas |
| Q2 | **Resuelta** (REQ-006). ¿Se aplica el mismo tope de la base de datos al identificador de USDA del token (REQ-006), aunque la idea solo menciona versión y posición? | Sí: es la misma columna entera y el mismo fallo 500 con un valor enorme; entero de 1 a 2.147.483.647. | Todas las propuestas |
| Q3 | **Resuelta** (fuera de alcance, al backlog). ¿Se exige una longitud mínima a `SECRET_KEY` en producción? | No en esta spec: no conocemos la longitud de la clave actual de EC2 y exigirla podría tumbar el despliegue. Se anota en el backlog (p. ej., 32 caracteres) para una spec posterior. | Todas las propuestas |

## 8. Glosario

- **`restore_token`:** token firmado que devuelve `DELETE …/items/{id}?undo=1` (spec 026) y que `POST /api/meals/restore`
  usa para recrear el alimento quitado.
- **Contenido del token:** la copia del alimento que va dentro del `restore_token` (versión, día, tipo de comida,
  posición, origen, identificadores, nombre, gramos, valores por 100 g y caducidad). Solo se interpreta después de
  comprobar la firma.
- **Valor por defecto conocido:** una `SECRET_KEY` que aparece en el código o en los ejemplos del repositorio y, por
  tanto, no es secreta.
