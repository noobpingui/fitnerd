# Tareas 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Ámbitos:** backend, frontend
- Los esqueletos lanzan `not implemented` (Art. B5.6, P1.5). Los tests existentes no se tocan: solo se añaden casos.

## Fase A0 — Esqueletos (scaffold)

No hacen falta esqueletos para `CoachService.__init__`, `ask` y `ask_with_feedback` (ya existen; los kwargs nuevos fallan por comportamiento ausente), ni para `parse_indicators`, `parse_iso_date`, `profile_lines` e `indicator_lines` (los tests nuevos no los importan), ni para la ruta (el 200 existe).

- [x] T-001 [REQ-001, REQ-005, REQ-006, REQ-010, NFR-003, NFR-004] (scaffold) Módulo nuevo con constantes reales (`NAME_PLACEHOLDER`, `MAX_MACRO_GRAMS`, etiquetas del bloque), dataclasses `CoachMacros`, `ClientCoachContext`, `PersonalContext`, funciones `parse_use_personal_context`, `parse_client_context`, `sanitize_first_name`, `build_personal_context_block`, `redact_name` con cuerpo `raise NotImplementedError("not implemented")` y `CoachPersonalContextReader` con `__init__` que guarda dependencias y `read` que lanza — `backend/services/coach_personal_context.py`
- [x] T-002 [REQ-008, REQ-004, REQ-010] (scaffold) Constante `DONT_KNOW_ANSWER = "No tengo informacion relacionada con ese tema en especifico."` y función `build_coach_user_message(context, question, personal_block=None)` con cuerpo `raise NotImplementedError("not implemented")` (símbolos nuevos importados por los tests) — `backend/services/coach_service.py`
- [x] T-003 [REQ-007, REQ-010] (scaffold) Tipos `CoachMacros`, `CoachIndicators`, `CoachPersonalContext` y nuevo `AskCoachPayload` con `use_personal_context` y `personal_context?` — `frontend/src/features/coach/types.ts`
- [x] T-004 [REQ-010] (scaffold) Componente `Switch` con firma estándar de shadcn que lanza `throw new Error("not implemented")` — `frontend/src/components/ui/switch.tsx`
- [x] T-005 [REQ-007, REQ-002, REQ-003] (scaffold) `buildCoachPersonalContext(_metrics, _profile, _today)` que lanza `not implemented` — `frontend/src/features/coach/personalContext.ts`
- [x] T-006 [REQ-010] (scaffold) `PERSONAL_CONTEXT_STORAGE_KEY` real, `readPersonalContextPreference` y `writePersonalContextPreference` que lanzan `not implemented` — `frontend/src/features/coach/personalContextPreference.ts`
- [x] T-007 [REQ-010] (scaffold) `usePersonalContextPreference()` que lanza `not implemented` — `frontend/src/features/coach/hooks.ts`
- [x] T-008 [REQ-010] (scaffold) `PersonalContextToggle({ checked, onCheckedChange })` que lanza `not implemented` — `frontend/src/features/coach/components/PersonalContextToggle.tsx`

## Fase A — Tests (rojo)

### backend

