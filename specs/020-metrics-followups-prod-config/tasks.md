# Tareas 020 — Seguimiento de métricas corporales y configuración de producción

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-18)

## Fase A0 — Andamiaje (implementer, modo scaffold)
- [x] T-001 [REQ-005, NFR-001] (scaffold) Crear `utc_now`, `AdjustableClock` (`__init__` guarda `real_clock` y deja `instant = None`; `__call__`, `set`, `reset` lanzan "not implemented"), `install_clock`, `get_app_clock`, `current_clock` y `CLOCK_EXTENSION_KEY` con las firmas del plan — `backend/utils/clock.py`
- [x] T-002 [REQ-006] (scaffold) Añadir `DEFAULT_FRONTEND_BASE_URL`, `FRONTEND_BASE_URL_REQUIRED_MESSAGE` y `resolve_frontend_base_url(value, *, required)` que lanza "not implemented" — `backend/config.py`
- [x] T-003 [REQ-005, REQ-006, REQ-007] (scaffold) Añadir el parámetro `config_overrides` a `create_app` con su `app.config.update(...)` (solo fontanería para los fixtures) — `backend/app.py`
- [x] T-004 [REQ-001, REQ-002] (scaffold) Declarar `CreateMetricResult`, `refreshMetricsAndProfile` y `useRefreshMetricsAndProfile` (lanzan "not implemented", parámetros con prefijo `_`) — `frontend/src/features/body-metrics/hooks.ts`
- [x] T-005 [REQ-003] (scaffold) Crear `HISTORY_PAGE_SIZE`, `RevealRequest` y `visibleCountToReveal` que lanza "not implemented" — `frontend/src/features/body-metrics/historyReveal.ts`
- [x] T-006 [REQ-001, REQ-002] (scaffold) Crear `RefreshFailedNotice` (lanza "not implemented") y las constantes `METRICS_REFRESH_FAILED_MESSAGE` y `PROFILE_REFRESH_FAILED_MESSAGE` — `frontend/src/features/body-metrics/components/RefreshFailedNotice.tsx`
- [x] T-007 [REQ-001, REQ-003] (scaffold) Declarar el tipo exportado `MetricRegistrationResult` y la prop opcional `onSaved` (sin usarla) — `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`
- [x] T-008 [REQ-003] (scaffold) Declarar la prop opcional `reveal?: RevealRequest | null` (sin usarla) — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`

## Fase A — Tests (test-author)
- [x] T-010 [REQ-005, REQ-006, REQ-007] (test) Fixtures `app_clock`, `_reset_app_clock` (autouse) y `make_app` con valores seguros por defecto — `backend/tests/conftest.py`
- [x] T-011 [REQ-005, NFR-001, AC-005.6, AC-005.9, AC-N001.1] (test) `AdjustableClock` delega, fija naive y aware, no avanza, se resetea; `install_clock` según `TESTING` — `backend/tests/test_services/test_clock.py`
- [x] T-012 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6] (test) `resolve_frontend_base_url` y `create_app` en producción, desarrollo y pruebas — `backend/tests/test_services/test_production_config.py`
- [x] T-013 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.5, AC-005.6, AC-005.9] (test) Registro de mediciones con instante fijado: fecha por defecto, límites, medianoche UTC, reloj real y dos registros sucesivos — `backend/tests/test_routes/test_fixed_clock_routes.py`
- [x] T-014 [REQ-005, AC-005.4, AC-005.7, AC-005.8] (test) Edad en el registro y plazo de 5 minutos del enlace de restablecimiento con instante fijado — `backend/tests/test_routes/test_fixed_clock_routes.py`
- [x] T-015 [NFR-001, AC-N001.1, AC-N001.2] (test) Con apps `production` y `development` el reloj es el real y no se puede fijar desde cuerpo ni cabeceras — `backend/tests/test_routes/test_fixed_clock_routes.py`
- [x] T-016 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) Convertir los tests de límites de fecha de la spec 016 a instante fijado y fechas absolutas, sin cambiar marcador ni aserciones — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-017 [REQ-004, AC-004.4] (test) Registros 2026-10-05 (77) y 2026-10-03 (76) y lectura del perfil: `weight: 77` en ambas — `backend/tests/test_routes/test_body_metric_routes.py`
- [x] T-018 [REQ-005, AC-005.4] (test) Convertir los tests de edad de la spec 018 a instante fijado y fechas absolutas, sin cambiar marcador ni aserciones — `backend/tests/test_routes/test_auth_routes.py`
- [x] T-019 [REQ-007, AC-007.1, AC-007.2, AC-007.3] (test) App con `MAIL_BACKEND=resend`: una sola petición a Resend con cabeceras, cuerpo y enlace correctos, y el token sirve para restablecer — `backend/tests/test_routes/test_resend_email_routes.py`
- [x] T-020 [REQ-007, NFR-002, AC-007.4, AC-007.5, AC-007.6, AC-007.7, AC-007.8, AC-N002.1] (test) Resend con 403, sin clave, correo sin cuenta, `console` y `MAIL_BACKEND` desconocido; ninguna petición sale a la red — `backend/tests/test_routes/test_resend_email_routes.py`
- [x] T-021 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4] (test) `visibleCountToReveal`: fecha visible, fuera de la ventana, ausente y Historial ya desplegado — `frontend/src/features/body-metrics/historyReveal.test.ts`
- [x] T-022 [REQ-001, REQ-002, AC-001.6, AC-002.7] (test) Aviso con rol `alert`, botón «Reintentar», deshabilitado mientras reintenta — `frontend/src/features/body-metrics/components/RefreshFailedNotice.test.tsx`
- [x] T-023 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.7] (test) Métricas: aviso, datos conservados, reintento con éxito y con fallo, fallo en la relectura del perfil y registro sin fallo — `frontend/src/features/body-metrics/pages/BodyMetricsPage.refresh.test.tsx`
- [x] T-024 [REQ-001, AC-001.8, AC-001.9] (test) El aviso persiste 60 segundos y aparece entre el botón y el Historial — `frontend/src/features/body-metrics/pages/BodyMetricsPage.refresh.test.tsx`
- [x] T-025 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5] (test) Historial desplegado hasta la medición registrada, sin plegarse y sin cambios si el registro falla — `frontend/src/features/body-metrics/pages/BodyMetricsPage.refresh.test.tsx`
- [x] T-026 [REQ-003, AC-003.1, AC-003.3] (test) `MetricsHistory` con `reveal`: petición pendiente atendida al llegar la lista y dos peticiones con la misma fecha y distinto `seq` — `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx`
- [x] T-027 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6] (test) «Datos físicos»: aviso en lugar de «Cambios guardados», formulario sin cambios pendientes, reintento sin nuevos guardados — `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx`
- [x] T-028 [REQ-002, AC-002.7, AC-002.8, AC-002.9, AC-002.10] (test) Rol `alert`, fallo de la relectura del perfil, cambio solo de meta y persistencia 60 segundos — `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx`
- [x] T-029 [REQ-004, NFR-002] (test) Doble nuevo: servidor de prueba con estado que guarda mediciones y aplica la regla `_sync_profile_weight` — `frontend/src/test/fakeMetricsServer.ts`
- [x] T-030 [REQ-004, NFR-002, AC-004.1, AC-004.2, AC-004.3] (test) Registrar desde Métricas y comprobar el peso del perfil y del home (kg, fecha anterior, lb) con el servidor con estado — `frontend/src/features/body-metrics/pages/BodyMetricsPage.sync.test.tsx`

## Fase B — Implementación (implementer)
- [ ] T-040 [REQ-005, NFR-001, AC-005.6, AC-005.9, AC-N001.1] (impl) Implementar `utc_now`, `AdjustableClock` e `install_clock` (decide solo por `TESTING`) — `backend/utils/clock.py`
- [ ] T-041 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6] (impl) Implementar `resolve_frontend_base_url`, `FRONTEND_BASE_URL` sin valor por defecto y `FRONTEND_BASE_URL_REQUIRED` — `backend/config.py`
- [ ] T-042 [REQ-005, REQ-006, REQ-007, AC-006.1, AC-006.4, AC-007.1, AC-007.8] (impl) En `create_app`: validar `FRONTEND_BASE_URL` tras `config_overrides` e instalar el reloj antes de las extensiones — `backend/app.py`
- [ ] T-043 [REQ-005, AC-005.7, AC-005.8] (impl) Importar `utc_now` desde `utils/clock.py` conservando el nombre en ambos módulos — `backend/services/profile_service.py`, `backend/services/password_reset_service.py`
- [ ] T-044 [REQ-005, REQ-004, AC-005.1, AC-005.2, AC-005.3, AC-005.5, AC-005.9, AC-004.4, AC-N001.2] (impl) Pasar `clock=current_clock()` en `_build_body_metric_service()` y `_build_progress_analysis_service()` — `backend/routes/body_metric_routes.py`
- [ ] T-045 [REQ-005, AC-005.4, AC-005.7, AC-005.8] (impl) Pasar `clock=current_clock()` en `_build_auth_service()`, `_build_password_reset_service()` y `_build_profile_service()` — `backend/routes/auth_routes.py`, `backend/routes/profile_routes.py`
- [ ] T-046 [REQ-006] (config) Comentar en `FRONTEND_BASE_URL` que en producción es obligatoria y con `https://` — `backend/.env.example`
- [ ] T-047 [REQ-001, REQ-002, REQ-004, AC-001.1, AC-001.3, AC-001.4, AC-002.5, AC-004.1] (impl) `refreshMetricsAndProfile`, `useCreateBodyMetric` con `{ metric, refreshed }` y `useRefreshMetricsAndProfile` — `frontend/src/features/body-metrics/hooks.ts`
- [ ] T-048 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4] (impl) Implementar `visibleCountToReveal` — `frontend/src/features/body-metrics/historyReveal.ts`
- [ ] T-049 [REQ-001, REQ-002, AC-001.6, AC-002.7, AC-001.8, AC-002.10] (impl) Implementar `RefreshFailedNotice` (rol `alert`, sin temporizador) — `frontend/src/features/body-metrics/components/RefreshFailedNotice.tsx`
- [ ] T-050 [REQ-001, REQ-003, AC-001.1, AC-003.1, AC-003.5] (impl) Llamar a `onSaved({ recordedAt, refreshed })` tras un registro con éxito y antes de `onClose` — `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`
- [ ] T-051 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4] (impl) Atender la petición `reveal` desplegando el Historial de 10 en 10 sin plegarlo — `frontend/src/features/body-metrics/components/MetricsHistory.tsx`
- [ ] T-052 [REQ-001, REQ-003, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.7, AC-001.9, AC-003.1] (impl) Aviso bajo «Registrar medición», `isLoadingError` en lugar de `isError` y petición `reveal` — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-053 [REQ-002, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-002.8, AC-002.9] (impl) `finishSave`, `refreshFailed`, `pendingFinish` y aviso en el lugar de «Cambios guardados» — `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-054 [REQ-002, AC-002.8] (impl) `ProfileLoadError` solo ante `isLoadingError` del perfil — `frontend/src/features/profile/pages/ProfilePage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-023 | T-047, T-050, T-052 |
| REQ-001 | AC-001.2 | T-023 | T-052 |
| REQ-001 | AC-001.3 | T-023 | T-047, T-052 |
| REQ-001 | AC-001.4 | T-023 | T-047, T-052 |
| REQ-001 | AC-001.5 | T-023 | T-052 |
| REQ-001 | AC-001.6 | T-022 | T-049 |
| REQ-001 | AC-001.7 | T-023 | T-052 |
| REQ-001 | AC-001.8 | T-024 | T-049 |
| REQ-001 | AC-001.9 | T-024 | T-052 |
| REQ-002 | AC-002.1 | T-027 | T-053 |
| REQ-002 | AC-002.2 | T-027 | T-053 |
| REQ-002 | AC-002.3 | T-027 | T-053 |
| REQ-002 | AC-002.4 | T-027 | T-053 |
| REQ-002 | AC-002.5 | T-027 | T-047, T-053 |
| REQ-002 | AC-002.6 | T-027 | T-053 |
| REQ-002 | AC-002.7 | T-022, T-028 | T-049 |
| REQ-002 | AC-002.8 | T-028 | T-053, T-054 |
| REQ-002 | AC-002.9 | T-028 | T-053 |
| REQ-002 | AC-002.10 | T-028 | T-049 |
| REQ-003 | AC-003.1 | T-021, T-025, T-026 | T-048, T-050, T-051, T-052 |
| REQ-003 | AC-003.2 | T-021, T-025 | T-048, T-051 |
| REQ-003 | AC-003.3 | T-021, T-025, T-026 | T-048, T-051 |
| REQ-003 | AC-003.4 | T-021, T-025 | T-048, T-051 |
| REQ-003 | AC-003.5 | T-025 | T-050 |
| REQ-004 | AC-004.1 | T-030 | T-047 |
| REQ-004 | AC-004.2 | T-030 | T-047 |
| REQ-004 | AC-004.3 | T-030 | T-047 |
| REQ-004 | AC-004.4 | T-017 | T-044 |
| REQ-005 | AC-005.1 | T-013, T-016 | T-040, T-044 |
| REQ-005 | AC-005.2 | T-013, T-016 | T-044 |
| REQ-005 | AC-005.3 | T-013, T-016 | T-044 |
| REQ-005 | AC-005.4 | T-014, T-018 | T-045 |
| REQ-005 | AC-005.5 | T-013 | T-044 |
| REQ-005 | AC-005.6 | T-011, T-013 | T-040 |
| REQ-005 | AC-005.7 | T-014 | T-043, T-045 |
| REQ-005 | AC-005.8 | T-014 | T-043, T-045 |
| REQ-005 | AC-005.9 | T-011, T-013 | T-040, T-044 |
| REQ-006 | AC-006.1 | T-012 | T-041, T-042 |
| REQ-006 | AC-006.2 | T-012 | T-041 |
| REQ-006 | AC-006.3 | T-012 | T-041 |
| REQ-006 | AC-006.4 | T-012 | T-041, T-042 |
| REQ-006 | AC-006.5 | T-012 | T-041 |
| REQ-006 | AC-006.6 | T-012 | T-041 |
| REQ-007 | AC-007.1 | T-019 | T-042 |
| REQ-007 | AC-007.2 | T-019 | T-042 |
| REQ-007 | AC-007.3 | T-019 | T-042 |
| REQ-007 | AC-007.4 | T-020 | T-042 |
| REQ-007 | AC-007.5 | T-020 | T-042 |
| REQ-007 | AC-007.6 | T-020 | T-042 |
| REQ-007 | AC-007.7 | T-020 | T-042 |
| REQ-007 | AC-007.8 | T-020 | T-042 |
| NFR-001 | AC-N001.1 | T-011, T-015 | T-040 |
| NFR-001 | AC-N001.2 | T-015 | T-044 |
| NFR-002 | AC-N002.1 | T-020 | T-042 |
