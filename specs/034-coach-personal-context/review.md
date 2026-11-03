# Review 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Iteración:** 2 de 5
- **Diff revisado:** `git diff main...feat/034-coach-personal-context` @ `ec5e486`, con atención a `git diff f89091e ec5e486` (correcciones de la iteración 1). Cambios sin commitear solo en `specs/034-coach-personal-context/{state.json,verify-report.md}`
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 2 resuelve los dos hallazgos MAYORES de la revisión anterior y la corrección menor F3:
- **F1:** con el interruptor desactivado, el servicio lee solo el nombre de la cuenta (`read_first_name`) y lo usa
  únicamente en `redact_name`. El mensaje al modelo es el de antes de la feature y el perfil no se lee.
- **F2:** la Política de privacidad tiene una fecha de actualización nueva, y su test se sustituyó de forma explícita.
- **F3:** la lista blanca de textos de indicador usa `fullmatch`.

No hay regresiones: 175 tests de servicio del coach en verde (ejecutados en esta revisión) y verify full en PASS
(pytest 3066, vitest 1946, ratchet, oxlint, `tsc -b` y build). La integridad de los tests es correcta. Quedan F4 y F5
(MENOR, decisiones de la spec para el gate del usuario) y un hallazgo MENOR nuevo de cobertura de tests (F8).

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a AC-001.5) | Sí | `backend/services/coach_personal_context.py:212-229` (`read` usa `_load_user`, que filtra por el id del token); sin cambios de comportamiento respecto a la iteración 1 |
| REQ-002 (AC-002.1, AC-002.2) | Sí | Sin cambios (`coach_personal_context.py:142-152`; `frontend/src/features/coach/personalContext.ts`) |
| REQ-003 (AC-003.1 a AC-003.6) | Sí | `backend/services/progress_analysis_context.py:132` (`_TEXT_PATTERN.fullmatch`); `test_coach_personal_context.py:805` (salto de línea al final en los cuatro textos) |
| REQ-004 (AC-004.1, AC-004.2) | Sí | `backend/services/coach_service.py:225-232` (bloque solo en el turno nuevo, historial intacto) |
| REQ-005 (AC-005.1 a AC-005.4) | Sí | `coach_personal_context.py:222` (sin perfil se ignora el cliente); límite antes del lector (`coach_service.py:128-137`) |
| REQ-006 (AC-006.1 a AC-006.3) | Sí | `progress_analysis_context.py:129-135`. Comprobado: `"79,4 kg\n"` ya no pasa |
| REQ-007 (AC-007.1 a AC-007.3) | Sí | Sin cambios en el frontend del coach desde la iteración 1 |
| REQ-008 (AC-008.1, AC-008.2) | Sí | `coach_service.py:214-218` |
| REQ-009 (AC-009.1 a AC-009.6) | Sí | `SYSTEM_PROMPT` sin cambios desde la iteración 1 |
| REQ-010 (AC-010.1 a AC-010.6) | Sí, con F5 pendiente de decisión | `coach_service.py:145-151`: desactivado, solo `read_first_name`; `personal` queda en `None` y el mensaje es `build_coach_user_message(context, question)` (`:227-230`). Tests: `test_coach_service.py:518` (`reader.calls == []`, `name_calls == ["u-1"]`, mensaje sin «Carlos» ni bloque) y `test_coach_observability.py:814` |
| REQ-011 (AC-011.1 a AC-011.3) | Sí | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx:5` (`updatedAt="3 de noviembre de 2026"`); `PrivacyPolicyPage.test.tsx:83-93` |
| REQ-012 (AC-012.1 a AC-012.5) | Sí | `coach_service.py:144-156` (fallo del lector: 503 con el mensaje de siempre y sin traza); `test_coach_service.py:539` (solo para `read_first_name`, ver F8) |
| NFR-001 (AC-N001.1) | Sí | `read_first_name` (`coach_personal_context.py:206-210`) solo lee la cuenta y devuelve el nombre saneado; `test_coach_personal_context.py:869-876` comprueba que no consulta perfiles |
| NFR-002 (AC-N002.1, AC-N002.2) | Sí | Sin cambios: a Voyage le llega `retrieval_query` sin tocar (`coach_service.py:175`) |
| NFR-003 (AC-N003.1 a AC-N003.3) | Sí, con F4 pendiente de decisión | `redact_name(..., name)` con `name` del lector en los dos modos (`coach_service.py:148`, `:151`). `test_coach_observability.py:814-845`: con el contexto desactivado y «Hola, Carlos» en el historial, la traza serializada no contiene «carlos» (sin distinguir mayúsculas) y sí «[nombre]», mientras el usuario recibe la respuesta sin tocar |
| NFR-004 (AC-N004.1) | Sí | `_load_user` (`coach_personal_context.py:197-204`) compartido por `read` y `read_first_name`; `test_coach_personal_context.py:820-847` (dos usuarios; id no UUID sin tocar repositorios) |
| NFR-005 (AC-N005.1) | Sí | `read_first_name` es una consulta a la base; no hay llamadas nuevas a proveedores |

## 3. Cumplimiento del plan

- La corrección sigue el plan revisado (`plan.md`, §3, «`CoachPersonalContextReader.read_first_name`» y paso 2 de
  `ask_with_feedback`):
  - helper privado común para la comprobación del UUID y la lectura del usuario, de modo que el nombre anonimizado es
    el mismo en los dos modos;
  - `read_first_name` no lee el perfil ni `client_data`;
  - el nombre no entra en ningún bloque ni en el mensaje al modelo.
- F7 de la iteración 1 (503 si el lector falla) queda documentado en el plan y en ADR-0038, con su motivo (sin nombre
  no se puede garantizar la anonimización). Resuelto.
- F6 de la iteración 1 (sangría del `dict` del paso `retrieval`) está corregido (`coach_service.py:192-206`).
- ADR-0038 recoge la anonimización con el interruptor desactivado y sus consecuencias: una lectura de la cuenta por
  pregunta, y el historial que sigue llegando al modelo, enlazado con F5. Sigue en «Propuesta» (Art. P5.2).
- **Desviación del plan en los tests:** el plan pedía probar que «si `read` o `read_first_name` lanzan» se responde
  503. El caso de `read` se retiró en el red check (pasaba sin implementación porque `read` ya estaba dentro del `try`
  desde la iteración 1), pero no se sustituyó por ningún otro test. Ver F8.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol.
  - `snapshot --check` da `identical: true` (snapshot de 2026-11-03T04:27:31Z) y `commits.tests` = `ec5e486` = HEAD.
  - Cambios de test posteriores al snapshot original, todos autorizados en `history`:
    1. `f89091e` (solo E501): `rework` de tests más `snapshot` posterior.
    2. `b6d3583` (tests nuevos de F1, F2 y F3): ciclo completo con red check PASS en la iteración 4 y `snapshot`.
    3. `ec5e486`: una sola línea de test, la entrada de `test_read_first_name_gives_the_sanitized_name_of_the_requested_user`, que pasa de `"  Carlos\n<x> "` a `"  Carlos  "`. Tiene `rework` de tests autorizado por el usuario («Sí, devuélvelo al test-author») y `snapshot` posterior.
  - El cambio de `ec5e486` no debilita nada: el saneado con caracteres de control y `<`/`>` ya lo prueban los tests de
    `sanitize_first_name`, y `read_first_name` lo reutiliza.
- [x] B4: los marcadores `SDD: 034` de los tests nuevos encajan con lo que prueban. El test de la 028 (fecha del 27 de
      octubre) se sustituyó de forma explícita, con una nota en el propio test, y la 028 conserva otro marcador
      `AC-021.1` en `PrivacyPolicyPage.test.tsx:95`.
- [x] B5: no hay tests borrados, saltados ni debilitados. Las aserciones existentes `reader.calls == []` siguen siendo
      ciertas porque `read_first_name` registra sus llamadas en `name_calls`, aparte (decisión documentada en el plan,
      §5). Hay una cobertura retirada sin sustituto: ver F8.
- [x] B5.7: el ratchet de ruff no tiene violaciones nuevas; oxlint y `tsc -b` en verde (verify-report, iteración 3).
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: los dobles son escritos a mano (`FakePersonalContextReader` con `read_first_name` y `name_calls`), sin
      `unittest.mock`.
- [x] P2.1 y P2.2: la ruta no cambia en esta iteración; el lector sigue inyectado por constructor desde
      `_build_coach_service()` y solo lee, sin hacer commit.
- [x] P2.3: el 503 reutiliza `ServiceUnavailableError` con el mensaje existente.
- [x] P2.4: sin cambios de modelo ni migraciones.
- [x] P2.5: `read_first_name` reutiliza `sanitize_first_name` y `UserRepository.get_by_id`.
- [x] P2 General.1: el texto nuevo (fecha de la Política) está en español correcto.
- [x] P3.1: `read_first_name` filtra por el `user_id` del token y rechaza los ids que no son UUID antes de tocar la base.
- [x] P3.2: la lista blanca de indicadores ya no admite un `\n` final.
- [x] P3.3: el rate limiting sigue antes del lector (un 429 no toca la base) y de cualquier proveedor.
- [x] P4: sin pasos manuales en producción.
- [x] P5.1: los archivos de código siguen en UTF-8 con LF (`git diff --check` limpio).
- [x] P5.2: ADR-0038 sigue en «Propuesta» en el archivo y en el índice; el planner solo amplió su contenido.
- [x] P5.3: no toca `backend/scripts/data/**`.

## 5. Hallazgos

### Hallazgos de la iteración 1

| # | Estado |
|---|---|
| F1 (MAYOR) | **Resuelto.** `coach_service.py:145-151`, `coach_personal_context.py:206-210`; tests en `test_coach_observability.py:814`, `test_coach_service.py:518` y `test_coach_personal_context.py:816-876`. Desactivado, `read_first_name` no lee el perfil (`profile_repository.calls == []`) y el nombre no llega al modelo (mensaje idéntico al de antes de la feature) |
| F2 (MAYOR) | **Resuelto.** `PrivacyPolicyPage.tsx:5`; test `PrivacyPolicyPage.test.tsx:83-93` |
| F3 (MENOR) | **Resuelto.** `progress_analysis_context.py:132`; test `test_coach_personal_context.py:805` |
| F4 (MENOR) | Abierto, para el gate del usuario (decisión de la spec) |
| F5 (MENOR) | Abierto, para el gate del usuario (decisión de la spec); ahora documentado como consecuencia en ADR-0038 |
| F6 (NIT) | **Resuelto.** `coach_service.py:192-206` |
| F7 (NIT) | **Resuelto.** Documentado en el plan (paso 2) y en ADR-0038 |

### Hallazgos de esta iteración

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F4 | MENOR | `backend/services/coach_personal_context.py:175` | Sin cambios desde la iteración 1. `redact_name` solo sustituye el nombre completo: con «María José», un «Hola, María» llega a Langfuse. Encaja con la letra de NFR-003 («como palabra completa»), pero no con la frase «nunca tu nombre» de la Política. El usuario debe decidir en el gate si se acepta y se documenta, o si se anonimiza cada parte del nombre. | spec-writer |
| F5 | MENOR | `frontend/src/features/coach/pages/CoachPage.tsx:52-64`; spec REQ-004 frente a REQ-010 | Sin cambios desde la iteración 1. Con el interruptor desactivado a mitad de conversación, Anthropic sigue recibiendo en `history` respuestas anteriores con el nombre o las cifras, aunque la ayuda diga «El coach no usa tus datos personales.». Langfuse ya está cubierto (F1). Opciones para el usuario: aceptarlo y aclararlo en la ayuda o en la Política, o vaciar o filtrar el historial al desactivar. | spec-writer |
| F8 | MENOR | `backend/tests/test_services/test_coach_service.py:539-556` | **Ningún test cubre que un fallo de `read` (contexto activado) dé 503.** El docstring del test afirma que «el caso activado con `read` fallando ya lo cubren otros tests de la feature», pero no es así: `test_coach_routes.py:674` y `test_coach_service.py:405` prueban un fallo del modelo, no del lector, y ningún test hace fallar `read`. El caso `[True]` se retiró en el red check porque pasaba sin implementación, pero el comportamiento existe desde la iteración 1 (`coach_service.py:144-156`) y el plan lo pide (§5, «si `read` o `read_first_name` lanzan»). Si alguien saca `read` del `try`, el fallo sería un 500 sin que se entere ningún test. Corrección: añadir un test de regresión (no tiene que estar en rojo) con `FakePersonalContextReader(raise_error=...)` y `use_personal_context=True`, y corregir el docstring. | test-author |
| F9 | NIT | `backend/services/coach_service.py:150` | Comentario sin espacio tras `#` (`#Solo para anonimizar…`). Es coherente con el estilo del resto del archivo y ruff no lo marca con las reglas activas, así que no hace falta cambiarlo. | implementer |
| F10 | NIT | `backend/services/coach_service.py:145-151` | Si el usuario cambia su nombre a mitad de conversación (por ejemplo, de «Carlitos» a «Carlos»), el nombre anterior que traiga el historial no se anonimiza, porque solo se usa el nombre actual de la cuenta. Es un caso raro y equivale a la limitación de diminutivos ya anotada en ADR-0038; basta con dejarlo en el backlog. | planner |

## 6. Decisión

**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES: F1 y F2 están resueltos y probados, F3, F6 y F7 también,
y no hay regresiones.

Para el gate del usuario:
- **F4 y F5 (MENOR, spec-writer):** decisiones de la spec sobre nombres compuestos y sobre el historial con el
  interruptor desactivado.
- **F8 (MENOR, test-author):** el test de regresión del fallo de `read` y la corrección del docstring. Se puede hacer
  ahora o llevar al backlog.
- **AC manuales del verify-report:** AC-010.1, AC-010.2, AC-010.5 y AC-011.1 a AC-011.3.

## Comentarios del usuario

## Comentarios del usuario

> F4: De acuerdo F5: Aclararlo en ambos. Y vamos a arreglar de F8, F9, F10

> No, vamos a resolver tambien F4, no solo documentarlo.