- [x] T-009 [REQ-010, REQ-006, REQ-001, AC-010.4, AC-010.6, AC-006.2, AC-001.4] (test) `parse_use_personal_context` (None y True activo; False, "no" y 0 desactivado) y `parse_client_context` (caso válido; un caso `None` por regla: salto de línea, 33 caracteres, `target_kcal` 0 y 20000, gramos negativos, estado desconocido, `today` a 2 días; campos ajenos `name` y `gender` ignorados) — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-010 [REQ-001, REQ-002, REQ-005, REQ-006, AC-001.1, AC-001.3, AC-002.1, AC-002.2, AC-005.1, AC-005.2, AC-005.3, AC-006.1] (test) `build_personal_context_block` con `PersonalContext` a mano: perfil base, ft/in con `gain_slow` y `athlete`, macros en kcal, sin perfil, sin cliente, con `indicators=None`, sin nombre — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-011 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-003.6] (test) Bloque de indicadores: «más lento», no disponibles, ritmo sin datos, lb, racha y registros, «Revisa tus mediciones» — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-012 [NFR-003, REQ-009, AC-N003.3] (test) `sanitize_first_name` (saltos de línea, `<`, `>`, vacío) y `redact_name` (palabra completa sin distinguir mayúsculas, «Anabel» intacto, recursión en listas y diccionarios) — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-013 [REQ-001, REQ-005, NFR-001, NFR-004, AC-001.2, AC-005.1, AC-N001.1, AC-N004.1] (test) `CoachPersonalContextReader.read`: edad con `FakeClock` y `today` del cliente, sin perfil se ignora el cliente, id no UUID da contexto vacío sin tocar repositorios, dos usuarios aislados, sin apellido, correo ni fecha de nacimiento en el bloque — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-014 [REQ-004, REQ-010, AC-004.1, AC-010.4] (test) Servicio con lector `FakePersonalContextReader`: el último mensaje lleva el bloque una sola vez y el historial llega idéntico; `use_personal_context=False` da un mensaje idéntico a `build_coach_user_message(context, question)` y no llama al lector — `backend/tests/test_services/test_coach_service.py`
- [x] T-015 [REQ-008, NFR-002, NFR-005, AC-008.1, AC-008.2, AC-N002.1, AC-N002.2, AC-N005.1] (test) Servicio: texto de búsqueda exacto (pregunta y «previa + actual»), sin fragmentos relevantes `DONT_KNOW_ANSWER` sin llamar al modelo (también «¿Cuál es mi objetivo de calorías?»), una llamada a `embed` y una a `generate_with_usage` — `backend/tests/test_services/test_coach_service.py`
- [x] T-016 [REQ-012, REQ-005, AC-012.2, AC-012.3, AC-005.4] (test) Servicio: límite agotado sin llamar al lector, a Voyage ni al modelo; fallo del modelo da 503 con el mensaje actual — `backend/tests/test_services/test_coach_service.py`
- [x] T-017 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6] (test) `SYSTEM_PROMPT` contiene las frases clave del plan §3.3 y ninguna forma de voseo («Sos», «Respondés», «tenés», «decilo», «respondela») — `backend/tests/test_services/test_coach_service.py`
- [x] T-018 [NFR-003, AC-N003.1, AC-N003.2] (test) Observabilidad: con `Tracer(FakeTraceBackend)` y respuesta «Hola, Carlos: con tu objetivo de 2200 kcal…», `CoachAnswer.answer` conserva «Carlos» y nada serializado de la traza lo contiene; sí «[nombre]», «2200 kcal», «Perder peso», «79,4 kg» y el `user_id` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-019 [REQ-001, REQ-004, REQ-010, AC-001.4, AC-001.5, AC-004.2, AC-010.4, AC-010.6] (test) Integración: `name`/`gender` del cuerpo ignorados, nombre cambiado en `/api/profile`, meta cambiada, `use_personal_context: false` y campo ausente — `backend/tests/test_routes/test_coach_routes.py`
- [x] T-020 [REQ-005, REQ-006, REQ-012, NFR-001, NFR-004, AC-005.4, AC-006.1, AC-006.2, AC-012.1, AC-012.4, AC-012.5, AC-N001.1, AC-N004.1] (test) Integración: sin perfil 200 y el contador sube, solo `question`, datos de cliente no válidos descartados, 401, `feedback_id` valorable, 400 con pregunta vacía o de 501 caracteres con contexto válido, nota «me duele la rodilla» y datos privados ausentes, dos usuarios — `backend/tests/test_routes/test_coach_routes.py`

### frontend

- [x] T-021 [REQ-007, REQ-002, REQ-003, AC-007.1, AC-007.2, AC-002.1, AC-002.2, AC-003.1, AC-003.4] (test) `buildCoachPersonalContext` con `calculateMacros` y `formatInsights` reales: 2750/2200 kcal, gramos, «79,4 kg», «-0,6 kg», «-0,2 kg/sem», `too_slow`; lb; sin mediciones `indicators: null` — `frontend/src/features/coach/personalContext.test.ts`
- [x] T-022 [REQ-010, AC-010.5] (test) Preferencia: sin clave activado; tras `write(false)`, `read()` da `false` — `frontend/src/features/coach/personalContextPreference.test.ts`
- [x] T-023 [REQ-010, AC-010.1, AC-010.2, AC-010.5] (test) `CoachPage`: interruptor activado por defecto con su texto, al desactivarlo cambia el texto y la conversación sigue, tras remontar sigue desactivado — `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`
- [x] T-024 [REQ-007, REQ-006, REQ-004, REQ-010, AC-007.1, AC-007.2, AC-007.3, AC-010.3, AC-006.3, AC-004.1] (test) `CoachPage`: petición con macros e indicadores, sin mediciones, desactivado sin `personal_context`, perfil o mediciones pendientes o rechazados envía sin contexto, tercera pregunta con historial de cuatro turnos — `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`
- [x] T-025 [REQ-011, AC-011.1, AC-011.2, AC-011.3] (test) Política de privacidad: Anthropic con nombre, perfil, macros, progreso y «Puedes desactivarlo en el propio coach»; Langfuse con «nunca con tu email ni tu nombre» y la frase nueva; Voyage sin perfil ni progreso — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

