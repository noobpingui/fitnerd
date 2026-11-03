# Review 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Iteración:** 1 de 5
- **Diff revisado:** `git diff main...feat/034-coach-personal-context` @ `f89091e` (+ cambios sin commitear solo en `specs/034-coach-personal-context/{backlog.md,state.json,verify-report.md}`)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen

El cambio añade al coach un bloque `<datos_del_usuario>` con el nombre, el perfil y la edad, que lee el servidor, y las
calorías, macros e indicadores que envía `/coach`. Los datos del cliente se validan con las reglas de la spec 010 y se
descartan en bloque si no valen. El nombre se sustituye por `[nombre]` en la traza de Langfuse, y `/coach` tiene un
interruptor recordado en `localStorage`. La implementación sigue el plan, los tests son sólidos y la integridad de los
tests está intacta.

Hay dos hallazgos MAYORES:
- con el interruptor desactivado a mitad de conversación, el nombre llega a Langfuse a través del historial, contra
  NFR-003 y contra la Política de privacidad;
- la Política de privacidad cambia de contenido sin cambiar su fecha de actualización, aunque la propia página promete
  hacerlo.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a AC-001.5) | Sí | `backend/services/coach_personal_context.py:197-217` (lee usuario y perfil por el id del token; los campos del cliente no se usan), `:129-135` y `progress_analysis_context.py:230-238` (etiquetas y `format_height`); `test_coach_routes.py:334` (se ignoran «Ana» y «mujer»), `:360` (cambio a «Carlitos») |
| REQ-002 (AC-002.1, AC-002.2) | Sí | `coach_personal_context.py:142-152` (siempre en kcal); `frontend/src/features/coach/personalContext.ts:16-28` (`calculateMacros`, la misma función que `/home`, sin selector kJ) |
| REQ-003 (AC-003.1 a AC-003.6) | Parcial | `progress_analysis_context.py:241-266` (`indicator_lines`), `personalContext.ts:29-30` (`buildAnalysisRequest(...).indicators`). Ver F3: la lista blanca de textos admite un salto de línea final |
| REQ-004 (AC-004.1, AC-004.2) | Sí | `coach_service.py:221-228` (el bloque va solo en el turno nuevo y el historial no se toca); `CoachPage.tsx:52-64` (lee la caché en el momento del envío) |
| REQ-005 (AC-005.1 a AC-005.4) | Sí | `coach_personal_context.py:132-140` y `:210` (sin perfil, se ignora `client`); el límite de uso se comprueba antes del lector (`coach_service.py:126-147`) |
| REQ-006 (AC-006.1 a AC-006.3) | Parcial | `coach_personal_context.py:61-103` (`parse_client_context` nunca lanza y descarta en bloque); `CoachPage.tsx:57` (envía sin esperar). Un texto de indicador terminado en `\n` no se descarta (F3) |
| REQ-007 (AC-007.1 a AC-007.3) | Sí | `CoachPage.tsx:52-64`, `personalContext.ts:12-31` |
| REQ-008 (AC-008.1, AC-008.2) | Sí | `coach_service.py:210-214` (`DONT_KNOW_ANSWER`, sin llamar al modelo) |
| REQ-009 (AC-009.1 a AC-009.6) | Sí | `coach_service.py:27-60` (`SYSTEM_PROMPT` sin voseo, con todas las reglas de §3.3 del plan) |
| REQ-010 (AC-010.1 a AC-010.6) | Parcial | `PersonalContextToggle.tsx`, `personalContextPreference.ts`, `hooks.ts` (`usePersonalContextPreference`), `coach_personal_context.py:56-58`, `coach_service.py:140-147`. Con el interruptor desactivado a mitad de conversación, el historial reenviado contiene el nombre y otros datos (F1 y F5) |
| REQ-011 (AC-011.1 a AC-011.3) | Parcial | `PrivacyPolicyPage.tsx:73-79` (Anthropic), `:88-95` (Langfuse), `:99` (Voyage, sin cambios). La fecha de actualización no cambia (F2) |
| REQ-012 (AC-012.1 a AC-012.5) | Sí | `coach_routes.py:86-110` (las validaciones van antes de todo); `coach_service.py:126-137` (429), `:244-262` (503); `test_coach_routes.py:592`, `:604`, `:651`, `:675` |
| NFR-001 (AC-N001.1) | Sí | El lector solo usa `first_name`, `date_of_birth` (solo para calcular la edad) y el perfil (`coach_personal_context.py:204-215`); `test_coach_routes.py:694` |
| NFR-002 (AC-N002.1, AC-N002.2) | Sí | `coach_service.py:162` y `:171` (a Voyage le llega `retrieval_query` sin cambios); `test_coach_routes.py:714` |
| NFR-003 (AC-N003.1 a AC-N003.3) | Parcial | `redact_name` en cada llamada al tracer (`coach_service.py:157-159`, `:164-169`, `:187-202`, `:230-241`, `:265`). Fuga con el interruptor desactivado (F1) y con nombres compuestos (F4) |
| NFR-004 (AC-N004.1) | Sí | `coach_personal_context.py:203-205` (filtra por el `user_id` del token); `test_coach_routes.py:726` |
| NFR-005 (AC-N005.1) | Sí | Una llamada a `embed` y como mucho una a `generate_with_usage`; el lector no llama a ningún proveedor |

