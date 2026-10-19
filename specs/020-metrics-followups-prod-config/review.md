# Review 020 — Seguimiento de métricas corporales y configuración de producción

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...feat/020-metrics-followups-prod-config` @ `edd5c9c` (+ cambios sin commitear: solo `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen

La feature separa en el frontend el alta de una medición de su relectura (`useCreateBodyMetric` devuelve `{ metric, refreshed }`), muestra un aviso común con «Reintentar» en Métricas y en «Datos físicos» y despliega el Historial hasta la fecha registrada. En el backend añade un reloj por app que solo se puede fijar con `TESTING` (`utils/clock.py`), lo inyecta por constructor desde las `_build_*_service()` y valida `FRONTEND_BASE_URL` al arrancar en producción. REQ-004 y REQ-007 se cubren solo con tests. La implementación es pequeña y fiel al plan, y los tests prueban de verdad lo que dicen probar. Solo quedan hallazgos MENORES y NIT.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.5, AC-001.7 | Sí | `frontend/src/features/body-metrics/hooks.ts:29-47` (`refreshMetricsAndProfile` con `throwOnError` en mediciones y perfil), `hooks.ts:68-84`; `RegisterMetricDialog.tsx:78-87` (`onSaved` y cierre); `BodyMetricsPage.tsx:130-137`; tests `BodyMetricsPage.refresh.test.tsx:139,212,242` |
| AC-001.2, AC-001.4 | Sí | `BodyMetricsPage.tsx:58-63` (`isLoadingError`: un fallo de relectura conserva datos y botón); tests `:153,:194` |
| AC-001.3 | Sí | `BodyMetricsPage.tsx:115-125` (reintento solo relee); test `:172` (comprueba también que no se vuelve a registrar) |
| AC-001.6, AC-002.7 | Sí | `RefreshFailedNotice.tsx:19-33` (`role="alert"`, botón «Reintentar»); `RefreshFailedNotice.test.tsx`, `BodyMetricsPage.refresh.test.tsx:229`, `PhysicalDataForm.refresh.test.tsx` (AC-002.7) |
| AC-001.8, AC-002.10 | Sí | Sin temporizador en `RefreshFailedNotice.tsx`; tests con `advanceTimersByTime(60_000)` |
| AC-001.9 | Sí | `BodyMetricsPage.tsx:115` (aviso tras el botón, antes del resto); test `:276` con `compareDocumentPosition` |
| AC-002.1, AC-002.2, AC-002.8 | Sí | `PhysicalDataForm.tsx:152-175` (`setSaved`, `form.reset(values)`, aviso, `pendingFinish`); `ProfilePage.tsx:25` (`isLoadingError`); `PhysicalDataForm.tsx:363-370` (aviso en lugar de «Cambios guardados») |
| AC-002.3, AC-002.4, AC-002.5, AC-002.6 | Sí | `PhysicalDataForm.tsx:218-224` (`retryRefresh` → `finishSave`, sin `saveProfile` ni `createBodyMetric`); ver F1 y F2 para casos fuera de los AC |
| AC-002.9 | Sí | `PhysicalDataForm.tsx:150` (sin cambio medible no hay relectura); test AC-002.9 |
| AC-003.1 a AC-003.5 | Sí | `historyReveal.ts:5-14`; `MetricsHistory.tsx:53-61` (solo despliega; la petición queda pendiente si la fecha aún no está); `BodyMetricsPage.tsx:135-136`; tests `historyReveal.test.ts`, `MetricsHistory.test.tsx`, `BodyMetricsPage.refresh.test.tsx:297-371` |
| AC-004.1 a AC-004.3 | Sí (solo test, como pide Q4) | `frontend/src/test/fakeMetricsServer.ts` aplica la regla de `_sync_profile_weight`; `BodyMetricsPage.sync.test.tsx:157-221`. El peso esperado no está fijado en ninguna respuesta simulada |
| AC-004.4 | Sí | `backend/tests/test_routes/test_body_metric_routes.py:987-1004` con API real y reloj fijado |
| AC-005.1 a AC-005.9 | Sí | `backend/utils/clock.py:14-48`; `app.py:33-34`; `routes/body_metric_routes.py:29,48`, `routes/auth_routes.py:27,38`, `routes/profile_routes.py:25`; los servicios ya usaban `self.clock()` (`body_metric_service.py:96`, `auth_service.py:68`, `profile_service.py:127,144`, `progress_analysis_service.py:101`, `password_reset_service.py:62,128`); tests `test_fixed_clock_routes.py`, `test_clock.py` |
| AC-006.1 a AC-006.6 | Sí | `config.py:21-34` (`resolve_frontend_base_url`), `config.py:77-78,100`; `app.py:25-31` (valida antes de inicializar extensiones); `TestingConfig` fija `http://localhost:5173` (`config.py:114`); tests `test_production_config.py` |
| AC-007.1 a AC-007.8 | Sí (código existente, solo tests) | `test_resend_email_routes.py`: app con `MAIL_BACKEND=resend`, `FakeOpener` asignado antes de la primera petición y comprobación de que el transporte es `ResendTransport` |
| AC-N001.1, AC-N001.2 | Sí | `utils/clock.py:36-41` (decide solo por `TESTING`; en desarrollo y producción el reloj es la función `utc_now`, sin `set`); tests `test_fixed_clock_routes.py:232-281`, `test_clock.py:126-155` |
| AC-N002.1 | Sí | `test_resend_email_routes.py` (todas las peticiones quedan en `opener.requests`) |