## Fase B — Implementación

### backend (datos → lógica → interfaz)

- [x] T-026 [REQ-003, REQ-006, AC-003.1, AC-006.2] (impl) Extraer `parse_iso_date`, `parse_indicators`, `profile_lines` e `indicator_lines` de `progress_analysis_context` sin cambiar el comportamiento del análisis (los tests de las specs 010 y 011 siguen verdes) — `backend/services/progress_analysis_context.py`
- [x] T-027 [REQ-006, REQ-010, REQ-001, AC-006.1, AC-006.2, AC-010.4, AC-010.6, AC-001.4] (impl) `parse_use_personal_context`, `parse_client_context` (nunca lanza, descarta en bloque), `sanitize_first_name` — `backend/services/coach_personal_context.py`
- [x] T-028 [REQ-001, REQ-002, REQ-003, REQ-005, AC-001.1, AC-001.3, AC-002.1, AC-002.2, AC-003.2, AC-003.3, AC-003.5, AC-003.6, AC-005.1, AC-005.2, AC-005.3] (impl) `build_personal_context_block` con el formato exacto del plan §3.3 y los «no disponible(s)» — `backend/services/coach_personal_context.py`
- [x] T-029 [NFR-003, AC-N003.3] (impl) `redact_name` recursiva sobre `str`, `list`, `tuple` y valores de `dict` — `backend/services/coach_personal_context.py`
- [x] T-030 [REQ-001, REQ-005, REQ-004, NFR-001, NFR-004, AC-001.2, AC-001.5, AC-004.2, AC-005.1, AC-N001.1, AC-N004.1] (impl) `CoachPersonalContextReader.read` (UUID, nombre, perfil, edad con la fecha del dispositivo) — `backend/services/coach_personal_context.py`
- [x] T-031 [REQ-009, REQ-008, REQ-010, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-008.1, AC-008.2] (impl) `SYSTEM_PROMPT` nuevo sin voseo y `build_coach_user_message` (idéntico al mensaje de hoy sin bloque) — `backend/services/coach_service.py`
- [x] T-032 [REQ-004, REQ-005, REQ-008, REQ-012, NFR-002, NFR-005, AC-004.1, AC-005.4, AC-010.4, AC-012.2, AC-012.3, AC-N002.1, AC-N002.2, AC-N005.1] (impl) `CoachService.__init__` con `personal_context_reader`, `ask` y `ask_with_feedback` con `use_personal_context` y `client_context`, bloque solo en el turno nuevo, límite antes del lector — `backend/services/coach_service.py`
- [x] T-033 [NFR-003, AC-N003.1, AC-N003.2] (impl) Pasar por `redact_name` todo lo que recibe el `Tracer` (entrada, pasos y salida) sin tocar lo enviado a Voyage, al modelo ni al usuario — `backend/services/coach_service.py`
- [x] T-034 [REQ-001, REQ-006, REQ-010, REQ-012, AC-001.4, AC-006.1, AC-010.6, AC-012.1, AC-012.4, AC-012.5] (impl) La ruta lee `use_personal_context` y `personal_context` tras validar la pregunta y el historial; `_build_coach_service()` construye el lector — `backend/routes/coach_routes.py`

### frontend

- [x] T-035 [REQ-010] (impl) Implementar `Switch` de shadcn sobre `radix-ui` (`role="switch"`, `aria-checked`) — `frontend/src/components/ui/switch.tsx`
- [x] T-036 [REQ-007, REQ-002, REQ-003, AC-002.1, AC-002.2, AC-003.1, AC-003.4, AC-007.1, AC-007.2] (impl) `buildCoachPersonalContext` con `calculateMacros`, `parseLocalDate` y `buildAnalysisRequest(...).indicators` — `frontend/src/features/coach/personalContext.ts`
- [x] T-037 [REQ-010, AC-010.5] (impl) Preferencia en `localStorage` (`"off"` desactiva; ante fallo, activado) y `usePersonalContextPreference` — `frontend/src/features/coach/personalContextPreference.ts`
- [x] T-038 [REQ-010, AC-010.1, AC-010.2] (impl) `usePersonalContextPreference` en `hooks.ts` y `PersonalContextToggle` (Switch, Label y ayuda con `aria-describedby`) — `frontend/src/features/coach/hooks.ts`
- [x] T-039 [REQ-010, AC-010.1, AC-010.2] (impl) Componente del interruptor con los textos de la spec — `frontend/src/features/coach/components/PersonalContextToggle.tsx`
- [x] T-040 [REQ-007, REQ-006, REQ-004, REQ-010, AC-004.1, AC-006.3, AC-007.1, AC-007.2, AC-007.3, AC-010.3] (impl) `CoachPage`: interruptor bajo la descripción, `useProfile` y `useBodyMetrics`, payload con `use_personal_context` y `personal_context` solo si hay datos cargados, sin esperar — `frontend/src/features/coach/pages/CoachPage.tsx`
- [x] T-041 [REQ-011, AC-011.1, AC-011.2, AC-011.3] (impl) Textos nuevos de Anthropic y Langfuse; Voyage sin cambios — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Iteración 2 — Revisión 1 (F1, F2, F3, F7)

