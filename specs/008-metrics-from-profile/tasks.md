# Tareas 008 — Mediciones de Métricas coherentes con el perfil

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-12)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [ ] T-001 [REQ-006, AC-006.1] (scaffold) Crear `consolidate_duplicate_body_metrics(connection)` exportada, que lance "not implemented" — `backend/utils/body_metric_consolidation.py`
- [ ] T-002 [REQ-009, AC-009.3] (scaffold) Crear `makeMetricCorrectionSchema(weightUnit, originalWeightDisplay, originalWeightKg)` y `correctionPayload(values, weightUnit, original)` exportadas, que lancen "not implemented" — `frontend/src/features/body-metrics/schemas.ts`
- [ ] T-003 [REQ-008, AC-008.1] (scaffold) Crear el componente `MetricsHistory` (props `metrics`, `weightUnit`, `toDisplayWeight`) que lance "not implemented" — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`
- [ ] T-004 [REQ-009, AC-009.2] (scaffold) Crear el tipo `UpdateBodyMetricPayload` y `updateBodyMetric(id, payload)` que lance "not implemented" — `frontend/src/features/body-metrics/types.ts`, `frontend/src/features/body-metrics/api.ts`

## Fase A — Tests (test-author)
### Backend · fakes
- [ ] T-010 [REQ-001, AC-001.1] (test) Añadir los fakes `FakeBodyMetricRepository` (create, delete, list_by_user, get_by_id_and_user, get_by_user_and_date, get_latest_with_weight), `FakeUserProfileRepository` y `FakeLockingUserRepository` (get_by_id_for_update con `for_update_calls`) — `backend/tests/fakes.py`

### Backend · servicio (sin Postgres)
- [ ] T-011 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7] (test) Registro con una sola medición por día: crear (created=True), combinar con el mismo id, combinación parcial, otro día, otro usuario, fecha por defecto del reloj y fechas únicas tras una secuencia de registros, correcciones y borrados — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-012 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) Adaptar los 4 tests existentes al constructor y a `save_metric(user_id, {...})` con los fakes compartidos, conservando cada aserción (peso 0, grasa 150, valores vacíos, registro solo con peso) — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-013 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.8] (test) Validación de valores con mensajes literales: sin valores, peso, grasa y músculo no numéricos (`"80"`, `True`, NaN), fuera de rango y límites exactos 29,9/300, 3/60 y 10/70 — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-014 [REQ-002, AC-002.5, AC-002.6, AC-002.7, AC-002.9] (test) Validación de fecha y cuerpo: formato, fecha inexistente, no texto, futura (`2026-10-13` sí, `2026-10-14` no), cuerpo `None` o lista y rechazo sin cambios ni commit — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-015 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5] (test) Corrección de una medición: sustituye los tres valores, conserva notas y fecha, rechaza sin valores y da 404 por id ajeno o inexistente — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-016 [REQ-004, AC-004.1, AC-004.2] (test) Borrado de una medición propia y 404 por id ajeno o inexistente — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-017 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5] (test) Sincronización del peso del perfil: corrección en kg, borrado con perfil en lb (176,4), borrado en kg, corrección de una medición no última y diferencia de 0,05 kg o menos — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-018 [REQ-005, AC-005.6, AC-005.7, AC-005.8, AC-005.9, AC-005.10] (test) Sincronización del peso: única medición borrada, última medición sin peso, ajuste al límite de 30 kg, usuario sin perfil y demás campos del perfil intactos — `backend/tests/test_services/test_body_metric_service.py`
- [ ] T-019 [NFR-001, AC-N001.2, AC-N001.3] (test) Aislamiento entre usuarios: corregir o borrar el id de B con el user_id de A da 404 con B intacto, y un `user_id` en el cuerpo se ignora — `backend/tests/test_services/test_body_metric_service.py`

### Backend · rutas (Postgres)
- [ ] T-020 [REQ-001, AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.6, AC-001.7] (test) `POST /api/body-metrics` con 201 y 200, secuencia POST/PUT/DELETE sin fechas repetidas en el GET e `IntegrityError` al insertar un duplicado directamente — `backend/tests/test_routes/test_body_metric_routes.py`
- [ ] T-021 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7, AC-002.8, AC-002.9, AC-002.10] (test) Validación por HTTP: mensajes 400, cuerpo ausente o no objeto, fecha hoy+1 aceptada y hoy+2 rechazada, límites, medición sin cambios tras un 400 y lectura de una medición antigua fuera de rango — `backend/tests/test_routes/test_body_metric_routes.py`
- [ ] T-022 [REQ-003, REQ-004, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-004.1, AC-004.2] (test) `PUT` y `DELETE /api/body-metrics/<id>` por HTTP: 200, 204, 400 y 404 — `backend/tests/test_routes/test_body_metric_routes.py`
- [ ] T-023 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.8, AC-005.9, AC-005.10] (test) Peso del perfil tras registrar, corregir y borrar mediciones leído con `GET /api/profile`, incluido el usuario sin perfil y el resto del perfil intacto — `backend/tests/test_routes/test_body_metric_routes.py`
- [ ] T-024 [NFR-001, AC-N001.1, AC-N001.2, AC-N001.3] (test) 401 sin token o con token inválido en `PUT` y `DELETE`, 404 entre usuarios y `user_id` del cuerpo ignorado, con las mediciones y el perfil de B intactos — `backend/tests/test_routes/test_body_metric_routes.py`
- [ ] T-025 [REQ-006, AC-006.1, AC-006.2, AC-006.3] (test) Consolidación contra Postgres (quita la restricción, inserta duplicados con `created_at` explícitos, ejecuta `consolidate_duplicate_body_metrics` y hace rollback en `finally`) — `backend/tests/test_services/test_body_metric_consolidation.py`

### Frontend
- [ ] T-030 [REQ-009, AC-009.3, AC-009.4, AC-009.5, AC-009.6] (test) `makeMetricCorrectionSchema` (tres vacíos, límites en kg y lb, grasa, músculo, excepción del peso sin cambiar) y `correctionPayload` (kg original, 160 lb a 72,6, vacío a `null`) — `frontend/src/features/body-metrics/schemas.test.ts`
- [ ] T-031 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5] (test) Historial: orden, "—", unidad lb, paginación 10/20/23 y nombres accesibles de los botones — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [ ] T-032 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-009.7, AC-009.8, AC-009.9] (test) Formulario de corrección: campos, payload enviado, "Guardando…", error que conserva los valores, validación y "Cancelar" sin llamada — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [ ] T-033 [REQ-010, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5] (test) Diálogo de borrado: textos, cancelar, éxito, error y doble clic con una sola llamada — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [ ] T-034 [REQ-008, REQ-010, REQ-011, AC-008.6, AC-008.7, AC-010.6, AC-011.1] (test) Página Métricas: sin mediciones no hay "Historial", orden de secciones, borrar la única medición vuelve al estado vacío, KPI "Peso" actualizado tras corregir, y acotar con `within` las dos aserciones existentes duplicadas — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [ ] T-035 [REQ-011, AC-011.2, AC-011.3, AC-011.4] (test) Tras borrar una medición, `/profile` y `/home` muestran el peso y la grasa sincronizados, y `getProfile` se vuelve a llamar — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [ ] T-036 [REQ-007, AC-007.1, AC-007.2, AC-007.3] (test) Perfil: `recorded_at` con la fecha local del dispositivo (reloj falso a las 20:00), dos guardados el mismo día y descripción de "Datos físicos" — `frontend/src/features/profile/pages/ProfilePage.test.tsx`

## Fase B — Implementación (implementer)
### Backend
- [ ] T-050 [REQ-001, AC-001.7] (impl) Añadir `UniqueConstraint("user_id", "recorded_at", name="uq_body_metrics_user_id_recorded_at")` a `__table_args__` — `backend/models/body_metric.py`
- [ ] T-051 [REQ-006, AC-006.1, AC-006.2, AC-006.3] (impl) Implementar `consolidate_duplicate_body_metrics` con el UPDATE y el DELETE estáticos, y comentario de módulo congelado — `backend/utils/body_metric_consolidation.py`
- [ ] T-052 [REQ-006, REQ-001, AC-006.1, AC-001.7] (migration) Migración con `down_revision = 'c6a1f0d2e9b4'`: consolidar y crear la restricción única; el downgrade solo la elimina — `backend/migrations/versions/<rev>_one_body_metric_per_user_and_day.py`
- [ ] T-053 [REQ-001, REQ-005, AC-001.2, AC-005.1] (impl) Añadir `get_by_user_and_date` y `get_latest_with_weight` al repositorio — `backend/repositories/body_metric_repository.py`
- [ ] T-054 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7, AC-002.8, AC-002.9, AC-002.10] (impl) Constantes de mensajes y rangos, `_validate_values` y `_parse_recorded_at` con reloj inyectado — `backend/services/body_metric_service.py`
- [ ] T-055 [REQ-001, REQ-003, REQ-004, NFR-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-003.1, AC-003.5, AC-004.1, AC-004.2, AC-N001.2, AC-N001.3] (impl) Nuevo constructor, `save_metric`, `update_metric` y `delete_metric` con bloqueo de la fila de `users`, transacción única y rollback — `backend/services/body_metric_service.py`
- [ ] T-056 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-005.6, AC-005.7, AC-005.8, AC-005.9, AC-005.10] (impl) `_sync_profile_weight` con umbral de 0,05 kg, conversión kg/lb, redondeo a un decimal y ajuste al rango — `backend/services/body_metric_service.py`
- [ ] T-057 [REQ-001, REQ-002, REQ-003, REQ-004, NFR-001, AC-001.1, AC-001.2, AC-002.7, AC-003.1, AC-004.1, AC-N001.1, AC-N001.2] (impl) `POST` con 201/200 y `get_json(silent=True)`, `PUT /<uuid:metric_id>` nuevo y `_build_body_metric_service()` con los repositorios nuevos — `backend/routes/body_metric_routes.py`

### Frontend
- [ ] T-058 [REQ-009, AC-009.2] (impl) `UpdateBodyMetricPayload` y `updateBodyMetric` (PUT con `apiFetch`) — `frontend/src/features/body-metrics/types.ts`, `frontend/src/features/body-metrics/api.ts`
- [ ] T-059 [REQ-009, AC-009.3, AC-009.4, AC-009.5, AC-009.6] (impl) Implementar `makeMetricCorrectionSchema` y `correctionPayload`, y mover `FAT_LIMITS` y `MUSCLE_LIMITS` aquí; `PhysicalDataForm` los importa — `frontend/src/features/body-metrics/schemas.ts`, `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-060 [REQ-009, REQ-010, REQ-011, AC-009.2, AC-010.3, AC-011.1, AC-011.2, AC-011.3, AC-011.4] (impl) `useUpdateBodyMetric` y `useDeleteBodyMetric` que devuelven la invalidación de `["body-metrics"]` y `["profile"]` en `onSuccess` — `frontend/src/features/body-metrics/hooks.ts`
- [ ] T-061 [REQ-009, AC-009.1, AC-009.2, AC-009.5, AC-009.6, AC-009.7, AC-009.8, AC-009.9] (impl) Formulario de corrección con react-hook-form y zod, "Guardando…", error con `role="alert"` y "Cancelar" — `frontend/src/features/body-metrics/components/MetricEditForm.tsx`
- [ ] T-062 [REQ-010, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5] (impl) Diálogo de confirmación de borrado con `showCloseButton={false}`, error y bloqueo mientras borra — `frontend/src/features/body-metrics/components/DeleteMetricDialog.tsx`
- [ ] T-063 [REQ-008, REQ-009, REQ-010, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-009.1, AC-010.1] (impl) Implementar `MetricsHistory`: tabla ordenada, unidad del perfil, "—", paginación de 10 en 10 y botones accesibles de corregir y borrar — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`
- [ ] T-064 [REQ-008, REQ-010, REQ-011, AC-008.6, AC-008.7, AC-010.6, AC-011.1] (impl) Sección "Historial" entre "Análisis del coach" y "Constancia" (`fadeIn(4)` y `fadeIn(5)`), sin cambiar el estado vacío — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-065 [REQ-007, AC-007.1, AC-007.2] (impl) Enviar `recorded_at: todayIsoDate()` en la medición del guardado — `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-066 [REQ-007, AC-007.3] (impl) Nueva descripción de "Datos físicos" — `frontend/src/features/profile/pages/ProfilePage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-011, T-020 | T-055, T-057 |
| REQ-001 | AC-001.2 | T-011, T-020 | T-053, T-055, T-057 |
| REQ-001 | AC-001.3 | T-011 | T-055 |
| REQ-001 | AC-001.4 | T-011, T-020 | T-055 |
| REQ-001 | AC-001.5 | T-011, T-020 | T-055 |
| REQ-001 | AC-001.6 | T-011, T-020 | T-055 |
| REQ-001 | AC-001.7 | T-011, T-020 | T-050, T-052 |
| REQ-002 | AC-002.1 | T-012, T-013, T-021 | T-054 |
| REQ-002 | AC-002.2 | T-012, T-013, T-021 | T-054 |
| REQ-002 | AC-002.3 | T-012, T-013, T-021 | T-054 |
| REQ-002 | AC-002.4 | T-013, T-021 | T-054 |
| REQ-002 | AC-002.5 | T-014, T-021 | T-054 |
| REQ-002 | AC-002.6 | T-014, T-021 | T-054 |
| REQ-002 | AC-002.7 | T-014, T-021 | T-054, T-057 |
| REQ-002 | AC-002.8 | T-013, T-021 | T-054 |
| REQ-002 | AC-002.9 | T-014, T-021 | T-054 |
| REQ-002 | AC-002.10 | T-021 | T-054 |
| REQ-003 | AC-003.1 | T-015, T-022 | T-055, T-057 |
| REQ-003 | AC-003.2 | T-015, T-022 | T-055 |
| REQ-003 | AC-003.3 | T-015, T-022 | T-055 |
| REQ-003 | AC-003.4 | T-015, T-022 | T-054 |
| REQ-003 | AC-003.5 | T-015, T-022 | T-055 |
| REQ-004 | AC-004.1 | T-016, T-022 | T-055, T-057 |
| REQ-004 | AC-004.2 | T-016, T-022 | T-055 |
| REQ-005 | AC-005.1 | T-017, T-023 | T-053, T-056 |
| REQ-005 | AC-005.2 | T-017, T-023 | T-056 |
| REQ-005 | AC-005.3 | T-017, T-023 | T-056 |
| REQ-005 | AC-005.4 | T-017 | T-056 |
| REQ-005 | AC-005.5 | T-017 | T-056 |
| REQ-005 | AC-005.6 | T-018 | T-056 |
| REQ-005 | AC-005.7 | T-018 | T-056 |
| REQ-005 | AC-005.8 | T-018, T-023 | T-056 |
| REQ-005 | AC-005.9 | T-018, T-023 | T-056 |
| REQ-005 | AC-005.10 | T-018, T-023 | T-056 |
| REQ-006 | AC-006.1 | T-025 | T-051, T-052 |
| REQ-006 | AC-006.2 | T-025 | T-051 |
| REQ-006 | AC-006.3 | T-025 | T-051 |
| REQ-007 | AC-007.1 | T-036 | T-065 |
| REQ-007 | AC-007.2 | T-036 | T-055, T-065 |
| REQ-007 | AC-007.3 | T-036 | T-066 |
| REQ-008 | AC-008.1 | T-031 | T-063 |
| REQ-008 | AC-008.2 | T-031 | T-063 |
| REQ-008 | AC-008.3 | T-031 | T-063 |
| REQ-008 | AC-008.4 | T-031 | T-063 |
| REQ-008 | AC-008.5 | T-031 | T-063 |
| REQ-008 | AC-008.6 | T-034 | T-064 |
| REQ-008 | AC-008.7 | T-034 | T-064 |
| REQ-009 | AC-009.1 | T-032 | T-061, T-063 |
| REQ-009 | AC-009.2 | T-032 | T-058, T-060, T-061 |
| REQ-009 | AC-009.3 | T-030, T-032 | T-059 |
| REQ-009 | AC-009.4 | T-030, T-032 | T-059 |
| REQ-009 | AC-009.5 | T-030, T-032 | T-059, T-061 |
| REQ-009 | AC-009.6 | T-030, T-032 | T-059, T-061 |
| REQ-009 | AC-009.7 | T-032 | T-061 |
| REQ-009 | AC-009.8 | T-032 | T-061 |
| REQ-009 | AC-009.9 | T-032 | T-061 |
| REQ-010 | AC-010.1 | T-033 | T-062, T-063 |
| REQ-010 | AC-010.2 | T-033 | T-062 |
| REQ-010 | AC-010.3 | T-033 | T-060, T-062 |
| REQ-010 | AC-010.4 | T-033 | T-062 |
| REQ-010 | AC-010.5 | T-033 | T-062 |
| REQ-010 | AC-010.6 | T-034 | T-064 |
| REQ-011 | AC-011.1 | T-034 | T-060, T-064 |
| REQ-011 | AC-011.2 | T-035 | T-056, T-060 |
| REQ-011 | AC-011.3 | T-035 | T-056, T-060 |
| REQ-011 | AC-011.4 | T-035 | T-056, T-060 |
| NFR-001 | AC-N001.1 | T-024 | T-057 |
| NFR-001 | AC-N001.2 | T-019, T-024 | T-055, T-057 |
| NFR-001 | AC-N001.3 | T-019, T-024 | T-055 |
