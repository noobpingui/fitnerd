# Backlog

## 002–013 · Remanentes de las specs anteriores al backlog por feature (2026-10-18)

Estas specs no tienen `backlog.md` propio; los puntos salen de los hallazgos MENOR y NIT diferidos en sus `review.md`. Se dejaron fuera los ya resueltos por specs posteriores (por ejemplo, la carrera del token de reset y el aviso de `/login` por la 014, el User-Agent de Resend por la 003, los logs saneados por la 014, el desbordamiento de enteros enormes y el ritmo fuera de rango por las 011 y 014, la sincronización del peso con fechas pasadas por la 016, y los marcadores `SDD:` ambiguos por el ADR-0022).

**002-forgot-password** · [specs/002-forgot-password/](../specs/002-forgot-password/)
- [ ] MENOR: `ProductionConfig` hereda `FRONTEND_BASE_URL` con `http://localhost:5173` por defecto (`backend/config.py:61`); si falta en el `.env` de EC2, los correos llevan enlaces a `localhost` sin error. Poner un valor propio de producción o fallar al arrancar.
- [ ] MENOR: ningún test ejecuta `ResendTransport` ni `EmailSender.init_app`; el camino real de producción solo se ha probado a mano.
- [ ] NIT: el marcador `# SDD: REQ-009 AC-008.4` de `test_password_reset_service.py` es incoherente (AC-008.4 es de REQ-008).

**003-resend-user-agent** · [specs/003-resend-user-agent/](../specs/003-resend-user-agent/)
- [ ] NIT: docstrings y comentarios sin tildes en `tests/fakes.py`, `test_email_sender.py` y `test_password_reset_routes.py:522`.
- [ ] NIT: AC-001.2 se prueba con `FakeOpener`, que no pasa por el `OpenerDirector` real; un test con `urllib.request.build_opener(FakeHandler())` demostraría que no hay un segundo `User-Agent`.

**004-coach-observability** · [specs/004-coach-observability/](../specs/004-coach-observability/)
- [ ] MENOR: test de ruta para AC-N001.1 (privacidad).
- [ ] MENOR: import perezoso de `langfuse` en la primera pregunta y aviso repetido si falla la fábrica.

**005-coach-feedback** · [specs/005-coach-feedback/](../specs/005-coach-feedback/)
- [ ] MENOR: el test de AC-N002.1 (`test_langfuse_backend.py:401`) retrasa solo `flush`, no `create_score`; no demuestra que la 204 llegue en menos de 0,5 s con un destino lento. Añadir un retardo en `create_score` del fake o documentar la limitación.
- [ ] NIT: en el test de servicio de AC-N001.1 (`test_coach_feedback.py:489`) el JWT es una constante que nunca llega al servicio, así que la comprobación es tautológica (el test de ruta sí cubre el JWT real).
- [ ] NIT: falta una tilde en un comentario de `coach_service.py:66` («de quién es cada contador»).

**006-user-profile** · [specs/006-user-profile/](../specs/006-user-profile/)
- [ ] NIT: `body-metrics/dateUtils.ts` reexporta `parseLocalDate` y `todayIsoDate` solo por compatibilidad; importar directamente desde `@/lib/dates` y quitar la reexportación.
- [ ] NIT: el texto «Indica tu fecha de nacimiento» de `PhysicalDataForm.tsx` no figura en la spec ni lo cubre ningún test.

**007-macros-calculation** · [specs/007-macros-calculation/](../specs/007-macros-calculation/)
- [ ] NIT: `MIN_TARGET_KCAL` sin anotación de tipo en `macros/calculations.ts:34` (`Record<"male" | "female", number>` por coherencia).
- [ ] NIT: casts innecesarios `as Record<string, string>` en `calculations.test.ts` (líneas 98, 111 y 240).
- [ ] NIT: en `spec.md` de la 007, AC-004.5 aparece antes que AC-004.4.

**008-metrics-from-profile** · [specs/008-metrics-from-profile/](../specs/008-metrics-from-profile/)
- [ ] NIT: el aviso «No se pudo borrar la medición…» de `MetricsHistory.tsx` solo se limpia al abrir otro diálogo de borrado.
- [ ] NIT: docstrings sin tildes en `test_body_metric_routes.py` («unicas», «restriccion», «medicion», «invalido»).