## 3. Cumplimiento del plan

- La arquitectura, las firmas y la lógica coinciden con las secciones 3.2 a 3.4 del plan: `utils/clock.py`, `config_overrides`, `resolve_frontend_base_url`, `refreshMetricsAndProfile`, `visibleCountToReveal`, `RefreshFailedNotice`, `onSaved` y `reveal`.
- **Desviación justificada:** en lugar del fixture autouse `_reset_app_clock`, el fixture `app_clock` hace `reset()` antes y después. Está anotado en el backlog. Hoy todos los tests que fijan el reloj piden el fixture. El riesgo residual se recoge en F6.
- **Desviación menor sin justificar:** el plan (§3.4, «Datos físicos») dice que el aviso solo desaparece con una relectura correcta. El código también lo quita al guardar un cambio sin medición, que no relee (F1).
- `finishSave` recibe un tercer parámetro `measured`, que el plan no menciona. Es necesario para reutilizarlo desde `retryRefresh` y no cambia el comportamiento.
- **Coherencia de la ADR-0028 con el plan** (punto pedido por el orquestador): es coherente. Recoge las opciones descartadas (singleton en `extensions.py`, variable o cabecera), la decisión (`app.extensions`, `install_clock` por `TESTING`, `config_overrides` solo desde código, validación antes de las extensiones) y sus consecuencias. Las consecuencias incluyen que `flask db` en producción también exige la variable y que el JWT, el `created_at` de la base y la ventana del análisis siguen con la hora real. Todo coincide con el plan §3.3 y §6. Sigue en estado «Propuesta» y está pendiente de que el usuario la acepte en este gate (F7).

## 4. Checklist de la constitución

### Parte I (base)

- [x] **B2:** los tests no cambiaron durante implement. `snapshot --check` da idéntico. `git show --stat 6829cf3` no toca ningún test. El único cambio de test posterior (`edd5c9c`, E501 en `test_fixed_clock_routes.py:73`) está autorizado por `rework tests` y el `snapshot` siguiente del `history`, y no cambia aserciones. Excepción de proceso: B2.4, el heredoc de `conftest.py` (F3).
- [x] **B4:** los marcadores `SDD: 020 …` son coherentes con sus AC, salvo uno mal etiquetado (F4, NIT).
- [x] **B5:**
  - No hay tests borrados, saltados ni debilitados. Los tests de las specs 016 y 018 que pasan a fechas absolutas conservan su marcador y sus aserciones (`test_auth_routes.py:721-775`, `test_body_metric_routes.py:795-838`).
  - No hay llamadas reales a Resend: `FakeOpener` siempre. Tampoco hay esqueletos `not implemented` residuales.
  - **B5.2:** los 31 tests de caracterización que pasan sin implementación tienen una excepción aprobada por el usuario: «A» en «Comentarios del usuario» de `verify-report.md` y `history` del 2026-10-19T01:51. He comprobado que cubren comportamiento ya existente: el envío por Resend (REQ-007), la regla de sincronización del servidor (REQ-004 del frontend), AC-006.4 y AC-006.6, y AC-002.9. No esconden código nuevo sin rojo previo.