Tareas nuevas tras la review. Las 41 anteriores siguen hechas. Los `FakePersonalContextReader` ganan `read_first_name` con `name_calls` aparte de `calls`, así que las aserciones `reader.calls == []` existentes no cambian.

### Fase A0 — Esqueleto (iteración 2)

- [x] T-042 [REQ-010, NFR-003, NFR-004] (scaffold) `CoachPersonalContextReader.read_first_name(user_id)` con cuerpo `raise NotImplementedError("not implemented")` — `backend/services/coach_personal_context.py`

### Fase A — Tests (rojo, iteración 2)

- [x] T-043 [NFR-003, NFR-004, AC-N003.1, AC-N004.1] (test) `CoachPersonalContextReader.read_first_name`: nombre saneado solo del usuario pedido con dos usuarios, id no UUID da `None` sin tocar repositorios, usuario inexistente o sin nombre da `None`, no consulta el repositorio de perfiles — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-044 [REQ-010, REQ-012, AC-010.4, AC-012.3] (test) Servicio: `FakePersonalContextReader` con `read_first_name` y `name_calls`; con `use_personal_context=False` se llama una vez a `read_first_name` con el `user_id`, no a `read`, y el mensaje sigue sin «Carlos» ni bloque; si `read` o `read_first_name` lanzan, `ServiceUnavailableError` con el mensaje de siempre sin llamar a Voyage ni al modelo — `backend/tests/test_services/test_coach_service.py`
- [x] T-045 [NFR-003, REQ-010, AC-N003.1, AC-010.4] (test) Observabilidad con el contexto desactivado y un historial que contiene «Carlos»: `CoachAnswer.answer` conserva «Carlos», el modelo recibe el historial más `build_coach_user_message(context, question)` sin bloque, la traza serializada no contiene «Carlos» y sí «[nombre]», y `read` no se llamó (el doble de `test_coach_observability.py` también gana `read_first_name`) — `backend/tests/test_services/test_coach_observability.py`
- [x] T-046 [REQ-006, REQ-003, AC-006.2] (test) `parse_client_context` devuelve `None` con un texto de indicador terminado en salto de línea (`"79,4 kg\n"`) — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-047 [REQ-011] (test) Sustituir el test de la 028 sobre la fecha por uno `SDD: 034 REQ-011`: contiene «Última actualización: 3 de noviembre de 2026» y no «27 de octubre de 2026», «22 de octubre de 2026» ni «21 de octubre de 2026» — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

### Fase B — Implementación (iteración 2)

- [x] T-048 [REQ-010, NFR-003, NFR-004, AC-N003.1, AC-N004.1] (impl) `read_first_name` con helper privado compartido con `read` para la comprobación del UUID y la lectura del usuario; no lee el perfil — `backend/services/coach_personal_context.py`
- [x] T-049 [REQ-010, NFR-003, REQ-012, AC-N003.1, AC-010.4, AC-012.3] (impl) `CoachService`: con el contexto desactivado, `name = reader.read_first_name(user_id)` solo para `redact_name`; el fallo de `read` o `read_first_name` da `ServiceUnavailableError` sin abrir traza — `backend/services/coach_service.py`
- [x] T-050 [REQ-006, REQ-003, AC-006.2] (impl) `_TEXT_PATTERN` con `fullmatch` o `\Z` para rechazar el salto de línea final, sin cambiar el resto del análisis (tests de las specs 010 y 011 en verde) — `backend/services/progress_analysis_context.py`
- [x] T-051 [REQ-011] (impl) `updatedAt` pasa a «3 de noviembre de 2026» — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Iteración 3 — Revisión 2 del plan (F4, F5, F8, F9, F10)

