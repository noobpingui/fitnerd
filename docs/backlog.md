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

## 019-auth-email-integrity · Garantizar la integridad de los correos guardados: recorte de espacios y restricción en la base (2026-10-18)

Feature: [specs/019-auth-email-integrity/](../specs/019-auth-email-integrity/)

- [x] (chore/019-post-deploy-docs) ADR-0027 y su fila en `docs/sdd/decisions/README.md` siguen en «Propuesta»: el hook impidió pasarlas a «Aceptada» en close. Hacerlo en una rama `chore/…` tras el merge.
- [ ] Riesgo aceptado (Q2): un correo con letras no ASCII o con espacios Unicode que `str.strip()` quita y `[[:space:]]` puede no cubrir podría ser rechazado por la CHECK y dar 500 en el registro; valorar rechazarlos en `validate_email`.
- [ ] Simplificar `UserRepository.get_by_email` a una igualdad exacta (con la CHECK activa equivale y usa el índice de `email`).
- [ ] Revisar si los tests de la 014 de «cuentas antiguas con mayúsculas» siguen teniendo sentido una vez aplicada la 019 en todos los entornos, junto con el `lower()` de `get_by_email`.
- [ ] NIT: la migración repite la expresión en `CANONICAL_EMAIL_SQL` y `CANONICAL_EMAIL_EXPR`; derivar una de la otra.
- [ ] NIT: `op.get_bind()` impide el modo offline (`--sql`), igual que en la 014.
- [ ] NIT: no hay test de que se recorten tabuladores ni saltos de línea con `[[:space:]]`.
- [ ] NIT: «INTEGRACION» sin tilde en `test_canonical_email_routes.py:1`; el plan y `state.json` dicen «23 AC» y la spec tiene 21.
- [ ] Definir qué rol pasa las ADR a «Aceptada» en la etapa close (el hook role-guard bloquea al planner fuera de plan).
- [x] (chore/019-post-deploy-docs) Completar la fila «pendiente» del historial del runbook (PR, fecha, backup) tras el despliegue.
- [ ] `tests/fakes.py` y otros tests con CRLF mezclado: ya anotado en la 018.

## 020-metrics-followups-prod-config · Seguimiento de métricas corporales y configuración de producción (2026-10-19)

Feature: [specs/020-metrics-followups-prod-config/](../specs/020-metrics-followups-prod-config/)

