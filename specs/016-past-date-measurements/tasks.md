# Tareas 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-16)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden:
    1. tareas (scaffold): las ejecuta el implementer en modo scaffold (solo firmas que lanzan "not implemented");
    2. tareas (test): las ejecuta el test-author;
    3. tareas impl, migration y config, en orden de dependencia: las ejecuta el implementer.
- Toda tarea impl se cumple cuando pasan los tests (test) que cubren sus mismos AC.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
- Marcadores de test: `# SDD: 016 REQ-005 AC-005.2` (Python) y `// SDD: 016 REQ-001 AC-001.3` (TypeScript).
- No hay migración ni dependencias nuevas (plan §3.1).
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-005, AC-005.2] (scaffold) Añadir las constantes `TOO_OLD_DATE_MESSAGE = "La fecha de la medición no puede tener más de un año de antigüedad"` y `PAST_LIMIT_DAYS = 366` (solo valores, sin lógica; `_parse_recorded_at` no cambia todavía) para que los tests puedan importarlas — `backend/services/body_metric_service.py`
- [x] T-002 [REQ-002, AC-002.2, AC-002.3] (scaffold) Crear `shiftIsoDate(_isoDate: string, _days: number): string` que lance "not implemented" — `frontend/src/lib/dates.ts`
- [x] T-003 [REQ-002, REQ-003, AC-002.1, AC-003.1] (scaffold) Crear `REGISTRATION_PAST_DAYS = 365`, los tipos `MetricRegistrationValues` y `MetricRegistrationErrorKey`, y `makeMetricRegistrationSchema(_weightUnit, _today)` y `registrationPayload(_values, _weightUnit)` que lancen "not implemented" — `frontend/src/features/body-metrics/schemas.ts`
- [x] T-004 [REQ-009, AC-009.1] (scaffold) Crear `laterWeightMetric(_metrics: BodyMetric[], _today: string): BodyMetric | null` que lance "not implemented" — `frontend/src/features/body-metrics/laterWeight.ts`
- [x] T-005 [REQ-001, NFR-002, AC-001.3, AC-N002.1] (scaffold) Crear el componente `RegisterMetricDialog(_props: RegisterMetricDialogProps)` con `metrics`, `weightUnit` y `onClose`, que lance "not implemented" — `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-005, REQ-003, AC-005.1, AC-005.2, AC-005.3, AC-003.7, AC-003.8] (test) Unitarios del servicio: límite de 366 días (366 se acepta, 367 falla con `TOO_OLD_DATE_MESSAGE` sin `create` ni `commit`), fecha futura sigue fallando, crear el 2026-10-05 y combinar con la medición de esa fecha — `backend/tests/test_services/test_body_metric_service.py`
- [x] T-011 [REQ-006, REQ-009, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.6, AC-009.5] (test) Unitarios del servicio (regresión en verde): el peso del perfil sigue a la medición de peso de fecha más reciente en kg y lb, un registro solo con grasa no lo cambia, sin perfil no se crea uno, y medición posterior a hoy mantiene el peso del perfil — `backend/tests/test_services/test_body_metric_service.py`
- [x] T-012 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5] (test) Rutas: `day(-366)` da 201; `day(-367)` da 400 con el mensaje y deja `GET` historial y `GET /api/profile` iguales; `day(2)` da 400 "futura"; una medición de hace 600 días se lee igual y admite `PUT` (200) y `DELETE` (204) — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-013 [REQ-003, REQ-006, REQ-009, NFR-001, AC-003.7, AC-003.8, AC-006.5, AC-009.5, AC-N001.1, AC-N001.2] (test) Rutas: 201 al crear con fecha pasada y 200 con el mismo `id` al combinar; el resto del perfil no cambia tras un POST pasado; con medición posterior a hoy el perfil sigue en su peso; 401 sin token o con token inválido; el `user_id` de B en el cuerpo crea medición para A y B queda intacto — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-014 [REQ-002, AC-002.2, AC-002.3, AC-002.7] (test) Unitarios de `shiftIsoDate`: restar 365 días desde 2026-10-12 da 2025-10-12, cruce de año y 29 de febrero — `frontend/src/lib/dates.test.ts`
- [x] T-015 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6] (test) Esquema `makeMetricRegistrationSchema` con `fieldMessages`: fecha futura, de más de un año, límites válidos, fecha vacía, tres valores vacíos y rangos de peso (kg y lb), grasa y músculo — `frontend/src/features/body-metrics/schemas.test.ts`
- [x] T-016 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) `registrationPayload`: fecha siempre, valores solo si están rellenos (claves ausentes con `not.toHaveProperty`), 160 lb se envía como 72.6 — `frontend/src/features/body-metrics/schemas.test.ts`
- [x] T-017 [REQ-009, AC-009.1, AC-009.3] (test) `laterWeightMetric`: posterior con peso, posterior sin peso se ignora, igual a hoy no cuenta, varias posteriores devuelve la de fecha mayor — `frontend/src/features/body-metrics/laterWeight.test.ts`
- [x] T-018 [REQ-001, REQ-002, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.7] (test) Componente `RegisterMetricDialog`: contenido inicial, unidad kg/lb y sin perfil, cancelar sin envío, texto de ayuda, mensajes de validación en pantalla con "Guardar" deshabilitado, y `min`/`max` del campo Fecha — `frontend/src/features/body-metrics/components/RegisterMetricDialog.test.tsx`
- [x] T-019 [REQ-003, REQ-004, NFR-002, AC-003.1, AC-003.2, AC-003.3, AC-003.5, AC-003.6, AC-004.1, AC-004.2, AC-004.3, AC-N002.1, AC-N002.2] (test) Componente `RegisterMetricDialog`: argumentos de `createBodyMetric`, "Guardando…" con un solo envío, error con rol `alert` y diálogo abierto, aviso de fecha con medición (no bloquea), rol de diálogo y etiquetas accesibles — `frontend/src/features/body-metrics/components/RegisterMetricDialog.test.tsx`
- [x] T-020 [REQ-001, REQ-003, REQ-010, AC-001.1, AC-001.2, AC-003.4, AC-003.9, AC-010.1, AC-010.2] (test) Página Métricas: botón "Registrar medición" con y sin mediciones, textos nuevos del subtítulo y del estado vacío, orden del historial tras registrar y desaparición del estado vacío — `frontend/src/features/body-metrics/pages/BodyMetricsPage.register.test.tsx`
- [x] T-021 [REQ-007, REQ-008, AC-007.1, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-007.7, AC-008.1, AC-008.2, AC-008.4] (test) Página Métricas: tras registrar con fecha pasada se recalculan ritmo, racha, último registro, KPI de peso, composición y gráfico; el perfil y el home muestran el peso sincronizado sin recargar — `frontend/src/features/body-metrics/pages/BodyMetricsPage.register.test.tsx`
- [x] T-022 [REQ-007, AC-007.2] (test) Página Métricas: tras los dos registros, la petición de `analyzeBodyMetrics` lleva el ritmo calculado con las tres mediciones — `frontend/src/features/body-metrics/pages/BodyMetricsPage.analysis.test.tsx`
- [x] T-023 [REQ-008, REQ-009, AC-008.3, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (test) Perfil: tras guardar un cambio de peso se releen perfil y mediciones; con medición posterior a hoy se ve el aviso con su fecha, el peso del perfil real y sin "Cambios guardados" ni cambios pendientes; sin ella, "Cambios guardados" — `frontend/src/features/profile/pages/ProfilePage.test.tsx`

## Fase B — Implementación (implementer)
- [ ] T-030 [REQ-005, REQ-003, REQ-006, NFR-001, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5, AC-003.7, AC-003.8, AC-006.1, AC-006.5, AC-009.5, AC-N001.1, AC-N001.2] (impl) En `_parse_recorded_at`, rechazar con `TOO_OLD_DATE_MESSAGE` las fechas anteriores a `today - PAST_LIMIT_DAYS` días, tras la comprobación de fecha futura; el resto del comportamiento no cambia — `backend/services/body_metric_service.py`
- [ ] T-031 [REQ-002, AC-002.2, AC-002.3, AC-002.7] (impl) Implementar `shiftIsoDate` en UTC con `Date.UTC` y formato `getUTC*` — `frontend/src/lib/dates.ts`
- [ ] T-032 [REQ-002, REQ-003, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-003.1, AC-003.2, AC-003.3] (impl) Implementar `makeMetricRegistrationSchema` (superRefine con los mensajes de la spec y los `LIMITS` existentes) y `registrationPayload` — `frontend/src/features/body-metrics/schemas.ts`
- [ ] T-033 [REQ-009, AC-009.1, AC-009.3] (impl) Implementar `laterWeightMetric` — `frontend/src/features/body-metrics/laterWeight.ts`
- [ ] T-034 [REQ-007, REQ-008, AC-007.1, AC-008.1, AC-008.2, AC-008.3] (impl) Hacer que `useCreateBodyMetric` invalide mediciones y perfil con `invalidateMetricsAndProfile` y devuelva la promesa — `frontend/src/features/body-metrics/hooks.ts`
- [ ] T-035 [REQ-001, REQ-002, REQ-003, REQ-004, NFR-002, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-002.1, AC-002.7, AC-003.1, AC-003.5, AC-003.6, AC-004.1, AC-004.2, AC-004.3, AC-N002.1, AC-N002.2] (impl) Implementar el diálogo `RegisterMetricDialog` con react-hook-form, validación síncrona, aviso de fecha existente, guardado, error y cancelar — `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`
- [ ] T-036 [REQ-001, REQ-003, REQ-010, AC-001.1, AC-001.2, AC-003.4, AC-003.9, AC-010.1, AC-010.2] (impl) Añadir el botón "Registrar medición", el estado `registering`, el diálogo y los textos nuevos del subtítulo y del estado vacío — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-037 [REQ-008, REQ-009, AC-008.3, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (impl) Tras registrar, calcular `laterWeightMetric` con la caché, mostrar el aviso con `role="status"` y el peso real del perfil, y reajustar `saved` sin "Cambios guardados" — `frontend/src/features/profile/components/PhysicalDataForm.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-020 | T-036 |
| REQ-001 | AC-001.2 | T-020 | T-036 |
| REQ-001 | AC-001.3 | T-018 | T-035 |
| REQ-001 | AC-001.4 | T-018 | T-035 |
| REQ-001 | AC-001.5 | T-018 | T-035 |
| REQ-001 | AC-001.6 | T-018 | T-035 |
| REQ-001 | AC-001.7 | T-018 | T-035 |
| REQ-002 | AC-002.1 | T-015, T-018 | T-032, T-035 |
| REQ-002 | AC-002.2 | T-014, T-015, T-018 | T-031, T-032 |
| REQ-002 | AC-002.3 | T-014, T-015, T-018 | T-031, T-032 |
| REQ-002 | AC-002.4 | T-015, T-018 | T-032 |
| REQ-002 | AC-002.5 | T-015, T-018 | T-032 |
| REQ-002 | AC-002.6 | T-015, T-018 | T-032 |
| REQ-002 | AC-002.7 | T-014, T-018 | T-031, T-035 |
| REQ-003 | AC-003.1 | T-016, T-019 | T-032, T-035 |
| REQ-003 | AC-003.2 | T-016, T-019 | T-032 |
| REQ-003 | AC-003.3 | T-016, T-019 | T-032 |
| REQ-003 | AC-003.4 | T-020 | T-036 |
| REQ-003 | AC-003.5 | T-019 | T-035 |
| REQ-003 | AC-003.6 | T-019 | T-035 |
| REQ-003 | AC-003.7 | T-010, T-013 | T-030 |
| REQ-003 | AC-003.8 | T-010, T-013 | T-030 |
| REQ-003 | AC-003.9 | T-020 | T-036 |
| REQ-004 | AC-004.1 | T-019 | T-035 |
| REQ-004 | AC-004.2 | T-019 | T-035 |
| REQ-004 | AC-004.3 | T-019 | T-035 |
| REQ-005 | AC-005.1 | T-010, T-012 | T-030 |
| REQ-005 | AC-005.2 | T-010, T-012 | T-030 |
| REQ-005 | AC-005.3 | T-010, T-012 | T-030 |
| REQ-005 | AC-005.4 | T-012 | T-030 |
| REQ-005 | AC-005.5 | T-012 | T-030 |
| REQ-006 | AC-006.1 | T-011 | T-030 |
| REQ-006 | AC-006.2 | T-011 | T-030 |
| REQ-006 | AC-006.3 | T-011 | T-030 |
| REQ-006 | AC-006.4 | T-011 | T-030 |
| REQ-006 | AC-006.5 | T-013 | T-030 |
| REQ-006 | AC-006.6 | T-011 | T-030 |
| REQ-007 | AC-007.1 | T-021 | T-034 |
| REQ-007 | AC-007.2 | T-022 | T-034 |
| REQ-007 | AC-007.3 | T-021 | T-034 |
| REQ-007 | AC-007.4 | T-021 | T-034 |
| REQ-007 | AC-007.5 | T-021 | T-034 |
| REQ-007 | AC-007.6 | T-021 | T-034 |
| REQ-007 | AC-007.7 | T-021 | T-034 |
| REQ-008 | AC-008.1 | T-021 | T-034 |
| REQ-008 | AC-008.2 | T-021 | T-034 |
| REQ-008 | AC-008.3 | T-023 | T-034, T-037 |
| REQ-008 | AC-008.4 | T-021 | T-034 |
| REQ-009 | AC-009.1 | T-017, T-023 | T-033, T-037 |
| REQ-009 | AC-009.2 | T-023 | T-037 |
| REQ-009 | AC-009.3 | T-017, T-023 | T-033, T-037 |
| REQ-009 | AC-009.4 | T-023 | T-037 |
| REQ-009 | AC-009.5 | T-011, T-013 | T-030 |
| REQ-010 | AC-010.1 | T-020 | T-036 |
| REQ-010 | AC-010.2 | T-020 | T-036 |
| NFR-001 | AC-N001.1 | T-013 | T-030 |
| NFR-001 | AC-N001.2 | T-013 | T-030 |
| NFR-002 | AC-N002.1 | T-019 | T-035 |
| NFR-002 | AC-N002.2 | T-019 | T-035 |