Tareas nuevas tras el gate de review y la spec enmendada (REQ-013, AC-N003.4 a AC-N003.8, AC-010.7, AC-010.8, AC-011.4). Las 51 anteriores siguen hechas. Orden: scaffold, test, impl. Los tests de esta iteración están en rojo por comportamiento ausente, con **una excepción declarada** en el plan (§5): T-058 (F8).

### Fase A0 — Esqueletos (iteración 3)

`CoachService.ask` y `ask_with_feedback` no necesitan esqueleto: `previous_names=` falla por kwarg ausente. `redact_name` ya existe; su parámetro nuevo `other_names` no se añade aquí, así que los tests que lo usan fallan por kwarg ausente y los de partes del nombre, por comportamiento ausente.

- [x] T-052 [REQ-013, NFR-003] (scaffold) Constantes reales `NAME_PARTICLES` (17 partículas del plan), `MIN_NAME_PART_LETTERS = 3` y `MAX_PREVIOUS_NAMES = 5`; `parse_previous_names(value)` y `name_redaction_terms(first_name, other_names=())` con cuerpo `raise NotImplementedError("not implemented")` — `backend/services/coach_personal_context.py`
- [x] T-053 [REQ-013] (scaffold) Constantes reales `MAX_PREVIOUS_NAMES = 5` y `MAX_NAME_LENGTH = 100`; `rememberName` y `previousNamesFor` que lanzan `throw new Error("not implemented")` — `frontend/src/features/coach/previousNames.ts`
- [x] T-054 [REQ-013] (scaffold) `AskCoachPayload` gana `previous_names?: string[]` — `frontend/src/features/coach/types.ts`

### Fase A — Tests (rojo, iteración 3)

#### backend

- [x] T-055 [NFR-003, REQ-013, AC-N003.4, AC-N003.5, AC-N003.6, AC-N003.7, AC-N003.8, AC-013.3] (test) `redact_name` y `name_redaction_terms` por partes: «María José» (un único `[nombre]`, «Gracias, maría», «Mariano» y «Josefina» intactos), «José-Luis», «María de la Paz» (parametrizado sobre las 17 partículas y con mayúsculas), «Jo Ann» y «Mª José», una sola pasada con el nombre «Nombre», orden y duplicados de los términos, y nombres anteriores («Carlitos», «Ana María») — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-056 [REQ-013, AC-013.3, AC-013.6] (test) `parse_previous_names`: lista válida, recortes, 5 nombres, 100 caracteres, `None`, y `()` para no lista, vacía, 6 nombres, vacío, solo espacios, 101 caracteres, elementos que no son texto y lista mixta; `["<>", "Carlitos"]` da `("Carlitos",)` — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-057 [REQ-013, NFR-002, AC-013.5] (test) Servicio con `previous_names=["Ana"]`: el bloque lleva «Nombre: Carlos», ningún mensaje al modelo contiene «Ana» y el texto de búsqueda no cambia — `backend/tests/test_services/test_coach_service.py`
- [x] T-058 [REQ-012, AC-012.3] (test) **Excepción declarada en el plan §5 (F8): este test de regresión PASA antes de implementar** (el comportamiento existe desde la revisión 1; el red check debe aceptarlo, y su docstring lo dice). `test_a_failing_read_with_the_context_on_gives_the_usual_503_without_calling_voyage_or_the_model`: `read` fallando con el contexto activado da `ServiceUnavailableError` con el mensaje de siempre, `reader.name_calls == []` y sin llamadas a Voyage ni al modelo — `backend/tests/test_services/test_coach_service.py`
- [x] T-059 [REQ-012, AC-012.3] (test) Corregir solo el docstring de `test_a_failing_reader_gives_the_usual_503_without_calling_voyage_or_the_model` (sustituir la frase sobre el caso activado por la referencia al test de T-058); cuerpo y aserciones sin cambios — `backend/tests/test_services/test_coach_service.py`
- [x] T-060 [NFR-003, REQ-010, REQ-013, AC-N003.4, AC-N003.5, AC-010.8, AC-013.3, AC-013.4, AC-013.5, AC-013.6] (test) Observabilidad: «María José» de extremo a extremo, «José-Luis», contexto desactivado con «Carlos Alberto» y historial idéntico al modelo, «Carlitos» como nombre anterior (activado y desactivado), listas no válidas parametrizadas (traza conserva «Carlitos» y anonimiza «Carlos») y «Soy Ana» con `previous_names=["Ana"]` — `backend/tests/test_services/test_coach_observability.py`
- [x] T-061 [REQ-013, NFR-003, AC-013.3, AC-013.5, AC-013.6, AC-N003.4] (test) Integración: `previous_names` pasado por la ruta con historial «Hola, Carlitos»; «Soy Ana» con `["Ana"]`; lista no válida seguida de una válida en el mismo test; opcional «María José» cambiado con `PUT /api/profile` — `backend/tests/test_routes/test_coach_routes.py`