- [ ] Aviso de relectura fallida con «Reintentar» al corregir o borrar una medición (Q1).
- [ ] Desplazar la pantalla hasta la fila nueva del Historial o resaltarla (Q3).
- [ ] Pruebas en navegador real con el backend levantado, por ejemplo con Playwright (Q4).
- [ ] Que producción no arranque si `MAIL_BACKEND=resend` y falta `RESEND_API_KEY` (Q7).
- [ ] Validar `FRONTEND_BASE_URL` como URL completa (hoy basta con el prefijo `https://`).
- [ ] Al registrar en lb, el peso del perfil puede variar en 0,1 lb respecto a lo escrito (160 lb pasa a 160,1) por el redondeo a 0,1 kg del envío.
- [ ] Con `isLoadingError`, un fallo de relectura en segundo plano que no viene de un registro ya no muestra ningún aviso en Métricas ni en el perfil; valorar un aviso general.
- [ ] Con el aviso de relectura visible y una medición posterior a hoy, el aviso de fecha futura (spec 016) solo se calcula al reintentar correctamente.
- [ ] F4 (NIT, test-author): el marcador de `BodyMetricsPage.sync.test.tsx:209` dice `NFR-002 AC-004.1` y debería decir `REQ-004 AC-004.1`.
- [ ] F5 (NIT, test-author): `round1` de `fakeMetricsServer.ts` redondea en binario, mientras el servidor usa `Decimal` half-up; pueden divergir en valores frontera.
- [ ] F6 (NIT, test-author): `app_clock` no es autouse, y `make_app` solo repone `email_sender`, no los demás singletons.
- [ ] F7 (NIT, planner): pasar la ADR-0028 a «Aceptada» en la ADR y en el índice de `docs/sdd/decisions/README.md` (pendiente: rama `chore/…` tras el merge).
- [ ] F8 (NIT, implementer): `auth_service`, `body_metric_service` y `progress_analysis_service` deberían importar `utc_now` de `utils.clock`, no del reexporte de `profile_service`.
- [ ] F9 (MENOR, test-author): ningún test comprueba que, tras guardar solo la meta con el aviso visible, un «Reintentar» correcto conserva la meta nueva (`PhysicalDataForm.refresh-edge.test.tsx:128-146`).
- [ ] F10 (NIT, implementer): con `keepDraft` se ve «Cambios guardados» mientras el formulario tiene ediciones sin guardar (`PhysicalDataForm.tsx:221,230`).
- [ ] F11 (NIT, implementer): `retryRefresh` usa un `dirty` obsoleto del render en que se pulsó; si el usuario edita mientras la relectura está en curso, esa edición se descarta (`PhysicalDataForm.tsx:226-230`).
- [ ] Alinear los marcadores SDD de los tests de F1 y F2 (`AC-002.5` y `AC-002.6`, aproximados) con un AC propio o dejarlos como casos fuera de spec.
- [ ] Normalizar a LF tres archivos de test que están en CRLF en la copia de trabajo (`test_auth_routes.py`, `test_body_metric_routes.py`, `MetricsHistory.test.tsx`).
- [ ] `test_fixed_clock_routes.py` usa `X-Forwarded-For` fijo (203.0.113.50) en `forgot`; con más tests de restablecimiento ahí, usar una IP por test para evitar el límite de 3 por IP.
- [ ] Los 31 tests de caracterización de la excepción al Art. B5.2 (REQ-004 y REQ-007, entre otros) pasaron sin implementación por decisión del usuario; no hay nada que hacer salvo tenerlo en cuenta.
- [ ] Definir si las ADR pasan a «Aceptada» en una rama `chore/…` o en una etapa del flujo (ya anotado en la 019).

## Plan: registro de comidas con foto y datos de USDA (specs 021–025, numeración tentativa; renumerada el 2026-10-21 al insertar la 023) (2026-10-19)

Objetivo: que registrar macros sea simple. El usuario sube una foto, un modelo de visión (Amazon Bedrock) identifica los alimentos y estima las porciones, y los macros salen de los datos de USDA FoodData Central (el modelo no inventa números). El usuario confirma, corrige gramos, quita o añade alimentos y guarda la comida.

**Decisiones tomadas**
- Datos de USDA importados a Postgres con un script en `backend/scripts/` (fuera de la app, como el pipeline RAG). Conjuntos: Foundation Foods y SR Legacy (unos 86 MB en CSV sin comprimir); FNDDS en JSON (64 MB) si cabe. **Sin Branded Foods** (3,1 GB, no cabe en el plan gratuito de Supabase de 500 MB y exige reimportar cada mes) y **sin la API de USDA**: los datos son CC0, no se necesita clave ni caché. Atribución recomendada: «U.S. Department of Agriculture, Agricultural Research Service. FoodData Central» en el pie o en la página legal.
- Embeddings con **Voyage por su API directa** (como el coach); Bedrock **solo para visión**. Bedrock no ofrece Voyage como modelo de primera mano (solo por AWS Marketplace + SageMaker, con un endpoint de pago fijo). Los vectores de modelos distintos no son comparables y una columna pgvector tiene una sola dimensión.
- La foto **no se guarda** ni se registra: se procesa y se descarta.
- Orden **vertical**: cada spec lleva su backend y su frontend mínimo; backend primero dentro de cada una. Las pantallas no se diseñan contra datos inventados.

**021 · Base de alimentos USDA**
- Script de importación, tablas de alimento y de nutrientes por 100 g (calorías, proteína, carbohidratos, grasa), embeddings de Voyage en pgvector.
- `GET /api/foods/search?q=` con búsqueda híbrida (texto completo y similitud). Frontend mínimo: caja de búsqueda para validar la calidad.
- Cerrar en el plan: conjuntos que entran, nutrientes guardados, cómo se ejecuta el import en producción y cuánto ocupa, y si las descripciones de USDA (muy técnicas) necesitan una versión limpia para los embeddings. Lleva migración, que no se aplica sola.