- [x] **B5.7:** sin violaciones nuevas del ratchet de ruff; `npm run lint`, `tsc -b` y `build` correctos (`verify-report.md`).
- [x] **B6.5:** sin secretos (la clave de los tests es `re_test_key`). No hay variables nuevas: `FRONTEND_BASE_URL` ya estaba en `backend/.env.example` y se añade el comentario de producción (`backend/.env.example:27`).

### Parte II (proyecto)

- [x] **P1 general:** marcadores con el número de spec. Docstrings y comentarios de test en español.
- [x] **P1 backend:**
  - Tests en `test_services/` y `test_routes/`, con nombres `test_<comportamiento>` en inglés.
  - Sin `unittest.mock` ni `monkeypatch`: `FakeClock` y `FakeOpener` a mano, y `caplog` para leer el log.
  - Postgres de prueba y ninguna llamada externa.
- [x] **P1 frontend:**
  - Tests junto al archivo y el doble con estado en `src/test/`.
  - `vitest` importado explícitamente y nombres en español.
  - Red simulada en `api.ts`.
- [x] **P2 backend 1-3:** capas intactas. El reloj llega por constructor desde `_build_*_service()`. El error de arranque es un `ValueError`, como el ya existente de `MAIL_BACKEND`: no hay petición ni `error_handlers`.
- [x] **P2.4:** sin cambios de modelo; no hace falta migración (comprobado en el diff: ningún archivo de `models/` ni de `migrations/`).
- [x] **P2.5:** `utc_now` se unifica en `utils/clock.py`, pero tres servicios aún lo importan a través de `services.profile_service` (F8, NIT).
- [x] **P2 frontend:**
  - Organización por feature, TanStack Query con las claves en `hooks.ts` y HTTP solo por `api.ts` → `apiFetch`.
  - `RefreshFailedNotice` en `features/body-metrics/components/` usa el `Button` de shadcn.
  - El formulario sigue con react-hook-form.
- [x] **P2 general:** textos visibles idénticos a la spec §6, con tildes y sin voseo.
- [x] **P3:**
  - Sin endpoints nuevos.
  - El instante no se puede fijar desde la petición ni desde el entorno: `TESTING` es una constante de `TestingConfig` y `config_overrides` solo existe en código.
  - No hay SQL nuevo y las variables están documentadas.