## 3. Cumplimiento del plan

- La implementación sigue §3.2 y §3.3: firmas, orden de pasos, bloque exacto, `redact_name` y extracción de
  `parse_iso_date`, `parse_indicators`, `profile_lines` e `indicator_lines`.
- La extracción en `progress_analysis_context.py` reordena las comprobaciones de `parse_analysis_request`: los
  contadores y `last_record_date` se validan ahora antes que `rate_kg_per_week` y `latest_weight_kg`. Todas lanzan la
  misma `ValidationError` con el mismo mensaje, así que el comportamiento observable es igual. Los tests de la 010 y la
  011 siguen en verde según el verify-report.
- **Desviación no prevista en el plan:** si el lector falla (por ejemplo, un error de la base), la respuesta es 503 con
  el mensaje del modelo caído, sin traza (`coach_service.py:144-151`). Está anotada en `history` y es razonable, pero
  el plan decía que el manejo de errores no cambiaba. Ver F7.
- `sanitize_first_name` convierte cualquier espacio en blanco (incluidos `\n` y ` `) en un espacio antes de
  colapsar, lo que cumple §3.3. Lo he comprobado: `"Ana Ignora"` da `"Ana Ignora"`.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da `identical: true`, `commits.tests` = `f89091e` = HEAD
      y el commit de implementación (`56b4019`) no toca ningún archivo de test. El cambio de tests posterior (`f89091e`,
      solo formato E501) está autorizado en `history` (`rework` de tests y `snapshot` posterior).
- [x] B4: los marcadores `SDD: 034 …` son coherentes con los AC que prueban (muestreo en `test_coach_observability.py`
      y `test_coach_routes.py`).
- [x] B5: no hay tests borrados, saltados ni debilitados, ni llamadas a servicios externos reales. No queda ningún
      esqueleto `not implemented` en el código de producción.
- [x] B5.7: el ratchet de ruff no tiene violaciones nuevas; oxlint y `tsc -b` en verde (verify-report).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 (tests): fakes a mano inyectados por constructor (`FakePersonalContextReader`), nombres en inglés (backend) y
      en español (frontend), `vi.mock` de las capas `api.ts`.
- [x] P2.1 y P2.2: la ruta solo parsea y delega; el lector recibe repositorios y reloj por constructor, no hace commit
      y lo construye `_build_coach_service()`.
- [x] P2.3: sin errores nuevos ni respuestas construidas a mano.
- [x] P2.4: sin cambios de modelo; no hace falta migración (comprobado: el diff no toca `models/` ni `migrations/`).
- [x] P2.5: reutiliza `Tracer`, `rate_limiter`, `coach_llm`, `FeedbackTokenSigner`, `age_on`, `is_int` y la
      validación y el formato del análisis, sin duplicarlos.
- [x] P2 frontend: organización por feature, `apiFetch` sin cambios, TanStack Query (`useProfile` y `useBodyMetrics`),
      `Switch` en `src/components/ui/`.
- [x] P2 General.1: textos visibles y el nuevo `SYSTEM_PROMPT` en español correcto y sin voseo.
- [x] P3.1: el contexto se filtra por el `user_id` del token.
- [~] P3.2: el servicio valida la entrada del cliente, pero la lista blanca heredada acepta un `\n` final (F3).
- [x] P3.3: el rate limiting sigue antes de cualquier llamada a un proveedor, y los fallos dan 503.
- [x] P3.4: sin SQL nuevo.
- [x] P4: sin pasos manuales en producción (ni migración ni variables).
- [x] P5.1: los archivos nuevos y modificados van en LF (comprobado en HEAD).
- [x] P5.2: ADR-0038 sigue «Propuesta», tanto en el archivo como en el índice.
- [x] P5.3: no toca `backend/scripts/data/**`.