**022 · Diario de comidas**
- Modelo de comida y de alimentos de la comida (alimento de USDA o personalizado, gramos, macros calculados **y guardados** para que el historial no cambie si se reimporta USDA). CRUD de comidas.
- Frontend completo: añadir alimento buscando, editar gramos, quitar, totales del día frente al objetivo de Macros. Alimento personalizado con macros a mano para lo que USDA no tiene (por ejemplo, gallo pinto).
- Reutilizar `backend/utils/clock.py` para el «día». Lleva migración.
- Deja un producto útil sin IA y construye la edición que reutilizará la 025.

**023 · Catálogo genérico de alimentos en español** (añadida el 2026-10-21)
- Tabla propia de unos 300 alimentos simples (un solo ingrediente, cocidos salvo lo que se come crudo), con nombres en español y macros de USDA por 100 g, que sustituye a USDA en la búsqueda del diario. Carga desde un CSV revisado por el usuario. Lleva migración.
- Sirve de lista cerrada para el análisis de imagen (024).

**024 · Análisis de imagen con Bedrock**
- `POST /api/meals/analyze` recibe una imagen y devuelve alimentos propuestos con el mismo formato que el diario: nombre, consulta canónica en inglés, gramos estimados, confianza, coincidencia de USDA y macros, o `sin_coincidencia` si no hay una buena.
- Validación de tipo y tamaño, rate limit en Redis (como el coach), trazas en Langfuse.
- ADR nuevo: modelo de Bedrock con visión y región (verificar en la consola), rol IAM de la instancia EC2, coste por imagen, umbral de coincidencia.
- Riesgo principal: la estimación de gramos desde una foto es poco precisa. Medirla con fotos reales antes de darla por buena.

**025 · Subir foto y confirmar**
- Subir o tomar una foto (cámara directa en móvil) con redimensionado en el cliente; estados de carga y error; pantalla de confirmación con gramos editables, confianza visible, quitar, añadir un alimento que falte (reutiliza la búsqueda del catálogo de la 023) y guardar. Alimentos sin coincidencia marcados.
- Si el análisis falla o devuelve una lista vacía, volver al registro manual.

**Dependencias:** 021 → 022 → 023 → 025, y 023 → 024 → 025. El contrato de salida de la 024 debe coincidir con los alimentos del catálogo de la 023.

**Fuera de alcance:** Branded Foods y la API de USDA, guardar fotos, edición avanzada de comidas pasadas, estadísticas semanales, varios platos en una foto, etiquetas nutricionales.

**Riesgos abiertos**
- [ ] Calidad de la búsqueda con las descripciones de USDA (021).
- [ ] Cobertura de comida local, que USDA no tiene (022, 023, 024).
- [ ] Disponibilidad y coste del modelo de visión en Bedrock (024).
- [ ] Límite de 500 MB de Supabase con los datos importados (021).

## 021-usda-food-database · Base de alimentos de USDA en Postgres con búsqueda híbrida (2026-10-20)

Feature: [specs/021-usda-food-database/](../specs/021-usda-food-database/)