**009-metrics-indicators** · [specs/009-metrics-indicators/](../specs/009-metrics-indicators/)
- [ ] MENOR: la conversión ft/in a cm está duplicada en `macros/calculations.ts:78`.
- [ ] NIT: comentario desplazado en `TrendChart.tsx`.
- [ ] NIT: `renderLoaded` de `BodyMetricsPage.test.tsx` (líneas 376-380) espera con un número mágico de microtareas; esperar una condición observable del perfil cargado.

**010-progress-analysis-context** · [specs/010-progress-analysis-context/](../specs/010-progress-analysis-context/)
- [ ] MENOR: los tests de validación del cuerpo llevan marcadores `SDD:` de AC que no prueban (`test_progress_analysis_service.py:789-824`, `test_progress_analysis_routes.py:187`); inflan la trazabilidad.
- [ ] NIT: `InsightsInput` y `input as Insights` en `insightsView.ts:77-81` abren un agujero de tipos solo para acomodar el cast del test.
- [ ] NIT: comentarios con regionalismos o sin tildes («503 prolijo», «errores tecnicos», «se envia») en `progress_analysis_service.py:144`, `ProgressAnalysis.tsx:40` y `api.ts:41`.
- [ ] NIT: `analysisRequest.ts:39-40` repite `hasRate && rate.kind === "ok"`; usar una variable estrechada.
- [ ] NIT: tras un despliegue, una pestaña con el bundle anterior recibe 400 en el análisis hasta recargar (transitorio; basta una nota en docs).
- [ ] NIT: el encabezado de `spec.md` de la 010 dice «47 AC» y el cuerpo tiene 49.

**011-analysis-extreme-pace** · [specs/011-analysis-extreme-pace/](../specs/011-analysis-extreme-pace/)
- [ ] La corrección +10,8 → +10,9 no debe aplicarse a la spec (recordatorio de la review; no requiere acción salvo que alguien la proponga).

**012-remove-catalog** · [specs/012-remove-catalog/](../specs/012-remove-catalog/)
- [ ] NIT: la fecha legal (`updatedAt`) de `PrivacyPolicyPage.tsx` y `TermsOfServicePage.tsx` sigue en «14 de octubre de 2026»; ajustarla al día en que se publique un cambio legal real.

**013-polish-006-010** · [specs/013-polish-006-010/](../specs/013-polish-006-010/)
- [ ] NIT: `test_source_cleanup_013.py:103,125-127` tiene aserciones que nunca pueden fallar y una condición enrevesada; no comprueba que cada test cite su AC (sustituir el bucle por un diccionario nombre-a-marcador).
- [ ] NIT: sangría incorrecta en el objeto de opciones de `findByRole` de `MetricsHistory.test.tsx:685-688`.
- [ ] NIT: el test de F3 de `MetricsHistory.test.tsx:739` lleva `// SDD: 013 NFR-001`, sin AC; trazarlo como `REQ-005 AC-005.2`.
- [ ] NIT: caso límite en `MetricsHistory.tsx:163`: si la fila a borrar desaparece por otra vía y la petición falla, se muestra el aviso igualmente.

## 014-auth-hardening · Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados (2026-10-16)

Feature: [specs/014-auth-hardening/](../specs/014-auth-hardening/)

