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
| AC-006.2 | T-009, T-020 | T-026, T-027 |
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
| AC-010.4 | T-009, T-014, T-019 | T-027, T-032 |
| AC-010.5 | T-022, T-023 | T-037 |
| AC-010.6 | T-009, T-019 | T-027, T-034 |
| AC-011.1 | T-025 | T-041 |
| AC-011.2 | T-025 | T-041 |
| AC-011.3 | T-025 | T-041 |
| AC-012.1 | T-020 | T-034 |
| AC-012.2 | T-016 | T-032 |
| AC-012.3 | T-016 | T-032 |
| AC-012.4 | T-020 | T-034 |
| AC-012.5 | T-020 | T-034 |
| AC-N001.1 | T-013, T-020 | T-030 |
| AC-N002.1 | T-015 | T-032 |
| AC-N002.2 | T-015 | T-032 |
| AC-N003.1 | T-018 | T-033 |
| AC-N003.2 | T-018 | T-033 |
| AC-N003.3 | T-012 | T-029 |
| AC-N004.1 | T-013, T-020 | T-030 |
| AC-N005.1 | T-015 | T-032 |