- [ ] Decidir FNDDS en la 024 con el tamaño real medido tras esta importación.
- [ ] Dónde enlazar «Alimentos» en la navegación y añadir la atribución a la página legal (022).
- [ ] Un parámetro para elegir el número de resultados, si la 022 lo necesita.
- [ ] Calibrar `DEFAULT_MAX_DISTANCE`, y quizá pasar a lógica OR en el texto, según el resultado de la validación manual de las 20 consultas.
- [ ] Índice HNSW si se añaden FNDDS o Branded Foods.
- [ ] Volver a calcular todos los vectores si cambia `VOYAGE_EMBEDDING_MODEL`.
- [ ] Pausas o reintentos entre lotes de Voyage si los límites de uso hacen lenta la importación.
- [ ] El repositorio real de búsqueda (texto con `websearch_to_tsquery` y similitud con pgvector) solo se prueba a través de las rutas con Postgres. No hay tests unitarios propios de `FoodRepository` más allá de los de importación y rutas.
- [ ] Los tests de `FoodsPage` muestran un único error "not implemented" en la salida de vitest (el componente lanza al renderizar); se verificó el conteo (24 fallos).
- [ ] `foodsRoute.test.tsx` y `noFoodsLink.test.tsx`: parte de las aserciones lee el texto de `router.tsx`; válido como precondición en red, pero en verify las comprobaciones de comportamiento deben probar el AC.
- [ ] F6 (NIT): `frontend/src/app/foodsRoute.test.tsx:113`, el marcador AC-012.1 no corresponde con lo que prueba el test (onboarding pendiente); bastaría con REQ-012.
- [ ] «avena cocida» no devuelve avena en los primeros 5 (sí «avena» sola y «oats cooked»); las consultas en español de varias palabras son más débiles.
- [ ] El umbral 0,6 filtra poco: «xyzzy qwerty» y «zapato de cuero» devuelven 1 resultado absurdo cada una. Probar 0,5 o menos.
- [ ] Con `--yes` no se pide confirmación si se copia el comando a otro entorno.
- [ ] F12 (NIT, spec-writer): AC-001.8 no enumera «y» ni «yes», aunque el test marcado con ese AC los prueba; añadirlos al AC.
- [ ] F7 (NIT): dejar una sola cifra de AC (67) en las notas y en la documentación de la etapa docs.
- [ ] Pasar ADR-0029 de «Propuesta» a «Aceptada» (rama `chore/…` tras el merge, como en la 019 y la 020).
- [x] Aplicar en producción lo que documenta el runbook: migración `c8e2a4f6b9d3`, importación de USDA y medición real de `public.foods`; añadir la fila de la 021 al historial de despliegues. (hecho el 2026-10-20: 50 MB)

## 022-meal-diary · Diario de comidas con totales del día frente al objetivo de Macros (2026-10-20)

Feature: [specs/022-meal-diary/](../specs/022-meal-diary/)

- [ ] Biblioteca de alimentos personalizados reutilizables, y alimentos favoritos o recientes.
- [ ] Navegar entre días y editar días pasados desde la pantalla.
- [ ] Deshacer al quitar un alimento.
- [ ] Que el diario cambie solo de día al pasar la medianoche con la pantalla abierta.
- [ ] Decidir si /foods se retira o redirige a /diary.
- [ ] Medidas caseras y onzas, y el diario en kJ.
- [ ] Sacar a un componente compartido el bloque de estado de la búsqueda («Busca un alimento…», «Buscando…», sin resultados, error con «Reintentar»), que ahora se repite en FoodsPage y AddFoodDialog.
- [ ] Valorar ON DELETE CASCADE de users hacia meals (y body_metrics) cuando exista el borrado de cuentas.
- [ ] El diálogo de añadir guarda un alimento por petición aunque la API acepta varios; añadir varios de una vez puede llegar con la 025.
- [ ] Test de la migración b3d5f7a9c1e4 contra una base real (ahora solo hay revisión manual).
- [ ] Botón para borrar una comida entera desde la pantalla: la API ya tiene DELETE /api/meals/{id} y la pantalla no lo usa.
- [ ] Posible duplicación entre los helpers de `AddFoodDialog.test.tsx` y `DiaryPage.test.tsx`. Se podrían compartir en `src/test/` si crece.
- [ ] Decidir si las guardas de regresión (p. ej. /foods, voseo, contenido legal existente) cuentan como tests de feature o se mueven a un test de no regresión.
- [ ] `diaryRoute.test.tsx` comprueba el texto de `router.tsx` con expresiones regulares (lazyNamed, path="/diary"). Es frágil; valorar si conviene un test de comportamiento.
- [ ] Varios tests de la suite de rutas leen el JSON de una respuesta 404 en helpers (KeyError 'id'); al implementar, la causa desaparece, pero conviene que los helpers asserten el status antes de leer el cuerpo.
- [ ] Tests de fecha de legales: la comprobación «no es la del 2 de septiembre» (TermsOfServicePage, preexistente) es débil; pendiente de revisar en el backlog del proyecto.
- [ ] Opcional: mostrar «Guardando…» global o deshabilitar por fila el botón «Quitar», más allá del indicador `isRemoving` actual.
- [ ] Opcional: enlace a `/foods` desde el diálogo del diario, o retirar `/foods` más adelante (REQ-015 lo mantiene funcionando pero sin enlace).
- [ ] Corregir el número de AC de spec.md («86» frente a los 96 definidos) en la próxima edición de la spec o en el cierre.
- [ ] AC manuales para el gate de review: AC-014.2 (barra de calorías llena al superar el objetivo), AC-015.2 (barra inferior con 6 entradas en pantalla estrecha), AC-015.3 (estado activo de «Diario» en /diary).
- [ ] Revisar los fines de línea CRLF de 5 archivos de test (fakes.py, BottomTabBar.test.tsx, Navbar.test.tsx, PrivacyPolicyPage.test.tsx, TermsOfServicePage.test.tsx) antes del cierre; comprobar si el snapshot-check se hace por hash en disco.
- [ ] F6 (NIT, test-author): falta un test de que meals.updated_at avanza al añadir, editar o quitar alimentos (backend/models/meal.py:45-48), y otro de «-0» en el formulario personalizado (frontend/src/features/diary/schemas.ts:38).
- [x] Añadir la fila de 022 en la sección 8 del runbook al desplegar (hecho en `chore/022-deploy-history`).
- [ ] Aviso visual al superar un objetivo del diario (AC-014.2 hoy solo pide el texto «X por encima del objetivo» y la barra llena): cambiar la barra a ámbar, solo en calorías o en las cuatro. Sin alerta alarmista. Decidir con el usuario; cambia un comportamiento especificado, así que va por el flujo SDD.

