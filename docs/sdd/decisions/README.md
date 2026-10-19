# Decisiones (ADRs) de fitnerd

Formato breve: contexto, decisión y consecuencias. Las ADRs que generen futuras features siguen la misma numeración. Las ADR-0001 a 0013 y la 0023 describen el harness propio, ya retirado (ADR-0024): citan rutas que solo existen en el historial de git.

| ADR | Decisión |
|---|---|
| [0001](ADR-0001-orquestacion.md) | Orquestador en la sesión principal (skills `/sdd-*`), sin anidamiento de subagentes |
| [0002](ADR-0002-formato-requisitos.md) | Requisitos híbridos: historia de usuario, REQ en EARS y AC en Given/When/Then |
| [0003](ADR-0003-estructura-artefactos.md) | `specs/NNN-slug/` con spec, plan, tasks, verify-report, review y state.json |
| [0004](ADR-0004-gates-humanos.md) | Gate humano en cada etapa; 3 iteraciones de corrección antes de escalar |
| [0005](ADR-0005-tdd-estricto.md) | TDD estricto con verificación del rojo |
| [0006](ADR-0006-modelos-por-agente.md) | opus: spec, plan y review · sonnet: tasks, tests e impl · haiku: verifier |
| [0007](ADR-0007-integracion-git.md) | Rama `feat/NNN-slug` y un commit por etapa, solo desde el orquestador |
| [0008](ADR-0008-enforcement-hooks.md) | Hooks Node: guardia de rol y ruta, guardia de etapa y `ask` en commit/push |
| [0009](ADR-0009-ruff-backend.md) | ruff para el backend, solo sobre archivos cambiados |
| [0010](ADR-0010-harness-propio.md) | Harness propio con ideas de Spec Kit y Kiro (Sustituida por la 0024; harness retirado) |
| [0011](ADR-0011-doc-keeper.md) | Agente `doc-keeper` y etapa `docs` entre review y close |
| [0012](ADR-0012-scaffold.md) | Paso de andamiaje (`implementer` en modo scaffold) antes del red check |
| [0013](ADR-0013-claude-md-proyecto.md) | `CLAUDE.md` con sección Proyecto, mantenida por el `doc-keeper` |
| [0014](ADR-0014-correo-transaccional.md) | Correo transaccional con Resend (API HTTP, sin SDK) detrás de un `EmailSender` con transportes `resend`, `console` y `memory` (Aceptada) |
| [0015](ADR-0015-ip-cliente-proxyfix.md) | IP del cliente con `ProxyFix(x_for=PROXY_FIX_X_FOR)`: 1 en producción (Caddy), 0 en desarrollo y 1 fijo en tests (Aceptada) |
| [0016](ADR-0016-cd-backend.md) | CD del backend: job `deploy` tras los tests, AWS SSM Run Command con OIDC, sin migraciones automáticas; cambios de CI/CD en ramas `chore/…` sin SDD completo (Aceptada) |
| [0017](ADR-0017-observabilidad-langfuse.md) | Observabilidad del coach: puerto `Tracer` con recorder autoprotegido y adaptador `LangfuseTraceBackend` sobre el SDK oficial `langfuse>=4.17,<5` (endpoint OpenTelemetry, `propagate_attributes` en `with` cortos por observación, `base_url`, exportación en los hilos del SDK) (Aceptada) |
| [0018](ADR-0018-feedback-id-firmado.md) | `feedback_id` del coach sin estado: `<trace_id>.<HMAC-SHA256(SECRET_KEY, user_id y trace_id)>`, sin tabla ni Redis y sin caducidad (Aceptada) |
| [0019](ADR-0019-perfil-de-usuario.md) | Perfil de usuario en `user_profiles` (1:1, en la unidad del usuario), onboarding en `users.onboarding_completed_at`, edad derivada de `users.date_of_birth` y caché de TanStack Query vaciada al cambiar de sesión (Aceptada) |
| [0020](ADR-0020-una-medicion-por-dia.md) | Una medición por usuario y día (restricción única y combinación en el servicio, con bloqueo de la fila del usuario), peso del perfil sincronizado en el servidor con la última medición de peso y consolidación de duplicados en la migración (Aceptada) |
| [0021](ADR-0021-contexto-del-analisis-desde-el-cliente.md) | Análisis de progreso: indicadores y calorías calculados y formateados en el cliente (misma función que pinta Métricas), perfil y edad leídos en el servidor, y sugerencia de calorías calculada en el servidor y devuelta en la respuesta (Aceptada) |
| [0022](ADR-0022-marcador-sdd-con-numero-de-spec.md) | Marcador de trazabilidad con el número de spec (`SDD: 011 REQ-006 AC-006.1`), obligatorio desde la 011; los marcadores antiguos sin número siguen siendo válidos (Aceptada) |
| [0023](ADR-0023-tareas-docs-y-bloqueos-del-hook.md) | Tareas `(docs)` fuera de `verify` (las marca el `doc-keeper`, el Art. 9 las exige al cerrar) y prohibición de esquivar un bloqueo del hook con Bash (Aceptada) |
| [0024](ADR-0024-adopcion-sdd-beto.md) | Adopción del plugin `sdd-beto` en modo `flow`: config en `.sdd/config.json`, constitución en dos partes (`.sdd/constitution.md`), ratchet de ruff del plugin y retirada del harness propio en un `chore/…` aparte (Aceptada) |
| [0025](ADR-0025-correo-canonico-en-minusculas.md) | Correo canónico `strip().lower()` con búsqueda por `lower(email)`, migración de datos que falla sin tocar nada ante correos que solo difieren en mayúsculas, enlace de restablecimiento leído con `FOR UPDATE` y verificador de Google inyectado en `AuthService` |
| [0026](ADR-0026-carga-de-pantallas-bajo-demanda.md) | Pantallas, `OnboardingRoute`, `OnboardingGuard` y `AppLayout` cargadas bajo demanda con `React.lazy` (`lazyNamed`) y un `RouteSuspense` por ruta (error boundary propio con «Recargar» y `Suspense` con «Cargando…»), sin `manualChunks` ni cambiar el umbral de Vite (Aceptada) |
| [0027](ADR-0027-garantia-de-correo-canonico-con-check.md) | Correo canónico garantizado en la base con restricciones `CHECK` (`users` y `password_reset_requests`) declaradas también en el modelo, en lugar de un índice único funcional; migración `e5b7d9f1a3c6` que convierte los datos, falla sin tocar nada ante conflictos y cuyo `downgrade` solo quita las restricciones (Aceptada) |
| [0028](ADR-0028-reloj-de-la-app-y-configuracion-de-produccion.md) | Reloj por app en `app.extensions` (`AdjustableClock` solo con `TESTING`, `utc_now` real en el resto), `create_app(config_name, config_overrides)` y `FRONTEND_BASE_URL` validada al arrancar en producción (obligatoria y con `https://`) (Propuesta) |