#### frontend

- [x] T-062 [REQ-013, AC-013.1, AC-013.2] (test) `rememberName` y `previousNamesFor`: recorte, reordenado sin duplicar, nulos, vacíos y 101 puntos de código sin cambios, máximo 6 guardados, `["Carlitos", "Carlos"]` con «Carlos» da `["Carlitos"]`, igual da `[]`, `current` nulo y los 5 últimos de 6 — `frontend/src/features/coach/previousNames.test.ts`
- [x] T-063 [REQ-010, AC-010.2, AC-010.5] (test) Ajuste obligatorio por F5: la constante `HELP_OFF` pasa al texto completo de la spec (más estricto, con comentario «(revisión 2, F5: texto de ayuda nuevo)»); sin otro cambio en los casos existentes — `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`
- [x] T-064 [REQ-010, AC-010.7, AC-010.8] (test) `CoachPage`: al desactivar, el párrafo de ayuda (por `aria-describedby`) tiene exactamente el texto nuevo; tras responder «Hola, Carlos: con tu objetivo de 2200 kcal…» y desactivar, el payload lleva `use_personal_context: false`, sin `personal_context` y con los dos turnos idénticos — `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`
- [x] T-065 [REQ-013, AC-013.1, AC-013.2] (test) `CoachPage`: sin `previous_names` en la primera pregunta ni con el nombre sin cambios; tras `setQueryData` con «Carlos», `previous_names` es `["Carlitos"]`, también con el interruptor desactivado — `frontend/src/features/coach/pages/CoachPage.personalContext.test.tsx`
- [x] T-066 [REQ-011, AC-011.4] (test) Política de privacidad: el punto de Anthropic contiene la frase de los mensajes anteriores (espacios normalizados) — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`

### Fase B — Implementación (iteración 3)

#### backend (lógica → interfaz)

- [x] T-067 [NFR-003, REQ-013, AC-N003.4, AC-N003.5, AC-N003.6, AC-N003.7, AC-N003.8, AC-013.3] (impl) `name_redaction_terms` (nombre completo y partes de 3 letras o más que no son partículas, separadas por espacio o guion, sin duplicados, de más largo a más corto) y `redact_name(value, first_name, other_names=())` con un único patrón en una sola pasada, recursivo — `backend/services/coach_personal_context.py`
- [x] T-068 [REQ-013, AC-013.6] (impl) `parse_previous_names` con `validate_first_name` y `sanitize_first_name`; nunca lanza, lista no válida ignorada entera — `backend/services/coach_personal_context.py`
- [x] T-069 [REQ-013, NFR-003, NFR-002, REQ-010, AC-013.3, AC-013.4, AC-013.5, AC-010.8, AC-N003.4] (impl) `CoachService.ask` y `ask_with_feedback` aceptan `previous_names`, lo validan con `parse_previous_names`, lo pasan a `redact_name` en cada paso de la traza (helper local) y nunca al mensaje, a Voyage ni al bloque; F9: espacio tras `#` en el comentario de la línea ~150 — `backend/services/coach_service.py`
- [x] T-070 [REQ-013, AC-013.3, AC-013.5, AC-013.6] (impl) La ruta lee `previous_names` del cuerpo y lo pasa como argumento con nombre, sin validarlo — `backend/routes/coach_routes.py`

#### frontend

- [x] T-071 [REQ-013, AC-013.1, AC-013.2] (impl) `rememberName` y `previousNamesFor` según el plan §3.4 — `frontend/src/features/coach/previousNames.ts`
- [x] T-072 [REQ-010, AC-010.7] (impl) `PERSONAL_CONTEXT_HELP_OFF` pasa al texto completo, en el mismo `<p>` enlazado con `aria-describedby` — `frontend/src/features/coach/components/PersonalContextToggle.tsx`
- [x] T-073 [REQ-013, REQ-010, AC-013.1, AC-013.2, AC-010.8] (impl) `CoachPage`: ref de nombres vistos, `useEffect` con `rememberName` y `previous_names` en el payload solo si hay conversación y cambió el nombre, con el interruptor activado o desactivado; el historial se reenvía tal cual — `frontend/src/features/coach/pages/CoachPage.tsx`
- [x] T-074 [REQ-011, AC-011.4] (impl) Frase nueva del punto de Anthropic; `updatedAt` sin cambios — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Iteración 4 — Revisión 3 (F11, F12, F13 opción A)

