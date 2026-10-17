# Review 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Iteración:** 3 de 3
- **Diff revisado:** `git diff main...feat/016-past-date-measurements` @ `0da0cbd`, con foco en `git diff 46faf15 0da0cbd` (test de F7 en `953f2ec` y corrección en `0da0cbd`). Sin commitear solo hay cambios en `specs/016-past-date-measurements/state.json` y `verify-report.md`.
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen

Revisión de seguimiento tras corregir F7, a petición del usuario. F7 está resuelto tal como se describió: si `GET /api/profile` falla, el botón "Registrar medición" se habilita tras el primer fallo, sin esperar a los reintentos. F1 a F6 siguen resueltos, `snapshot --check` da idéntico y he vuelto a ejecutar vitest sobre `body-metrics` y `profile` (412 tests en verde).

Sin embargo, la corrección abre un caso que antes era muy improbable y que afecta a los datos (F8, MAYOR):
1. El botón se habilita mientras TanStack Query sigue reintentando el perfil.
2. Si un reintento acierta con el formulario abierto, `weightUnit` pasa de `kg` a `lb` en mitad de la edición.
3. El valor que el usuario escribió pensando en kg se guarda como libras.

## 2. Cumplimiento de la spec

La tabla de la iteración 1, con los cambios de la iteración 2, sigue siendo válida. Esta iteración solo toca `BodyMetricsPage.tsx`. Solo cambian estas filas:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.4 / AC-001.7 | Sí en la apertura; no se mantiene si el perfil llega con el formulario ya abierto (F8) | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:43-49` (`profilePending = profileLoading && profileFailureCount === 0`), `:88`; test "si el perfil falla, el botón se habilita en cuanto falla la primera vez, sin esperar los reintentos" en `BodyMetricsPage.register.test.tsx` |
| Supuesto de la spec (spec.md:48: "los pesos se guardan en kg y se muestran en la unidad del perfil") | No siempre: ver F8 | `BodyMetricsPage.tsx:97-101` pasa `weightUnit` reactivo; `RegisterMetricDialog.tsx:44` (esquema) y `:75` (`registrationPayload(values, weightUnit)`) usan la unidad del momento de guardar, no la que se mostró al escribir |

## 3. Cumplimiento del plan

- La corrección de F7 es mínima y está localizada: usa `failureCount` de `useQuery`, sin dependencias nuevas.
- No hay desviaciones del plan. El plan no contemplaba que la unidad cambiara con el formulario abierto, porque hasta F7 el botón esperaba a que la consulta del perfil terminara del todo.
- Sin migración, sin dependencias nuevas y sin ADR.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B1.3: la corrección pasó por `rework tests` con la petición del usuario y por las etapas tests, implement y verify.
- [x] B2: `snapshot --check` da idéntico al snapshot del 2026-10-16T22:10:36, que se rehízo tras el `rework tests` autorizado. `git diff 953f2ec HEAD` (commit `tests`) solo toca `BodyMetricsPage.tsx`, `backlog.md` y `state.json`: implement no cambió ningún test.
- [x] B4: el test nuevo lleva `// SDD: 016 REQ-001 AC-001.4`.
- [x] B5: no se borró ni debilitó ningún test. El red check mostró el test de F7 en rojo por aserción. No hay `skip` ni `only`.
- [x] B5.7: según verify (`0da0cbd`), el ratchet de ruff no tiene violaciones nuevas, el lint da 0 errores y `tsc -b` y `build` pasan.
- [ ] Integridad de datos: F8 permite guardar un peso en una unidad distinta de la que el usuario vio al escribirlo.
- [x] B6.5: sin secretos y sin variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: test junto al archivo, `it("…")` en español y red simulada con mocks. El test usa su propio `QueryClient` con `retryDelay` largo y lo limpia al final.
- [x] P2 frontend: organización por feature y TanStack Query. El comentario de `BodyMetricsPage.tsx:48` está en español correcto.
- [x] P3 y P4: sin cambios en el backend ni en la autorización; sin migración.

## 5. Hallazgos

### Seguimiento de iteraciones anteriores

| # | Severidad | Estado | Evidencia |
|---|---|---|---|
| F1 | MENOR | Resuelto (sin cambios) | `RegisterMetricDialog.tsx:57-63` y `NumberField.tsx`; tests de accesibilidad en verde |
| F2 | MENOR | Resuelto, matizado por F7 | `BodyMetricsPage.tsx:49`, `:88`: sigue deshabilitado mientras el perfil carga por primera vez; el test de F2 sigue en verde |
| F3 | NIT | Resuelto (sin cambios) | `BodyMetricsPage.register.test.tsx`, test de AC-007.7 con "1M" |
| F4 | NIT | Resuelto (sin cambios) | `PhysicalDataForm.tsx:1-25` |
| F5 | NIT | Resuelto (sin cambios) | `PhysicalDataForm.tsx:117-121`, `:161-167` |
| F6 | NIT | Resuelto (sin cambios) | `backlog.md:21` |
| F7 | NIT | Resuelto, pero introduce F8 | `BodyMetricsPage.tsx:43-49`, `:88`; test nuevo en `BodyMetricsPage.register.test.tsx`; `backlog.md` lo marca `[x]` |

### Nuevos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F8 | MAYOR | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:49`, `:97-101`; `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx:44`, `:75` | Con F7, el botón se habilita tras el primer fallo de `GET /api/profile`, pero la consulta sigue reintentando (por defecto, 3 reintentos en unos 7 s). `weightUnit` se pasa al formulario de forma reactiva y el formulario lo usa al guardar (`registrationPayload(values, weightUnit)`). Si un reintento devuelve un perfil en lb con el formulario abierto, la etiqueta pasa a "Peso (lb)" y el valor ya escrito no cambia. Ejemplo: el usuario escribe 80 viendo "Peso (kg)" y se guardan 80 lb (36,3 kg). Por REQ-009, ese valor puede acabar también como peso del perfil. 80 lb está dentro del rango válido, así que el esquema no lo detiene. Para reproducirlo: perfil que falla una vez y después devuelve lb; abrir el formulario, escribir 80, dejar que el reintento acierte y pulsar "Guardar"; el payload lleva `weight_kg` ≈ 36,3. Corrección propuesta: fijar la unidad al abrir el formulario (guardarla en estado en el `onClick` del botón) o impedir que cambie mientras está abierto. Hace falta un test de este caso (test-author) antes de corregirlo (implementer). | implementer (y test-author para el test) |

## 6. Decisión

**CHANGES_REQUESTED.** F1 a F7 están resueltos y los tests coinciden con el snapshot autorizado. Pero la corrección de F7 introduce F8 (MAYOR): un peso puede guardarse en una unidad distinta de la que vio el usuario. Esta es la iteración 3 de 3, así que el orquestador debe escalarlo al usuario. Si se prefiere no corregirlo ahora, la alternativa es revertir `0da0cbd`: F7 era un NIT y, sin él, la ventana de F8 se reduce a un reintento por foco de ventana después del error final.

## Comentarios del usuario

## Comentarios del usuario

> F1 a F6, vamos a arreglarlas todas de una vez

> Corrige ahora el F7

> a
