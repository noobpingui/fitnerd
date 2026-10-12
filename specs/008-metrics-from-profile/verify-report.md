# Verify report 008 — Mediciones de Métricas coherentes con el perfil

- **Modo:** red (tras la etapa tests), iteración 2
- **Fecha:** 2026-10-12T23:53:05.171Z · **Rama:** `feat/008-metrics-from-profile` @ `8aa597c`
- **Resultado:** PASS

## 1. Comandos ejecutados

Solo tests nuevos de la feature (marcador `SDD:`). Base de datos Postgres respondiendo (los tests de rutas y de consolidación llegaron a ejecutarse).

| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `backend/.venv/Scripts/python.exe -m pytest -q` sobre `test_body_metric_service.py`, `test_body_metric_consolidation.py`, `test_body_metric_routes.py` | ✅ | 147 failed, 0 passed. Todos los fallos son legítimos (ver §4) |
| frontend | `npx vitest run` sobre `body-metrics/` y `profile/` | ✅ | Tests nuevos: 13 + 23 + 7 + 3 = 46 fallan; ningún test nuevo pasa. Los tests preexistentes de esos archivos pasan (27) |

No se ejecutan `ruff`, `npm run lint`, `tsc -b` ni `npm run build`: no aplican en modo red.

## 2. Trazabilidad

En modo red no se comprueba la trazabilidad completa (eso es de `full`). Solo se revisa que los tests nuevos llevan marcador:

- Backend: `test_body_metric_service.py` (50 marcadores `SDD:`), `test_body_metric_consolidation.py` (4), `test_body_metric_routes.py` (36).
- Frontend: `schemas.test.ts`, `MetricsHistory.test.tsx`, los 7 tests nuevos de `BodyMetricsPage.test.tsx` y los 3 de `ProfilePage.test.tsx`, todos con `// SDD:`.

- ACs sin test: — (pendiente de revisar en `full`)
- REQs sin tarea: — (pendiente de revisar en `full`)
- Tareas sin marcar `[x]`: — (en modo red no aplica; T-001 a T-036 ya están `[x]`)

## 3. Criterios de aceptación

Sin verificación de AC en modo red. Los AC del frontend y del backend se comprobarán en `full`. Ningún AC requiere revisión manual en esta etapa.

## 4. Fallos (si los hay)

No hay fallos que bloqueen. Clasificación de los rojos:

| # | Qué falló | Salida relevante (recortada) | Clasificación y responsable probable |
|---|---|---|---|
| 1 | Servicio: `BodyMetricService.__init__` con la firma antigua (89 tests) | `TypeError: BodyMetricService.__init__() takes 3 positional arguments but 6 were given` | ✅ Legítimo. El test llama al constructor que define el plan (§ Diseño, línea 60: repositorio de métricas, repositorio de usuarios, repositorio de perfil, UnitOfWork y reloj). Responsable: implementer (T-055) |
| 2 | Consolidación: scaffold | `NotImplementedError` en `body_metric_consolidation.py` (4 tests) | ✅ Legítimo (esqueleto `(scaffold)`). Responsable: implementer (T-051) |
| 3 | Rutas: `POST` sin 400/200 y validación ausente | `assert 201 == 400`, `assert 500 == 400`, `assert {'error': 'El peso debe ser mayor a 0'} == {...'entre 29,9 y 300 kg'}`, `TypeError: '<=' not supported between instances of 'int' and 'str'` | ✅ Legítimo (assert o error de código antiguo ante entrada que la nueva validación debe rechazar). Responsable: implementer (T-054, T-057) |
| 4 | Rutas: `PUT /api/body-metrics/<id>` inexistente | `assert 405 == 200` / `== 404` / `== 401` / `== 400` | ✅ Legítimo (405 de una ruta aún inexistente). Responsable: implementer (T-057) |
| 5 | Rutas: restricción única ausente | `DID NOT RAISE IntegrityError` | ✅ Legítimo. La restricción llega en T-050 y la migración en T-052. Responsable: implementer |
| 6 | Rutas: el peso del perfil no se sincroniza | `assert 80.0 == 78`, `assert 173.1 == 176.4`, `assert 31.0 == 30` | ✅ Legítimo. Responsable: implementer (T-056) |
| 7 | Rutas: `GET` del historial sin `notes` tras un `PUT` inexistente | `KeyError: 'notes'` en `test_put_keeps_the_notes` | ⚠️ Legítimo en el fondo (la causa es la ruta `PUT` inexistente), pero el test lee el cuerpo antes de comprobar el código de estado. Recomendación no bloqueante: al test-author, afirmar `status_code == 200` antes de leer el JSON. Responsable: test-author |
| 8 | Rutas: `DatatypeMismatch` al guardar `weight=True` | `column "weight" is of type double precision but expression is of type boolean` | ✅ Legítimo (validación ausente; el test espera 400). Responsable: implementer (T-054) |
| 9 | Frontend: `makeMetricCorrectionSchema` / `correctionPayload` scaffold | `Error: not implemented` (13 tests de `schemas.test.ts`) | ✅ Legítimo. Responsable: implementer (T-059) |
| 10 | Frontend: `MetricsHistory` scaffold y página sin la sección "Historial" | `Error: not implemented`; `Unable to find role="button" and name "Corregir medición del 5 oct 2026"`; `Unable to find role="heading" and name "Historial"` (23 tests de `MetricsHistory.test.tsx` y 7 de `BodyMetricsPage.test.tsx`) | ✅ Legítimo. Responsable: implementer (T-063, T-064, T-060) |
| 11 | Frontend: el perfil no envía `recorded_at` ni muestra la nueva descripción | `expected { weight: 80 } to match object { weight: 80, …(1) }`; `Unable to find an element with the text: Se usan para calcular tus calorías…` (3 tests de `ProfilePage.test.tsx`) | ✅ Legítimo. Responsable: implementer (T-065, T-066) |

Comprobaciones de integridad de la fase de tests:
- Ningún test nuevo pasa (backend: 0 de 147 pasan; frontend: 0 de 46 nuevos pasan).
- Esqueletos: `body_metric_consolidation.py` solo lanza `NotImplementedError`. `schemas.ts`, `MetricsHistory.tsx`, `updateBodyMetric` en `api.ts` y el tipo `UpdateBodyMetricPayload` solo lanzan `Error("not implemented")` con parámetros prefijados con `_`. No hay lógica en los esqueletos.
- No hay `ModuleNotFoundError`, `SyntaxError` ni errores de fixture o `conftest`.
- No hay `skip`, `xfail`, `.only`, `.skip`, `fit(` ni `xit(` nuevos en el diff.
- No se usa `unittest.mock` ni `monkeypatch` en los archivos de test nuevos.
- Los tests preexistentes que el test-author adaptó (4 backend y 2 aserciones de `BodyMetricsPage.test.tsx`) se conservan. Los 3 tests preexistentes de `BodyMetricsPage` y los 11 de `ProfilePage` sin marcador pasan, como se espera.
