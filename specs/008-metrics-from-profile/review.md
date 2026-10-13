# Review 008 — Mediciones de Métricas coherentes con el perfil

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff chore/frontend-redesign...feat/008-metrics-from-profile` @ `d69bbb5`, más los cambios sin commit de formato en 3 archivos de `backend/tests/` (autorizados en `state.json`, evento `authorized_test_change`)
- **Veredicto:** APPROVED

## 1. Resumen

El cambio cumple la spec: hay una medición por usuario y día (restricción única y combinación en el servicio, con bloqueo de la fila del usuario), un `PUT` nuevo, la sincronización del peso del perfil en la misma transacción, la consolidación de duplicados en la migración, y en Métricas un historial con corrección y borrado que invalida mediciones y perfil. Las capas, los fakes y la validación están bien resueltos. Los tests no se tocaron en `implement` y pasan: los 147 del backend de la feature y los 73 del frontend de `body-metrics` y `profile`, que volví a ejecutar. Solo quedan hallazgos MENORES y NITs.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1–001.6) | Sí | `backend/services/body_metric_service.py:84-120`: busca con `get_by_user_and_date`, combina solo los campos no nulos (`:97-101`) y devuelve `created`. `backend/routes/body_metric_routes.py:56-65` responde 201 o 200. El valor por defecto de la fecha es `clock().date()` en UTC (`:55-66`). Tests: `test_body_metric_routes.py:105-185` |
| AC-001.7 | Sí | `UniqueConstraint` en `backend/models/body_metric.py:29` y en la migración `d8e4b2a7c1f5…py:23-29`. Tests: `test_body_metric_routes.py:188` y `:208` (IntegrityError) |
| REQ-002 (AC-002.1–002.9) | Sí | `_validate_values` en `body_metric_service.py:34-52` (rechaza `bool`, NaN y `"80"` mediante `_is_number`) y `_parse_recorded_at` en `:55-66` (regex más `fromisoformat`, con margen de +1 día). La validación se hace antes de escribir (`:86-90`). `get_json(silent=True)` en las rutas `:59` y `:71` |
| AC-002.10 | Sí | El `GET` no valida; test `test_body_metric_routes.py:391` |
| REQ-003 (AC-003.1–003.5) | Sí | `update_metric`, `body_metric_service.py:122-143`: asigna los tres valores tal cual y no toca `recorded_at` ni `notes`. Responde 404 con `NOT_FOUND_MESSAGE` |
| REQ-004 (AC-004.1–004.2) | Sí | `delete_metric`, `body_metric_service.py:148-162`; ruta `body_metric_routes.py:102-104` |
| REQ-005 (AC-005.1–005.10) | Sí | `_sync_profile_weight`, `body_metric_service.py:170-187`: tolerancia de 0,05 kg, conversión a lb, `_round1` y ajuste a `WEIGHT_RANGES`; no hace nada si falta perfil o última medición de peso, y solo toca `profile.weight`. Tests unitarios y `test_body_metric_routes.py:550-635` |
| REQ-006 (AC-006.1–006.3) | Sí | `backend/utils/body_metric_consolidation.py:11-74`: particiona por `(user_id, recorded_at)`, conserva la fila con `created_at DESC, id DESC` y toma cada columna del último valor no nulo. Test con Postgres en `test_body_metric_consolidation.py` |
| REQ-007 (AC-007.1–007.3) | Sí | `frontend/src/features/profile/components/PhysicalDataForm.tsx:138` (`todayIsoDate()` en hora local, `src/lib/dates.ts:12`); texto en `ProfilePage.tsx:59` |
| REQ-008 (AC-008.1–008.7) | Sí | `MetricsHistory.tsx:29-34` (orden), `:69-86` ("—", unidad y `%`), `:92` y `:101` (nombres accesibles), `:118-127` (paginación de 10); `BodyMetricsPage.tsx:234-242` (entre "Análisis del coach" y "Constancia") |
| REQ-009 (AC-009.1–009.9) | Sí | `MetricEditForm.tsx` (rhf + zod, `:131` "Registra al menos un valor", `:135` alerta de error, `:145` "Guardando…"); `schemas.ts:30-79` (límites y excepción R4) y `:99-123` (`correctionPayload`, 160 lb → 72,6) |
| REQ-010 (AC-010.1–010.6) | Sí, con la desviación aprobada | `DeleteMetricDialog.tsx:20-71` (doble clic bloqueado en `:24` y `:63`); el error lo muestra el historial (`MetricsHistory.tsx:129-133`) |
| REQ-011 (AC-011.1–011.4) | Sí | `hooks.ts:46-74`: `onSuccess` devuelve `Promise.all` con las invalidaciones de `["body-metrics"]` y `["profile"]`. Tests en `BodyMetricsPage.test.tsx:227-330` |
| NFR-001 (AC-N001.1–N001.3) | Sí | `@require_auth` en las cuatro rutas (`body_metric_routes.py:57,69,81,103`); `user_id` sale de `g.decoded_token`; `get_by_id_and_user` filtra en la misma consulta; el `user_id` del cuerpo se ignora |

## 3. Cumplimiento del plan

- **PUT: 404 antes que 400** (`body_metric_service.py:124-131`). El plan validaba antes de tocar nada; la implementación bloquea y busca primero, y valida antes de modificar. El estado no cambia ante un 400, que es lo que exige REQ-002. Desviación aprobada por el usuario.
- **El diálogo de borrado se cierra al fallar** y el error aparece en el historial (`DeleteMetricDialog.tsx:26-31`, `MetricsHistory.tsx:139-142`). AC-010.4 se cumple: el aviso aparece y la fila sigue. Desviación aprobada por el usuario.
- **Formulario de corrección**: el aviso "Registra al menos un valor" se calcula con `allEmpty` (`MetricEditForm.tsx:66-69`) en lugar de leer el issue de la raíz del esquema. El efecto es el mismo. No es relevante.
- Todo lo demás (repositorio, fakes, `_build_body_metric_service`, migración con `down_revision = 'c6a1f0d2e9b4'`, que es el head actual, y `FAT_LIMITS`/`MUSCLE_LIMITS` movidos a `schemas.ts`) sigue el plan.

## 4. Checklist de la constitución

- [x] **Art. 2:** cada agente se mantuvo en su rol. `git diff 96e3347 d69bbb5` no toca ningún archivo de test. Los 8 SHA-256 de `tests_snapshot` coinciden con los archivos actuales. Los cambios sin commit de `backend/tests/` son solo de formato (E501) y están autorizados.
- [x] **Art. 4:** los marcadores `SDD:` son coherentes con los AC que prueban. Revisé AC-001.7, 005.10, N001.1–N001.2, 009.8, 010.4, 010.5 y 011.1–011.4. Los marcadores heredados `REQ-012 AC-012.3` se tratan en F6.
- [x] **Art. 5:** no hay tests borrados, saltados ni debilitados. Los 4 tests antiguos del servicio se adaptaron según el plan §5.4. Los fakes son a mano en `tests/fakes.py`, sin `unittest.mock` ni `monkeypatch`, y el reloj es `FakeClock`.
- [x] **Art. 6:** las capas se respetan: las rutas solo parsean y serializan, y solo `UnitOfWork` hace commit o rollback. Los errores usan `ValidationError` y `ResourceNotFoundError`. El frontend usa `apiFetch` (`api.ts:19-27`), mantiene la organización por feature y tiene las claves de query en `hooks.ts`.
- [x] **Art. 6.4:** la migración está incluida y revisada a mano: consolida antes de crear la restricción, y `downgrade` solo quita la restricción, como dice su docstring. Importa `utils.body_metric_consolidation`, que está congelado por ADR-0020 y lo prueba su test con Postgres.
- [x] **Art. 7:** no hay secretos. Las rutas llevan `@require_auth` y filtran por el `user_id` del token. La consolidación usa SQL estático con `text()`. El input se valida, salvo el caso límite de F1.
- [x] **Art. 6.11:** los textos visibles están en español correcto y sin voseo. El diálogo oculta el "Close" en inglés.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/services/body_metric_service.py:51` (usa `_is_number` de `backend/services/profile_service.py:48-53`) | Un entero JSON enorme (por ejemplo `{"weight": 1000…0}` con 400 dígitos) llega como `int` de Python y `math.isfinite` lanza `OverflowError` (lo comprobé con `math.isfinite(10**400)`). El resultado es un 500 en lugar del 400 "El peso debe estar entre 29,9 y 300 kg". Afecta a `POST` y `PUT /api/body-metrics` y, desde antes, a `PUT /api/profile`. No tiene impacto en la seguridad ni en los datos, pero incumple la validación de Art. 7.3. Solución: capturar `OverflowError` en `_is_number`, o comparar el rango antes de llamar a `isfinite`. | implementer |
| F2 | MENOR | `frontend/src/features/body-metrics/hooks.ts:28-40` · `backend/services/body_metric_service.py:170-187` | Al guardar desde el perfil, el `POST` de la medición de hoy también ejecuta `_sync_profile_weight`. Si existe una medición con peso de fecha **posterior** a la de hoy en el dispositivo, el servidor devuelve el peso del perfil al de esa medición, deshaciendo sin aviso el cambio del usuario. Esa medición puede venir de antes del despliegue (fecha UTC del servidor, p. ej. guardada a las 20:00 en Costa Rica) o de un cambio de zona horaria. `useCreateBodyMetric` no invalida `["profile"]`, así que la UI sigue mostrando el valor nuevo hasta recargar. La ventana es corta (hasta el día siguiente), pero rompe el supuesto de Q5 de que al registrar desde el perfil ambos coinciden. Opciones: invalidar también el perfil en `useCreateBodyMetric` (habría que ajustar los tests de la spec 006 que cuentan lecturas) o documentarlo como limitación conocida. | planner |
| F3 | NIT | `frontend/src/features/body-metrics/components/MetricsHistory.tsx:129-133` | El aviso "No se pudo borrar la medición…" solo se limpia al abrir otro diálogo de borrado. Sigue visible aunque después se corrija una medición o la fila desaparezca por otra vía. | implementer |
| F4 | NIT | `backend/tests/test_routes/test_body_metric_routes.py:189,209,650` (y otros docstrings del archivo) | Los docstrings de los tests están sin tildes ("unicas", "restriccion", "medicion", "invalido"). Art. 5.6 pide docstrings en español; conviene escribirlos con su ortografía correcta. | test-author |
| F5 | NIT | `backend/services/body_metric_service.py:17` | `USER_NOT_FOUND_MESSAGE` duplica la constante de `profile_service.py`, del que ya se importan `WEIGHT_RANGES`, `_is_number`, `_round1` y `utc_now`. Se podría importar también. | implementer |
| F6 | NIT | `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx:130,146,158` · `frontend/src/features/profile/pages/ProfilePage.test.tsx` (`AC-011.5/6/7`) | Marcadores `SDD:` heredados de la base cuyos IDs coinciden con los de esta spec o con los del futuro bloque B. Ya lo señaló el verifier. Conviene renumerarlos antes de la spec del bloque B para que la trazabilidad no sea ambigua. | test-author |

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. F1 y F2 son MENORES y pueden diferirse a una tarea futura con aprobación del usuario; F2 debería decidirse, al menos como limitación documentada, antes de la spec del bloque B. Los NITs son opcionales.

Recordatorio de despliegue (riesgo R1 del plan): la migración `d8e4b2a7c1f5` consolida duplicados de forma irreversible y se aplica a mano en Supabase. Antes de aplicarla, cuenta los duplicados y haz una copia de seguridad de `body_metrics`.