Tareas nuevas tras el gate de review y la spec enmendada (AC-013.7 y la cláusula de las partículas en NFR-003 y REQ-013). Las 74 anteriores siguen hechas. Orden: test, impl. No hacen falta esqueletos: `parse_previous_names` ya existe y los tests nuevos fallan por comportamiento ausente (hoy `parse_previous_names(["de"])` devuelve `("de",)`). Solo cambia un test existente, el caso de `test_parse_previous_names_accepts_a_valid_list` (plan §9.3). No hay tareas de frontend: `previousNames.ts` no cambia.

### Fase A0 — Esqueletos (iteración 4)

No aplica.

### Fase A — Tests (rojo, iteración 4)

- [x] T-075 [REQ-013, NFR-003, AC-013.7, AC-013.6] (test) `parse_previous_names` omite un nombre que sea solo una partícula: parametrizado sobre las 17 partículas × cuatro formas (tal cual, mayúsculas, capitalizada, con espacios) con `[forma, "Carlitos"] == ("Carlitos",)` y `[forma] == ()`; solo cuenta el nombre entero («De la Fuente», «Del Mar», «Leo», «Dee» se conservan; `"d<>e"` se omite tras sanear); lista no válida con partícula (`["de", "Carlitos", ""]`) sigue dando `()`; `redact_name` conserva «de» como palabra con `["de", "Carlitos"]`, el nombre actual «de» se sigue anonimizando y las 17 partículas sueltas quedan intactas — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-076 [REQ-013, AC-013.3] (test) Cambio del test existente `test_parse_previous_names_accepts_a_valid_list`: el caso de 5 nombres pasa de `["A", "B", "C", "D", "E"]` a `["A", "B", "C", "D", "F"]` con el mismo resultado, con el comentario «(revisión 3, F13: «E» es la partícula «e»)»; sin tocar el resto del test — `backend/tests/test_services/test_coach_personal_context.py`
- [x] T-077 [REQ-013, NFR-003, AC-013.7, AC-N003.4] (test) Observabilidad: `test_a_previous_name_that_is_only_a_particle_is_not_anonymized_in_the_trace`, con contexto activado y desactivado y `particle` en «de», «De», «LA»: historial «Hola, Carlitos: la proteína de la dieta…» idéntico al modelo, la traza conserva la partícula como palabra y «la proteína de la dieta», no contiene «carlitos» ni «carlos» y sí «[nombre]», y con el contexto desactivado `read` no se llama — `backend/tests/test_services/test_coach_observability.py`
- [x] T-078 [F12] (test) **Cambio de forma sin red check, según el plan §9.2:** dos comentarios de sección pasan de «Revision 2» a «Revisión 2» (L882 y L1000) y se corrigen otras palabras sin tilde en comentarios y docstrings nuevos de los cuatro archivos de test backend de la 034; ninguna aserción, nombre de test ni marcador `SDD:` cambia, y los tests siguen en verde. La sesión principal registra `rework` y toma `snapshot` nuevo — `backend/tests/test_services/test_coach_personal_context.py`

### Fase B — Implementación (iteración 4)

- [ ] T-079 [REQ-013, NFR-003, AC-013.7, AC-013.6] (impl) `parse_previous_names` descarta, tras validar la lista entera y sanear, los nombres cuyo `casefold()` sea una de `NAME_PARTICLES` (solo el nombre entero; orden conservado; `()` si todos lo eran); `name_redaction_terms` y `redact_name` sin cambios; docstring con la frase de la partícula — `backend/services/coach_personal_context.py`
- [ ] T-080 [F11] (impl) **Cambio de forma:** tildes en los docstrings de `parse_previous_names`, `name_redaction_terms` y `redact_name` (envía, válida, más, partículas, mayúsculas) y revisión del resto de docstrings y comentarios nuevos del archivo, sin tocar código ni `DONT_KNOW_ANSWER`; líneas dentro de 100 columnas — `backend/services/coach_personal_context.py`

## Matriz de cobertura