- [x] Traducir al español los mensajes "Wrong Credentials" y "Email already registered" (spec 018).
- [x] Validar en el servidor el nombre, el apellido y la fecha de nacimiento del registro, y responder bien a un cuerpo que no sea JSON (spec 018).
- [ ] En la tabla de solicitudes de restablecimiento puede haber filas antiguas con correos en mayúsculas; no se tocan porque solo cuentan para el límite de 2 minutos.
- [ ] Recortar los espacios de los correos ya guardados (la migración solo los pasa a minúsculas).
- [ ] Índice único funcional o CHECK `email = lower(email)` como garantía en la base una vez migrados los datos.
- [x] (spec 018) Un cuerpo que no sea JSON en `/register` y `/login` (`request.get_json()` devuelve None) y un `date_of_birth` ausente siguen dando 500 (fuera de alcance según la spec).
- [ ] Las contraseñas antiguas de más de 72 bytes, truncadas por el bcrypt antiguo, ya no pueden entrar con login (401) y tendrán que restablecerse.
- [ ] Opcional: unitarios directos de `escape_log_text` más allá del que ya hay.
- [ ] `lower()` de Postgres y `str.lower()` de Python difieren en letras no ASCII (anotado en ADR-0025).
- [ ] Tildes en textos de tests anteriores a la spec 014 (p. ej. test_password_reset_service.py, docstring de FakePasswordResetRepository).
- [ ] Textos sin tilde anteriores a la 014 en los tests de autenticación y reset, y en los tests de `LoginForm` y `ForgotPasswordForm` ("exito", "peticion", "contrasena"...).
- [ ] Si el implementer cambia `type="email"` o añade `noValidate`, revisar `fireEvent.submit` en `RegisterForm.test.tsx`.
- [x] Prueba manual en navegador real de AC-011.3 y AC-011.4 (aviso de /login y botón atrás).
- [x] (spec 018) NIT (implementer): `_ensure_link_is_usable` lee `self.clock()` en cada llamada en lugar de usar un solo `now`, como pide el plan §3.3 (password_reset_service.py:125,154).
- [ ] NIT (implementer): la comprobación de `user is None` llega después de tomar el FOR UPDATE; es inofensivo (password_reset_service.py:150-152). Repetido en la sección 018; se resuelve una sola vez.
- [x] ADR-0025 sigue por pasar a "Aceptada" (el usuario la aprobó en la review; las ADRs no son del doc-keeper).
- [x] La fila "pendiente" del historial del runbook hay que completarla (PR, fecha y volcado) tras el despliegue.

## 015-onboarding-profile-rhf · Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod (2026-10-16)

Feature: [specs/015-onboarding-profile-rhf/](../specs/015-onboarding-profile-rhf/)

- [x] Mensaje específico para las pulgadas fuera de rango en el perfil (p. ej. "Entre 0 y 11 in").
- [ ] Valorar un test de escaneo del código (como `sourceCleanup013`) que impida reintroducir `validation.ts` o `useState` en estos formularios.
- [ ] Si más formularios necesitan errores visibles desde la carga, documentar el patrón de `fieldMessages` síncrono en un ADR.
- [ ] Mediciones con fecha pasada desde el perfil (fuera de alcance de la spec).
- [x] Los tests nuevos de `OnboardingPage.test.tsx` repiten algunas pruebas de fecha que ya existen con el marcador 006 (por ejemplo, la fecha prerrellenada de 1900). Se pueden simplificar cuando se cierre la feature.
- [ ] Los tests de fecha de `ProfilePage.test.tsx` (reglas de validación de la 015) comprueban 14 y 100 años con `fireEvent.change` sobre el `input type=date`. Un test de integración con un navegador real sería más fiel, pero queda fuera de Vitest.
- [x] Warnings previos `only-export-components` en components/ui/form.tsx:159 y components/ui/button.tsx:64 (no tocados por la feature).
- [x] Hay un archivo sin trackear `.claudecodeignore` en la raíz del repo que no creó esta feature; decidir si se versiona, se añade a .gitignore o se borra.
- [x] Valorar mover inRange a una utilidad compartida en src/lib (hoy body-metrics la importa de onboarding/schemas, que la documenta como regla del onboarding).

## 016-past-date-measurements · Registrar mediciones corporales con fecha pasada (incluye 008 F2) (2026-10-17)

Feature: [specs/016-past-date-measurements/](../specs/016-past-date-measurements/)

- [ ] Inyectar un reloj configurable en la app para los tests de rutas, si hacen falta fechas absolutas (hoy usan fechas relativas).
- [ ] Mostrar un error o reintento si falla la relectura de mediciones o del perfil tras registrar (hoy no se vería el aviso de REQ-009).
- [ ] Desplegar el Historial ("Mostrar más") hasta la medición recién registrada (fuera de alcance de la spec).
- [ ] Test de extremo a extremo de la sincronización del peso del perfil: los tests de la página comprueban el valor que devuelve `getProfile` mockeado.
- [ ] Revisar los tests de orden de AC-003.4 si las filas de mediciones superan el tamaño de página del Historial (hoy usan 3 filas).
- [x] (spec 017, ADR-0026) Chunk de frontend de 1,087 kB (>500 kB) en el build; no bloquea.

