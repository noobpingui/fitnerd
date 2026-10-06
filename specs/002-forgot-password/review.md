# Review 002 — Recuperación de contraseña por correo (forgot password)

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff main...feat/002-forgot-password` @ `4fb974a`, más los cambios sin commitear de `backend/tests/test_routes/test_password_reset_routes.py` y `backend/tests/test_services/test_password_reset_service.py` (solo formato de ruff, autorizados y recogidos en `tests_snapshot`)
- **Veredicto:** APPROVED

## 1. Resumen
El cambio añade los endpoints públicos `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`, con su servicio, repositorio, modelo y migración, un `EmailSender` con transportes `resend`, `console` y `memory`, `ProxyFix` para obtener la IP real detrás de Caddy, y en el frontend las páginas `/forgot-password` y `/reset-password`, además del enlace y el aviso en `LoginForm`. La implementación sigue el plan casi al pie de la letra, respeta las capas y cubre los 12 REQ y los 3 NFR. Los textos coinciden con la spec. No hay hallazgos bloqueantes ni mayores. Quedan algunos riesgos operativos menores para producción y un par de detalles de robustez.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `frontend/src/features/auth/components/LoginForm.tsx:65-70`; `LoginForm.test.tsx:175` |
| AC-001.2 | Sí | `frontend/src/app/router.tsx:59-74` (fuera de `ProtectedRoute`); `router.test.tsx:26,39` |
| AC-002.1 / AC-N001.1 | Sí | `backend/routes/auth_routes.py:82-88` devuelve solo la constante `REQUEST_ACCEPTED_MESSAGE` (`services/password_reset_service.py:14-16`); `test_forgot_password_returns_the_exact_generic_body_and_never_the_token` |
| AC-002.2 | Sí | Envío síncrono antes del commit y de la respuesta: `password_reset_service.py:86-108`; tests unitario y de ruta |
| AC-002.3 | Sí | Asunto, enlace `…/reset-password?token=`, "caduca a los 5 minutos" y "puedes ignorar este correo": `password_reset_service.py:88-104`; remitente desde `MAIL_FROM` (`config.py:38`, `utils/email_sender.py:101`) |
| AC-002.4 | Sí | Solo se mira `password_hash`, no `google_id`: `password_reset_service.py:76` |
| AC-003.1 / AC-003.2 | Sí | `password_reset_service.py:76-81`: fila sin token, sin correo y la misma respuesta 200 |
| AC-004.1 a AC-004.5 | Sí | `password_reset_service.py:71-73` (`<` estricto: 2:00 exactos no bloquea); `get_latest_by_email` por correo, sin IP (`repositories/password_reset_repository.py:27-34`) |
| AC-005.1 a AC-005.2 | Sí | `password_reset_service.py:59-61` antes de cualquier lectura; `get_json(silent=True) or {}` en `auth_routes.py:84` |
| AC-005.3 | Sí | `frontend/src/features/auth/schemas.ts:25-27`; `ForgotPasswordForm.test.tsx:37` |
| AC-006.1 / AC-N001.2 | Sí | `password_reset_service.py:106-108`: mensaje fijo, sin `str(exc)`; rollback en `:116-118` |
| AC-006.2 / AC-006.3 | Sí | Se envía antes de escribir, así que un fallo no deja filas ni invalida el enlace anterior (`:86-114`) |
| AC-007.1 / AC-007.2 | Sí | `password_reset_service.py:144-151`; `auth_routes.py:90-96` |
| AC-007.3 | Sí | `used_at` (`:147`) y la comprobación en `:126` |
| AC-008.1 a AC-008.5 | Sí | `password_reset_service.py:121-132` (`>= TOKEN_TTL`: 5:00 exactos ya no vale); invalidación en `password_reset_repository.py:40-48` |
| AC-009.1 a AC-009.9 | Sí | `password_reset_service.py:135-138` (puntos de código y bytes UTF-8, sin escrituras); el error del token tiene prioridad (`:121-132` va antes) |
| AC-010.1 a AC-010.4 | Sí | `ForgotPasswordForm.tsx:50-74` |
| AC-011.1 a AC-011.9 | Sí | `ResetPasswordPage.tsx:5-31`, `ResetPasswordForm.tsx`, `schemas.ts:31-47`, `hooks.ts:60-71` y el aviso en `LoginForm.tsx:35-39` |
| AC-012.1 a AC-012.8 | Sí | `password_reset_service.py:65-73`: locks, después el límite por IP (`count_recent_by_ip` con `>`) y después el límite por correo; `password_reset_repository.py:12-25` |
| AC-012.9 | Sí | `backend/app.py:23-25` (`ProxyFix` con `x_for` configurable), `config.py:45,58,70` (`FRONTEND_BASE_URL` en `:41`); `Caddyfile` sin `trusted_proxies`, coherente con ADR-0015; `test_limit_counts_the_original_client_ip_and_not_the_proxy_ip` |
| AC-N002.1 | Sí | `secrets.token_urlsafe(32)` (`:83`); solo se guarda el SHA-256 (`:112`) |
| AC-N003.1 | Sí | `bcrypt.hashpw` igual que el registro (`:145-146`) |

## 3. Cumplimiento del plan
- La implementación coincide con §3 del plan: modelo, índices, repositorio, orden de las comprobaciones, primero el envío y después las escrituras, advisory locks en orden alfabético, `ProxyFix`, configuración y frontend.
- **Desviación menor y justificada:** la fixture autouse de `conftest.py` instala un `InMemoryTransport` nuevo en lugar de llamar a `clear()` sobre el transporte de `init_app`. El test-author la corrigió en el red check (iteración 2), está registrada en `state.json` y desacopla los tests de `init_app`.
- **Migración** `b7c1d9e4a2f3`: escrita a mano (fecha y revisión no autogeneradas). Contiene solo `create_table` con la FK, el `UNIQUE(token_hash)` y los tres índices (`email`, `user_id` y el compuesto `client_ip, created_at`), sin operaciones espurias sobre otras tablas. `down_revision = 'e28ebf553c7d'` es la cabeza anterior y no hay otra migración que cuelgue de ella. `downgrade()` es simétrico. Los nombres de índice coinciden con los que genera el modelo. Que se aplicó y revirtió en Supabase durante el incidente de verify confirma de paso que es ejecutable.

## 4. Checklist de la constitución
- [x] Art. 2: cada agente se mantuvo en su rol. El commit de implement (`4fb974a`) no toca ningún test (`git diff bb252e1 4fb974a -- backend/tests frontend/src/**/*.test.*` está vacío). Los únicos cambios posteriores a los tests son de formato de ruff, hechos por el test-author, autorizados y registrados. Los 9 SHA-256 de `tests_snapshot` coinciden con los archivos actuales.
- [x] Art. 4: los marcadores `SDD:` son coherentes con los AC que prueban, salvo F5 (NIT).
- [x] Art. 5: no hay tests borrados, saltados ni debilitados (el diff de formato conserva las mismas aserciones). Los fakes se escriben a mano y se inyectan por constructor (`FakeEmailSender`, `FakeClock`, `FakeUserRepository`, `FakePasswordResetRepository`). La justificación de `InMemoryTransport` está en el plan, §7. No hay llamadas externas reales.
- [x] Art. 6: se respetan las capas. Las rutas solo parsean y serializan. Las excepciones son de dominio. Solo `UnitOfWork` hace commit o rollback. Se usan `apiFetch`, la organización por feature y react-hook-form con zod.
- [x] Art. 6.4: la migración está incluida y revisada (§3).
- [x] Art. 7: no hay secretos (`.env.example` lleva un placeholder). Los endpoints son públicos porque no exponen datos de usuario; está justificado en el plan, §7. El input se valida en el servicio y con zod. Solo se usa el ORM.
- [x] Art. 6.11: los textos visibles están en español correcto y sin voseo. Solo los comentarios tienen detalles menores (F6).

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `backend/config.py:41` (y `:52-58`) | `ProductionConfig` hereda `FRONTEND_BASE_URL = os.getenv(..., "http://localhost:5173")`. Si en el `backend/.env` de EC2 falta la variable, producción envía correos con enlaces a `localhost` sin ningún error visible, y el flujo queda roto en silencio. Se propone una de dos opciones: un valor por defecto propio en `ProductionConfig` (`https://fitnerd.betofallas.dev`) o un fallo al arrancar si falta. Como mínimo, el doc-keeper debe incluir en los pasos de despliegue las variables `FRONTEND_BASE_URL`, `RESEND_API_KEY` y `MAIL_FROM`. | planner |
| F2 | MENOR | `backend/utils/email_sender.py:57-72` | Ningún test ejecuta `ResendTransport` ni `EmailSender.init_app`. El usuario aceptó que no haya test de `init_app`, y verify se cerró sin la prueba manual, así que el único camino real de producción no se ha ejecutado nunca. Además, la petición sale con el `User-Agent` por defecto de `urllib` (`Python-urllib/3.x`), que algunos WAF delante de las APIs bloquean con un 403. Si pasa eso, todas las solicitudes de cuentas reales darían 503. Se recomienda añadir una cabecera `User-Agent` explícita (por ejemplo `fitnerd-backend`) y hacer una prueba manual con una cuenta real tras desplegar (ya figura en el plan, §6). | implementer |
| F3 | MENOR | `backend/services/password_reset_service.py:123-147` | `reset_password` lee la fila del token sin bloquearla. Dos peticiones simultáneas con el mismo token ven las dos `used_at IS NULL` y las dos cambian la contraseña (gana la última). Esto rompe el "uso único" (AC-007.3) en condiciones de carrera. El impacto es bajo, porque solo afecta a quien ya tiene el token. Se arregla con `.with_for_update()` en `PasswordResetRepository.get_by_token_hash` (`password_reset_repository.py:36-38`) o con un `UPDATE … WHERE used_at IS NULL` condicional. | implementer |
| F4 | NIT | `backend/models/password_reset_request.py:19` | `client_ip` es `String(45)`, y su valor viene de `request.remote_addr` tras `ProxyFix`. Con la cadena actual (Caddy reescribe `X-Forwarded-For`) siempre es una IP válida. Pero si cambia la infraestructura y se confía en un `X-Forwarded-For` del cliente, un valor de más de 45 caracteres provocaría un `DataError` y un 500. Se podría truncar o validar la IP en la ruta o el servicio. | implementer |
| F5 | NIT | `backend/tests/test_services/test_password_reset_service.py:487` | El marcador `# SDD: REQ-009 AC-008.4` es incoherente: AC-008.4 pertenece a REQ-008, y el test prueba la regla de precedencia de la spec, §6. Ya lo señaló el verify-report. Se debería marcar `# SDD: REQ-008 REQ-009` o similar. | test-author |
| F6 | NIT | `frontend/src/features/auth/hooks.ts:55` | Comentario sin tilde ("asi que" en vez de "así que"). La CLAUDE.md pide comentarios en español correcto. Las docstrings de los tests también van sin tildes, pero eso lo aceptó el usuario en el gate de tests. | implementer |
| F7 | NIT | `frontend/src/features/auth/components/LoginForm.tsx:25-26` | El aviso "Contraseña actualizada…" depende de `location.state`, que el navegador conserva en el historial. Sigue visible si el usuario recarga `/login` o vuelve atrás después. Es cosmético. | implementer |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. F1 a F3 son MENORES y se pueden corregir ahora o diferir a una tarea futura con aprobación del usuario. F1 y F2 conviene resolverlos antes del despliegue a producción, o al menos dejarlos en la documentación de despliegue (doc-keeper).