| AC | Test | Impl |
|---|---|---|
| AC-001.1 | T-010 | T-028, T-030 |
| AC-001.2 | T-013 | T-030 |
| AC-001.3 | T-010 | T-028 |
| AC-001.4 | T-009, T-019 | T-027, T-034 |
| AC-001.5 | T-019 | T-030 |
| AC-002.1 | T-010, T-021 | T-028, T-036 |
| AC-002.2 | T-010, T-021 | T-028, T-036 |
| AC-003.1 | T-011, T-021 | T-026, T-036 |
| AC-003.2 | T-011 | T-028 |
| AC-003.3 | T-011 | T-028 |
| AC-003.4 | T-011, T-021 | T-028, T-036 |
| AC-003.5 | T-011 | T-028 |
| AC-003.6 | T-011 | T-028 |
| AC-004.1 | T-014, T-024 | T-032, T-040 |
| AC-004.2 | T-019 | T-030 |
| AC-005.1 | T-010, T-013 | T-028, T-030 |
| AC-005.2 | T-010 | T-028 |
| AC-005.3 | T-010 | T-028 |
| AC-005.4 | T-016, T-020 | T-032 |
| AC-006.1 | T-010, T-020 | T-027, T-034 |
| AC-006.2 | T-009, T-020, T-046 | T-026, T-027, T-050 |
| AC-006.3 | T-024 | T-040 |
| AC-007.1 | T-021, T-024 | T-036, T-040 |
| AC-007.2 | T-021, T-024 | T-036, T-040 |
| AC-007.3 | T-024 | T-040 |
| AC-008.1 | T-015 | T-031, T-032 |
| AC-008.2 | T-015 | T-031, T-032 |
| AC-009.1 | T-017 | T-031 |
| AC-009.2 | T-017 | T-031 |
| AC-009.3 | T-017 | T-031 |
| AC-009.4 | T-017 | T-031 |
| AC-009.5 | T-017 | T-031 |
| AC-009.6 | T-017 | T-031 |
| AC-010.1 | T-023 | T-038, T-039 |
| AC-010.2 | T-023 | T-038, T-039 |
| AC-010.3 | T-024 | T-040 |
| AC-010.4 | T-009, T-014, T-019, T-044, T-045 | T-027, T-032, T-049 |
| AC-010.5 | T-022, T-023, T-063 | T-037 |
| AC-010.6 | T-009, T-019 | T-027, T-034 |
| AC-010.7 | T-063, T-064 | T-072 |
| AC-010.8 | T-060, T-064 | T-067, T-069, T-073 |
| REQ-011 (fecha) | T-047 | T-051 |
| AC-011.1 | T-025 | T-041 |
| AC-011.2 | T-025 | T-041 |
| AC-011.3 | T-025 | T-041 |
| AC-011.4 | T-066 | T-074 |
| AC-012.1 | T-020 | T-034 |
| AC-012.2 | T-016 | T-032 |
| AC-012.3 | T-016, T-044, T-058 (regresión, excepción F8: pasa antes de implementar), T-059 | T-032, T-049 |
| AC-012.4 | T-020 | T-034 |
| AC-012.5 | T-020 | T-034 |
| AC-013.1 | T-062, T-065 | T-071, T-073 |
| AC-013.2 | T-062, T-065 | T-071, T-073 |
| AC-013.3 | T-055, T-056, T-060, T-061, T-076 | T-067, T-068, T-069, T-070 |
| AC-013.4 | T-060 | T-067, T-069 |
| AC-013.5 | T-057, T-060, T-061 | T-069, T-070 |
| AC-013.6 | T-056, T-060, T-061, T-075 | T-068, T-069, T-070, T-079 |
| AC-013.7 | T-075, T-077 | T-079 |
| AC-N001.1 | T-013, T-020 | T-030 |
| AC-N002.1 | T-015 | T-032 |
| AC-N002.2 | T-015 | T-032 |
| AC-N003.1 | T-018, T-043, T-045 | T-033, T-048, T-049 |
| AC-N003.2 | T-018 | T-033 |
| AC-N003.3 | T-012 | T-029 |
| AC-N003.4 | T-055, T-060, T-061, T-077 | T-067, T-069 |
| NFR-003 (cláusula de partículas en nombres anteriores, F13) | T-075, T-077 | T-079 |
| F11 / F12 (forma, sin AC) | T-078 | T-080 |
| AC-N003.5 | T-055, T-060 | T-067 |
| AC-N003.6 | T-055 | T-067 |
| AC-N003.7 | T-055 | T-067 |
| AC-N003.8 | T-055 | T-067 |
| AC-N004.1 | T-013, T-020, T-043 | T-030, T-048 |
| AC-N005.1 | T-015 | T-032 |