## 023-generic-food-catalog · Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario (2026-10-21)

Feature: [specs/023-generic-food-catalog/](../specs/023-generic-food-catalog/)

- [ ] Retirar de `/api/meals` los alimentos de USDA por `fdc_id`, si se confirma que no se usan.
- [ ] Buscar mientras se escribe en el diálogo del diario.
- [ ] Categorías del catálogo y navegarlo sin escribir.
- [ ] Tolerancia a erratas y equivalencia entre singular y plural en la búsqueda.
- [ ] Decidir si se retiran la pantalla `FoodsPage` y su código cuando `/foods` ya redirija.
- [ ] Decidir si se retira `GET /api/foods/search` cuando ninguna pantalla lo use.
- [ ] Eventualmente la data de USDA se retirará cuando ya tengamos nuestra propia data (csv), y también se eliminará de donde se menciona, ya sea en Términos y en cualquier otra parte.
- [ ] Tolerancia a erratas en la búsqueda.
- [ ] Retirar los datos de USDA y sus menciones (Términos y demás) cuando el catálogo propio los sustituya (nota del usuario).
- [ ] Pasar la coincidencia de la búsqueda a Postgres si el catálogo crece mucho más allá de 350 alimentos.
- [ ] Retirar `FoodsPage`, `FoodResultList` y `useFoodSearch` cuando se confirme que no se usan (ya sin ruta).
- [ ] Revisar en la review las filas `manual` del CSV y sus referencias.
- [ ] Anotar en el runbook que, entre el CD y la carga del catálogo, la búsqueda del diario está vacía.
- [ ] Verificar en la verificación que el chunk de entrada de `npm run build` sigue por debajo de 500 kB (ADR-0026).
- [ ] Revisión manual de la migración `d4f6a8c0e2b5` frente a los modelos (Art. P2.4), a cargo del reviewer.
- [ ] Las filas `manual` del CSV las revisa el usuario en el gate de review.
- [ ] `diaryRoute.test.tsx` conserva en su cabecera la frase «`/foods` sigue mostrando "Alimentos"»; hay que limpiarla cuando se implemente T-137.
- [ ] La suite de la 021 (`features/foods`) y el endpoint `GET /api/foods/search` se conservan sin cambios, como indica la spec.
- [ ] Cambiar pytest.raises(RuntimeError) por una excepción concreta en test_an_error_while_writing_rolls_back_and_is_raised_again.
- [ ] Revisar en la fase de implementación si los tests de constantes del esqueleto deben seguir existiendo o pasar a ser parte del test de comportamiento.
- [ ] Revisar los marcadores de las guardas 021/022 re-marcadas como 023 (test_meal_routes::test_post_validation_message_and_nothing_saved, foodsRoute, noFoodsLink).
- [ ] Los errores de `tsc -b` por `catalog_id` en `diary/schemas.test.ts` desaparecen cuando el implementer actualice `diary/types.ts`.
- [ ] Los 3 tests de constantes retirados de `test_load_food_catalog_script.py` dejan la cobertura de AC intacta (67/67), pero conviene confirmar que `CANCEL_MESSAGE` y `DEFAULT_CATALOG_PATH` siguen cubiertos por los tests de flujo del script.
- [ ] La migración `d4f6a8c0e2b5` y el CSV `backend/scripts/data/food_catalog.csv` no existen aún (T-100, T-120 a T-123). Es lo esperado en red.
- [ ] Decidir si los 3 tests frontend y los 20 casos backend de guardas deben conservar el marcador 023 o pasar a 021/022, para que el criterio de rojo no dependa de la exclusión manual.
- [ ] Revisar el marcador de test_post_validation_message_and_nothing_saved: mezcla casos de la 022 con casos de la 023 bajo el mismo marcador.
- [ ] Los 6 errores de setup de test_food_catalog_csv.py dejarán de ser errores cuando read_catalog_csv exista; en verify, comprobar que pasan a verde con el CSV real.
- [ ] Algunos tests de comportamiento 023 sin marcador en la línea inmediata (marcador encima de decoradores) no aparecen en la trazabilidad automática; la cobertura por AC sí está completa.
- [ ] Q3: el ratchet de lint (`lint_ratchet` en `.sdd/config.json`) ejecuta ruff sobre cada archivo cambiado bajo los globs de producción del backend, incluido `backend/scripts/data/food_catalog.csv`. Informa de unas 1000 violaciones de sintaxis y E501, así que el ratchet sale con 1 solo por el CSV. Es una limitación del harness. Opciones: excluir los archivos de datos del ratchet, o mover el CSV fuera de los globs de producción.
- [ ] 4 violaciones E501 en archivos de test congelados (test_catalog_csv_reader.py, test_catalog_load_service.py, test_meal_rules.py y otro) vienen del test-author; el implementer no las tocó.
- [ ] Los sinónimos «dolfín» y «lampuga» de mahimahi, y algunos sinónimos regionales («zapote» para mamey, «tuna», «anona»), son suposiciones a partir del uso en Costa Rica y México. El reviewer debe revisarlos.
- [ ] Retirar las búsquedas por `fdc_id` de USDA de `/api/meals` y retirar `public.foods` cuando el catálogo sea estable (Q2 de la spec), más una biblioteca «mis alimentos» y recientes.
- [ ] Nota de migración para el doc-keeper: aplicar `d4f6a8c0e2b5` antes del merge y ejecutar `python -m scripts.load_food_catalog` de forma interactiva después del CD.
- [ ] Excluir backend/scripts/data/** (no Python) del ámbito prod y del ratchet de .sdd/config.json.
- [ ] Corregir las 7 E501 de los tests de 023 (o aceptarlas de forma explícita) antes del cierre; el implementer no puede tocarlas.
- [ ] Revisión manual del CSV del catálogo en el gate de review (reglas de contenido de la spec y 1 fila manual sin verificar).
- [ ] Los pasos de producción (migración d4f6a8c0e2b5 antes del merge y carga del CSV tras el CD) deben quedar en docs/deploy-runbook.md en la etapa docs (Art. P4).
- [ ] F2 MENOR: hay alimentos con dos versiones: zanahoria cruda y cocida, champiñones crudos y cocidos, y frijoles blancos y navy (CSV:166-167, 192-193, 24, 218).
- [ ] F3 MENOR: hay sinónimos con marca: «pan bimbo» (CSV:15) y «queso filadelfia» (CSV:105).
- [ ] F4 MENOR: «contramuslo de pollo» está en Pierna y debería ir en Muslo (CSV:46); «limonada sin azúcar» en Jugo de limón es otro alimento (CSV:265).
- [ ] F5 MENOR: hay nombres principales que no son español neutro: «Vainicas cocidas», «Frijoles navy cocidos» y «Calabaza butternut al horno».
- [ ] F6 MENOR: hay nombres que no corresponden al alimento de USDA: «Merluza» es pollock, «Róbalo» es striped bass y «Polenta» son grits blancos.
- [ ] F7 NIT: en Costa Rica y México, «limón» es la lima verde, y el catálogo da primero el limón amarillo (diferencia nutricional mínima).
- [ ] F8 NIT: sinónimos dudosos: «dolfín» no lo puedo verificar, «pinha» es portugués, «tuna» se confunde con atún en inglés y «fruta del pan jaca» mezcla dos frutas. «zapote», «anona» y «lampuga» son correctos.
- [ ] F9 NIT: «Puerro» y «Tempeh» están crudos, aunque normalmente se comen cocidos.
- [ ] F10 NIT: falta un espacio en `UsdaItemPayload ={` (frontend/src/features/diary/types.ts:34).
- [ ] F11 NIT: el mensaje del downgrade dice «Hay 1 alimentos…» (migración:95); si se corrige, hay que cambiar también `DOWNGRADE_MESSAGE` en `test_catalog_migration.py`.
- [ ] F12 NIT (test-author): el comentario de frontend/src/app/diaryRoute.test.tsx:2 sigue diciendo que `/foods` muestra «Alimentos».
- [ ] `state.json` muestra `max_iterations: 3`, pero la config vale 4.
- [ ] Retirar FoodsPage, FoodResultList y useFoodSearch, que ya no tienen ruta (ya está en el backlog).
- [ ] Runbook (P4): migración antes del merge y carga del catálogo tras el CD, en la etapa docs.
- [ ] Estos archivos siguen con la lista de 40 y la yuca, y hay que corregirlos (no los edité):
- [ ] backend/tests/test_services/test_food_catalog_csv.py: línea 15 (comentario «40 alimentos»), línea 26 («Yuca cocida» en MINIMUM_LIST), líneas 67-70 (`test_the_minimum_list_has_40_foods`, que comprueba == 40 dos veces; debe pasar a 39) y línea 115 (docstring «40 alimentos»).
- [ ] backend/scripts/data/food_catalog.csv: línea 37 (fila `yuca-cocida`, origen manual con fuente FNDDS). Según la decisión del usuario debe salir también del catálogo. Al quitarla quedan 264 filas, dentro del rango de 250 a 350, y ya no queda ninguna fila `manual`.
- [ ] specs/023-generic-food-catalog/plan.md: línea 530 («los 40 de la lista mínima» debe decir 39).
- [ ] specs/023-generic-food-catalog/tasks.md: línea 45, T-028 («con los 40 de la lista mínima» debe decir 39).
- [ ] specs/023-generic-food-catalog/verify-report.md: línea 49, que menciona la fila `yuca-cocida`. Se queda desactualizada cuando se vuelva a pasar la verificación.
- [ ] F5 (nombres que no son español neutro) y F6 quedan sin test automatizado; los comprueba la review.
- [ ] «contramuslo» debería ir en «Muslo de pollo al horno»; el test solo comprueba que no sea sinónimo de Pierna.
- [ ] Antes de la siguiente ronda, el test-author podría revisar el resto de tests del archivo para asegurar que cada uno falla sin el CSV corregido.
- [ ] Decidir cómo trata el harness los archivos de datos: al sacar `backend/scripts/data/` de los globs `prod` para que el ratchet de lint no analice el CSV, el role-guard tampoco deja escribirlo al implementer. El CSV lo editó el orquestador con autorización explícita del usuario.
- [ ] El implementer marcó las casillas T-120 a T-123 y T-125 de tasks.md con `sed -i` desde la shell, aunque su definición prohíbe escribir así; solo cambió esas cinco casillas.
- [ ] Revisión manual del contenido del CSV (reglas 1 a 3 de la sección 6 de la spec) en el gate de review.
- [ ] Diseño visual del diálogo «Añadir a {sección}» y del listado de resultados, pendiente de prueba del usuario.
- [ ] El CSV fue editado por el orquestador con autorización explícita (el role-guard no reconoce backend/scripts/data/); anotar en review.
- [ ] F14 MENOR (planner): plan.md:472 y tasks.md:86,88 dicen 264 filas; el CSV tiene 261.
- [ ] F15 MENOR (implementer): marcó T-120 a T-123 y T-125 en tasks.md con `sed -i` desde la shell, prohibido por el Art. B2.4 (está en el backlog de la feature).
- [ ] F16 MENOR (implementer): «Lechuga repollada» (CSV:163) es un regionalismo como nombre principal; mejor «Lechuga iceberg», con «lechuga repollada» como sinónimo.
- [ ] F17 MENOR (test-author): `test_the_csv_has_fewer_than_265_foods` y `test_no_row_has_the_manual_source` fijan el estado actual del CSV, no la spec (AC-001.1 admite de 250 a 350 filas y el formato admite filas `manual`). Además, los tests de marcas, contramuslo y limonada llevan el marcador AC-001.3, que trata de las palabras prohibidas, no de los sinónimos.
- [ ] F18 NIT (implementer): crudos que se suelen comer cocidos: Tempeh, Puerro y Pak choi.
- [ ] F19 NIT (implementer): sinónimos dudosos: «graviola» (portugués), «granadilla» en Maracuyá, «queso gruyer» en Queso suizo, «natilla» en Crema agria, «tomate verde» en Tomatillo.
- [ ] F20 NIT (implementer): «berza» aparece en tres coles distintas (Repollo, Col rizada, Col verde).
- [ ] Arreglar el role-guard o el config para que reconozca backend/scripts/data/ (el CSV lo editó el orquestador con autorización del usuario).
- [ ] state.json sigue con max_iterations 3 y el config tiene 4.
- [ ] Si en el futuro se añaden filas `manual` al catálogo, hay que volver a poner en Términos de servicio una frase sobre su origen.
- [ ] Test intermitente del perfil, «B entra con el onboarding pendiente y sin ver la fecha de nacimiento» (NFR-002 AC-N002.1). Falló una vez de dos pasadas completas de `npm test`.
- [ ] El test «B entra con el onboarding pendiente y sin ver la fecha de nacimiento de A» (frontend/src/app/accountSwitch.test.tsx:68), que el implementer vio fallar una vez, pasó en la suite completa de esta ronda y en una repetición aislada. No está en los archivos de la 023 (no aparece en git diff main...HEAD), así que no se atribuye a esta feature; no se ha reproducido, y no se puede afirmar que sea intermitente con dos pasadas.
- [ ] F21 NIT (test-author): los marcadores AC-001.2 de los tests de marcas, contramuslo, limonada y lechuga iceberg (`test_food_catalog_csv.py:162,179,189,201`) no corresponden a la unicidad de nombres; encajan mejor con AC-001.1 (reglas de la sección 6).
- [ ] F22 NIT (spec-writer): el texto de «Términos de servicio» no cambia respecto a la 022, pero su fecha pasa a «21 de octubre de 2026» (`TermsOfServicePage.tsx:5`). Lo pide AC-012.3; valorar si conviene en una revisión futura.
- [ ] doc-keeper: en `docs/deploy-runbook.md`, la migración `d4f6a8c0e2b5` antes del merge y la carga del CSV tras el CD. En `CLAUDE.md`, que `/foods` redirige a `/diary` y que el diario busca en el catálogo.
- [ ] Añadir la fila de la 023 al historial de despliegues (sección 8 del runbook) en el chore posterior al despliegue, con PR, sha, migración y backup reales; anotar el tamaño real de catalog_foods si se mide.