Observaciones para el orquestador, que no son hallazgos de código:
- Los dos archivos de test del backend con la corrección de formato siguen **sin commitear**. Deben entrar en el siguiente commit aprobado.
- El incidente de verify (la CLI `flask` sin `FLASK_ENV` carga `ProductionConfig` y apunta a Supabase) es preexistente. El doc-keeper debe documentarlo. Conviene confirmar con el usuario que también se borró el **usuario de prueba** que se registró en producción; el historial solo menciona el downgrade de la tabla.

## Comentarios del usuario
Gate de review, iteración 1 (2026-10-05). Copiado literalmente por el orquestador:

> 1. Aceptados como lo propones. 2. No es necesario borrar nada ya que nunca se creo dicho usuario, yo utilice uno que ya tenia en la bd desde antes de hacer el feature. 3. Si. 4. Si

Propuesta del orquestador que el usuario acepta ("como lo propones"):
- **F1:** se acepta. El doc-keeper lo incluye como paso obligatorio de la checklist de despliegue (`FRONTEND_BASE_URL=https://fitnerd.betofallas.dev` en el `backend/.env` de EC2).
- **F2:** se acepta. Prueba manual del envío real con Resend tras desplegar, también en la checklist de despliegue.
- **F3** (bloqueo de la fila del token en `reset_password`) y **F7** (aviso persistente tras recargar `/login`): tareas futuras.
- **F4, F5, F6:** se aceptan sin cambios.

Nota del orquestador para la etapa docs: durante la prueba manual de verify se detectó que `flask run` / `flask db …` sin `FLASK_ENV` cargan `backend/wsgi.py`, que usa `ProductionConfig` por defecto (base de datos de producción). Es una trampa preexistente que conviene documentar (instrucciones de entorno local: `FLASK_ENV=development`).