- [ ] **P4:** el paso manual (comprobar `FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` en el `backend/.env` de EC2 **antes del merge**; si falta, el contenedor no arranca) aún no está en `docs/deploy-runbook.md` ni en `CLAUDE.md`. Corresponde a la etapa `docs` (doc-keeper), no a esta revisión. Queda como recordatorio en el backlog.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `frontend/src/features/profile/components/PhysicalDataForm.tsx:176` | Con el aviso de relectura visible, un guardado posterior sin cambio medible (solo meta o actividad) ejecuta `setRefreshFailed(false)` y `setPendingFinish(null)` sin releer. El aviso desaparece aunque mediciones y perfil sigan desactualizados, y el aviso de la medición posterior a hoy (spec 016, REQ-009) ya no se podrá mostrar. Contradice el plan §3.4 («el aviso solo desaparece con una relectura correcta»). La spec no lo cubre con un AC: basta con no limpiar el estado si `measurementChanged` es falso, o con releer. | implementer |
| F2 | MENOR | `frontend/src/features/profile/components/PhysicalDataForm.tsx:218-224` | Si, con el aviso visible, el usuario edita campos sin guardar y pulsa «Reintentar», `finishSave(pendingFinish.values, …)` hace `form.reset(...)` con los valores del guardado anterior y descarta sus ediciones sin avisar. Caso no cubierto por la spec. Conviene conservar el borrador o limpiar el aviso al editar. | implementer |
| F3 | MENOR | `backend/tests/conftest.py:195-236` | El test-author escribió el bloque de fixtures (`app_clock`, `make_app`) con un heredoc de shell, en contra del Art. B2.4. Lo he revisado línea a línea: el contenido está dentro de su rol (`backend/tests/**`), es correcto, sin `monkeypatch` ni `mock`, y con la restauración de `email_sender` al terminar. Sus hashes coinciden con el snapshot. El único efecto material es que la copia de trabajo tiene finales de línea mixtos (194 CRLF y 42 LF); el índice guarda LF, así que el repositorio no se ve afectado. No hace falta rehacer el archivo. Se anota como incumplimiento de proceso para que no se repita: el test-author debe usar Write o Edit. | test-author |
| F4 | NIT | `frontend/src/features/body-metrics/pages/BodyMetricsPage.sync.test.tsx:209` | El marcador `// SDD: 020 NFR-002 AC-004.1` mezcla el NFR-002 con un AC de REQ-004. Debería ser `// SDD: 020 REQ-004 AC-004.1` (el AC de NFR-002 es AC-N002.1 y solo cubre el backend). | test-author |
| F5 | NIT | `frontend/src/test/fakeMetricsServer.ts:32-34` | `round1` usa `Math.floor(value * 10 + 0.5) / 10` sobre binario, mientras el servidor usa `Decimal(str(value))` con `ROUND_HALF_UP`. Pueden divergir en valores frontera como x,x5. Hoy no afecta a ningún AC: 162 lb va y vuelve sin pérdida. | test-author |
| F6 | NIT | `backend/tests/conftest.py:197-207` | `app_clock` no es autouse. Un test futuro que fije el reloj sin pedir el fixture dejaría el instante fijado para los siguientes. Además, `make_app` solo repone `email_sender` al terminar; `jwt_manager`, `rate_limiter` y `embedding_client` quedan configurados con la última app creada. Hoy es inocuo porque todas las configuraciones leen las mismas variables. | test-author |
| F7 | NIT | `docs/sdd/decisions/ADR-0028-reloj-de-la-app-y-configuracion-de-produccion.md:3`, `docs/sdd/decisions/README.md:34` | La ADR-0028 sigue «Propuesta». Si el usuario la acepta en este gate, hay que pasarla a «Aceptada» en la ADR y en el índice. | planner |
| F8 | NIT | `backend/services/auth_service.py:22`, `backend/services/body_metric_service.py:12`, `backend/services/progress_analysis_service.py:11` | Estos servicios siguen importando `utc_now` a través del reexporte de `services.profile_service`. Funciona, como prevé el plan, pero lo natural es importarlo de `utils.clock`, que es ya la fuente única. | implementer |

## 6. Decisión

**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. Todos los AC están implementados como dice la spec, con tests que prueban el comportamiento real. La integridad de los tests es correcta: el snapshot es idéntico y el único cambio posterior está autorizado. La excepción del Art. B5.2 está aprobada por el usuario y es legítima. El heredoc de `conftest.py` (F3) es un incumplimiento de proceso sin efecto en el contenido. F1 y F2 son casos límite de «Datos físicos» fuera de los AC y pueden pasar al backlog con la aprobación del usuario. Pendiente para la etapa `docs`: el paso manual de `FRONTEND_BASE_URL` en EC2 (P4) y aceptar la ADR-0028.


## Comentarios del usuario

- Gate de review: "Corrijamos, F1,F2 y F3. Lo demas al backlog"