## 017-frontend-polish · Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests (2026-10-18)

Feature: [specs/017-frontend-polish/](../specs/017-frontend-polish/)

- [ ] Distinguir en el boundary un error de render de un fallo de descarga, si hiciera falta.
- [ ] Comentarios sin tilde y con voseo en router.tsx, router.test.tsx, AppLayout.tsx, ProtectedRoute.tsx y setup.ts (fuera de alcance; solo se corrigen los que se toquen).
- [ ] Valorar LazyMotion de motion si el chunk de entrada vuelve a crecer.
- [ ] Si la implementación cambia el orden de los tests de lazyRoutes.test.tsx, el test de "Cargando…" debe seguir siendo el primero (cache de React.lazy).
- [ ] Añadir AC-001.5 (caso «pies no válidos manda Entre 3 y 8 ft») y AC-N002.4 (configuración de lint) a plan.md, sección 5, «Pasan ya en verde», para que el registro coincida con la aceptación del usuario.
- [ ] Los tests de AC-002.2 a AC-002.4 (lazyRoutes) siguen verdes antes de la carga diferida y no prueban que el chunk no se descargue hasta navegar: añadir esa comprobación en verify o en tests.
- [ ] ResetPasswordForm.test.tsx (fuera del alcance de la 017, que solo cubre LoginForm y ForgotPasswordForm) tiene «boton», «peticion» y «esta en curso» en comentarios o nombres de test (Art. P2 General).
- [ ] Los «Cargando…» encadenados (guard, layout y pantalla) siguen en la primera visita a una ruta protegida; es consecuencia del ADR-0026 (F6 resuelto solo con `className`, sin precargar el layout).
- [ ] Añadir un test del envío correcto de FeedbackForm (elegir categoría y mensaje, 201 y onSuccess) y otro del mensaje de error del servidor, con una utilidad para manejar el Select de Radix.
- [ ] F11 (test-author): `FeedbackForm.test.tsx:42-44` comprueba el error de categoría contando los textos «Elige una categoría» (placeholder y mensaje de error), lo que es frágil. Sería mejor localizar el `FormMessage` del campo.

## 018-auth-robustness · Endurecer /register y /login: 400 ante entradas inválidas, validación del registro y mensajes en español (2026-10-18)

Feature: [specs/018-auth-robustness/](../specs/018-auth-robustness/)

- [ ] Validar también en el formulario del frontend la edad de 14 a 100 años y los nombres en blanco o de más de 100 caracteres.
- [ ] /api/auth/google: responder a cuerpos no JSON y traducir al español «Invalid Google token» y «Google email not verified».
- [ ] Otros mensajes de autenticación que siguen en inglés (/me, token ausente o caducado).
- [ ] Restablecimiento de contraseña: comprobar que el usuario del enlace existe antes de bloquearlo; es un NIT de la review de la spec 014, sin efecto observable.
- [ ] MENOR: `frontend/src/features/auth/components/LoginForm.test.tsx` sigue simulando «Wrong Credentials», un texto que el servidor ya no devuelve; pasarlo al mensaje nuevo.
- [ ] MENOR: el mensaje por defecto de `ConflictError` en `backend/exceptions/custom_exceptions.py:8` sigue en inglés («Email already registered»), y el de `AuthenticationError` también; traducirlos o quitar el valor por defecto.
- [ ] NIT: `utc_now` está duplicado en `profile_service.py` y `password_reset_service.py` (y `auth_service.py:22` lo importa del primero); dejar una sola en un módulo de reloj.
- [ ] NIT: en `backend/tests/test_services/test_auth_service.py` hay dos marcadores `SDD:` que apuntan a AC poco relacionados (:573 y :528), y `timedelta` se importa dentro de la función en :134.
- [ ] `tests/fakes.py` y los archivos de test existentes tienen finales de línea CRLF (en `fakes.py`, mezclados con LF). Conviene normalizarlos.
- [ ] AC-005.4 y AC-005.5 en integración dependen del día UTC real y podrían fallar justo al cruzar la medianoche UTC; las fronteras exactas ya están cubiertas en unitarios con reloj fijo.
- [ ] El `state.json` y `tasks.md` dicen 45 AC, pero `spec.md` tiene 44 IDs únicos; revisar el recuento (sin impacto).