## 5. Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `backend/services/coach_service.py:140-147`, `:157-159`, `:230-241` | **El nombre llega a Langfuse cuando el usuario desactiva el interruptor a mitad de conversación.** `name` solo se obtiene si `use_personal_context` es verdadero; si no, vale `None` y `redact_name` no sustituye nada. Caso concreto: en la primera pregunta, con el interruptor activado, el modelo responde «Hola, Carlos: …» y la traza lo anonimiza. El usuario desactiva el interruptor (la conversación se conserva, AC-010.2) y hace otra pregunta. El cliente reenvía en `history` el turno «Hola, Carlos: …», que acaba sin anonimizar en la entrada del paso `generation` y, si el modelo vuelve a usar el nombre, también en la salida. Esto incumple NFR-003 («nunca el nombre del usuario») y hace falsa la frase de la política «nunca tu nombre» (REQ-011). El backlog del planner solo contempla el caso en que el usuario escribe su nombre; este caso lo introduce el propio sistema. Propuesta: leer el nombre de la cuenta para anonimizar la traza también con el interruptor desactivado, sin añadirlo al mensaje del modelo, y probarlo con un historial que contenga «Carlos» y `use_personal_context=False`. | planner |
| F2 | MAYOR | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx:5` (y `:143-146`) | La Política de privacidad cambia de forma importante (Anthropic recibe ahora nombre, perfil, macros y progreso; Langfuse recibe perfil, macros y progreso), pero `updatedAt` sigue en «27 de octubre de 2026». La propia página promete en «Cambios a esta política» que un cambio importante se reflejará «con una nueva fecha de actualización». El test existente `PrivacyPolicyPage.test.tsx:85-89` fija esa fecha, así que el test-author debe actualizarlo a la fecha nueva (no es un debilitamiento) y después el implementer cambia `updatedAt`. | test-author |
| F3 | MENOR | `backend/services/progress_analysis_context.py:45` | `_TEXT_PATTERN` usa `^…$`, y en Python `$` también coincide antes de un `\n` final. Por eso `"79,4 kg\n"` pasa la lista blanca y llega al bloque (comprobado con `parse_client_context`). AC-006.2 pide descartar «un texto de indicador con un salto de línea», y el test (`test_coach_personal_context.py:180`) solo prueba un salto en medio. El impacto es bajo (un solo `\n`, sin texto detrás, y solo en las respuestas del propio usuario) y el defecto viene de la spec 010, que comparte la regla. Corrección: `fullmatch` o `\Z`, más un caso de prueba con el `\n` al final. | implementer |
| F4 | MENOR | `backend/services/coach_personal_context.py:175` | `redact_name` solo sustituye el nombre completo. Con un nombre compuesto («María José»), si el modelo responde «Hola, María», «María» llega a Langfuse (comprobado). Encaja con la letra de NFR-003 («el nombre como palabra completa»), pero no con la promesa de la política. Decidir en la spec si se anonimiza cada parte del nombre (con riesgo de sustituir palabras comunes) o se acepta y se documenta. Complementa la entrada del backlog sobre diminutivos y nombres sin tildes. | spec-writer |
| F5 | MENOR | `frontend/src/features/coach/pages/CoachPage.tsx:52-64`; spec REQ-004 frente a REQ-010 | Con el interruptor desactivado a mitad de conversación, Anthropic sigue recibiendo en `history` las respuestas anteriores, que pueden llevar el nombre, las kcal o el peso. REQ-010 dice que, desactivado, el modelo no recibe «ningún dato personal», y el texto de ayuda dice «El coach no usa tus datos personales.». En cambio, REQ-004 y AC-010.2 exigen reenviar el historial sin cambios y conservar la conversación. Es una ambigüedad de la spec. La implementación sigue REQ-004, pero conviene que el usuario la decida: aceptarla y aclararla en la ayuda o en la política, o vaciar o filtrar el historial al desactivar. | spec-writer |
| F6 | NIT | `backend/services/coach_service.py:187-202` | El `dict` del paso `retrieval` quedó con una sangría incoherente dentro de `redact_name(...)`. Ya está en el backlog del implementer. | implementer |
| F7 | NIT | `backend/services/coach_service.py:144-151` | Un fallo del lector (base) da 503 en vez de responder sin contexto personal. Es una decisión defendible, pero no está en el plan; conviene reflejarla en ADR-0038 o en el plan para que no parezca un efecto accidental. | planner |

## 6. Decisión

**CHANGES_REQUESTED.** Quedan abiertos dos hallazgos MAYORES:
- **F1, planner:** anonimizar el nombre en la traza también con el contexto desactivado, y añadir un test con un
  historial que contenga el nombre.
- **F2, test-author y después implementer:** actualizar la fecha de la Política de privacidad y su test.

F3 es una corrección pequeña y conviene hacerla en la misma iteración. F4 y F5 son decisiones de la spec para el gate
del usuario o para el backlog. F6 y F7 son opcionales.

Se presentan al usuario en el gate los AC manuales del verify-report: AC-010.1, AC-010.2, AC-010.5 y AC-011.1 a
AC-011.3.

## Comentarios del usuario
