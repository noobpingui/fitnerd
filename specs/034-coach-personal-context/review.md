# Review 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Iteración:** 3 de 6
- **Diff revisado:** `git diff main...feat/034-coach-personal-context` @ `092d472`, con atención a `git diff ec5e486 092d472` (ronda de F4, F5, F8, F9 y F10). Cambios sin commitear solo en `specs/034-coach-personal-context/{backlog.md,state.json,verify-report.md}`
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 3 resuelve todo lo que el usuario pidió en la revisión anterior:
- **F4:** anonimización por partes del nombre, con mínimo de 3 letras y la lista cerrada de 17 partículas.
- **F5:** la aclaración del historial en la ayuda del interruptor y en la Política.
- **F8:** test de regresión del 503 cuando falla `read`.
- **F9:** el espacio tras `#` en el comentario.
- **F10:** los nombres anteriores (`previous_names`) se usan solo para la traza.

`previous_names` no llega al modelo, a Voyage ni a la respuesta. Su validación cumple la sección 6 de la spec, y los textos coinciden literalmente con la spec. La integridad de los tests es correcta (`snapshot --check` idéntico y `commits.tests` = HEAD). En esta revisión ejecuté los 241 tests de servicio del coach, en verde; verify full está en PASS. Solo quedan hallazgos MENOR y NIT.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 a REQ-009, REQ-012, NFR-001, NFR-002, NFR-004, NFR-005 | Sí | Sin cambios funcionales desde la iteración 2 (ver review anterior). F8: `test_coach_service.py:562` hace fallar `read` con el contexto activado y comprueba el 503 con el mensaje de siempre, `reader.calls` = 1, `name_calls == []` y ninguna llamada a Voyage ni al modelo |
| REQ-010 (AC-010.1 a AC-010.6) | Sí | `frontend/src/features/coach/components/PersonalContextToggle.tsx:5-8,31`; AC-010.2 sigue cumpliéndose, porque el texto nuevo empieza por «El coach no usa tus datos personales.» |
| AC-010.7 | Sí | `PERSONAL_CONTEXT_HELP_OFF` (`PersonalContextToggle.tsx:7-8`) es literal al texto de la spec, sección 6; test `CoachPage.personalContext.test.tsx` («al desactivarlo, el párrafo enlazado…», con igualdad exacta de `textContent`) |
| AC-010.8 | Sí | El historial se reenvía sin tocar (`coach_service.py`, `messages = [*(history or []), …]`). Tests: `CoachPage.personalContext.test.tsx` («tras desactivarlo, el historial…») y `test_coach_observability.py:953` |
| REQ-011 (AC-011.1 a AC-011.4) | Sí | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx:79-82`, frase literal de la spec; `PrivacyPolicyPage.test.tsx` (AC-011.4). La fecha de actualización sigue en «3 de noviembre de 2026», la de hoy (decisión del plan) |
| REQ-013 (AC-013.1, AC-013.2) | Sí | `CoachPage.tsx:34-40`: los nombres se recuerdan solo mientras hay conversación. `CoachPage.tsx:59-72`: `previous_names` solo si `history.length > 0` y hay algún nombre distinto del actual. `previousNames.ts` acota a 5 y descarta los vacíos y los de más de 100 code points. Tests en `CoachPage.personalContext.test.tsx` (también con el interruptor desactivado) y `previousNames.test.ts` |
| REQ-013 (AC-013.3, AC-013.4) | Sí | `coach_service.py:166-169`: `redact` aplica `redact_name(value, name, previous)` a la entrada, a los pasos y a la salida en los dos modos. Tests en `test_coach_observability.py:986` (parametrizado activado y desactivado) y en `test_coach_routes.py` (por HTTP) |
| REQ-013 (AC-013.5) | Sí | `previous` solo se usa en `redact` (`coach_service.py:166-169`): ni el bloque, ni `messages`, ni `retrieval_query`, ni la respuesta JSON (`coach_routes.py:112`, `answer` y `feedback_id`). El nombre del bloque sigue saliendo del lector. Test `test_coach_service.py` (`test_previous_names_never_reach_the_model_the_block_or_the_search_text`: «Nombre: Carlos», sin «Ana» en los mensajes ni en el system prompt, y búsqueda sin cambios) |
| REQ-013 (AC-013.6) | Sí | `coach_personal_context.py:179-191`: lista (no `dict` ni texto) de 1 a 5 elementos; cada uno pasa `validate_first_name` (regla 018: texto, sin vacíos ni espacios solos, como mucho 100 caracteres tras recortar). Cualquier elemento no válido devuelve `()` y nunca lanza. Se valida después del límite de uso y del lector, así que no puede provocar un 400 ni un 500. Tests en `test_coach_personal_context.py:1040` (14 casos, `[True]` y mezclas válido/no válido incluidos), `test_coach_observability.py` y `test_coach_routes.py` |
| NFR-003 (AC-N003.1 a AC-N003.3) | Sí | El nombre completo sigue anonimizándose como palabra completa; «Anabel» con «Ana» no se toca |
| NFR-003 (AC-N003.4 a AC-N003.8) | Sí | `coach_personal_context.py:194-228`. El nombre completo y las partes (separadas por espacios o guiones, `:212`) de 3 letras o más que no sean partículas (`:214-217`) se deduplican con `casefold` y se ordenan de más largo a más corto en una sola alternancia de palabra completa: «María José» da un único `[nombre]` y `[nombre]` nunca se vuelve a sustituir. Tests en `test_coach_personal_context.py:886-991`, más los de extremo a extremo en `test_coach_observability.py:922,940` |

## 3. Cumplimiento del plan

- La implementación sigue el plan, revisión 2 (§3.3, `name_redaction_terms`, `parse_previous_names` y `redact_name(…, other_names)`):
  - `NAME_PARTICLES` con las 17 partículas de la spec;
  - `MIN_NAME_PART_LETTERS = 3`, contando solo letras (`isalpha`), así que «Mª» no se anonimiza suelto;
  - `MAX_PREVIOUS_NAMES = 5`.
- `parse_previous_names` reutiliza `validate_first_name` (spec 018) y `sanitize_first_name`: el nombre anterior se compara con el texto saneado, el mismo que recibió el modelo (Art. P2.5).
- F8 se declaró en el plan (§5) como excepción de red: un test de regresión que pasa antes de implementar. Está justificada: el comportamiento existía desde la iteración 1 y el test protege que `read` siga dentro del `try`.
- ADR-0038 recoge las partes del nombre, `previous_names` y el aviso del historial, con sus consecuencias (palabras comunes como «Paz» desaparecen de la traza de ese usuario, y un cliente manipulado solo afecta a su propia traza). Sigue en «Propuesta» (Art. P5.2).
- No hay desviaciones sin justificar.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol.
  - `snapshot --check` da `identical: true` (snapshot de 2026-11-03T07:25:27Z), y `commits.tests` = `092d472` = HEAD, así que no hay cambios de test después del commit de tests.
  - Cambios de test posteriores al snapshot original, todos autorizados en `history`:
    1. `f89091e`: solo E501 (`rework` más `snapshot`).
    2. `ec5e486`: entrada de `read_first_name`, autorizada por el usuario.
    3. Rev. 2: expectativa de `name_redaction_terms("Ana María", ["María"])`, corregida a `["Ana María", "María", "Ana"]` según plan §3.3. Tiene `rework` en el red check a las 05:11, red PASS a las 05:54 y `snapshot` posterior.
    4. `092d472`: orden de imports I001, con un `rework` autorizado por el usuario («opción A y 1»: subir `max_iterations` a 6) y `snapshot` a las 07:25.
  - Revisé esos diffs: solo cambian el orden de un import y una expectativa alineada con el plan; no debilitan nada.
- [x] B4: los marcadores `SDD: 034 REQ-013 …`, `AC-010.7/8`, `AC-011.4` y `AC-N003.4…8` encajan con lo que prueba cada test.
- [x] B5: no hay tests borrados, saltados ni debilitados. Solo se corrigió un docstring, el de F8, que ahora es cierto. No hay llamadas a servicios reales: los dobles son `FakeTraceBackend` y `FakePersonalContextReader`.
- [x] B5.7: el ratchet no tiene violaciones nuevas; oxlint, `tsc -b` y build en verde (verify-report, iteración 4). El `# noqa: E501` del nombre del test de F8 es aceptable.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: dobles escritos a mano, sin `unittest.mock`; nombres de test en inglés (backend) y en español (frontend).
- [x] P2.1 y P2.2: la ruta solo pasa `data.get("previous_names")` (`coach_routes.py:107`); la validación vive en el servicio.
- [x] P2.3: sin errores nuevos; una lista no válida se ignora sin error, como pide la spec.
- [x] P2.4: sin cambios de modelo ni migraciones (comprobado en el diff).
- [x] P2.5: reutiliza `validate_first_name` y `sanitize_first_name`.
- [ ] P2 General.1: los textos visibles nuevos están en español correcto, pero varios docstrings nuevos no llevan tildes, y uno las perdió (ver F11).
- [x] P3.1: el nombre actual sale siempre de la cuenta del token; `previous_names` nunca lo sustituye.
- [x] P3.2: `previous_names` se valida en el servicio, y el frontend genera listas que ya cumplen la regla.
- [x] P3.3: el rate limiting sigue antes de todo.
- [x] P4: sin pasos manuales en producción.
- [x] P5.1: LF (`git diff --check main...HEAD` limpio).
- [x] P5.2: ADR-0038 sigue en «Propuesta», en el archivo y en el índice.
- [x] P5.3: no toca `backend/scripts/data/**`.

## 5. Hallazgos

### Hallazgos de iteraciones anteriores

| # | Estado |
|---|---|
| F4 (MENOR) | **Resuelto.** `coach_personal_context.py:194-228`; AC-N003.4 a AC-N003.8 probados |
| F5 (MENOR) | **Resuelto.** `PersonalContextToggle.tsx:7-8` y `PrivacyPolicyPage.tsx:79-82`, textos literales de la spec |
| F8 (MENOR) | **Resuelto.** `test_coach_service.py:562`, docstring corregido en `:540-544` |
| F9 (NIT) | **Resuelto.** `coach_service.py:157` |
| F10 (NIT) | **Resuelto.** REQ-013: `coach_service.py:166-169` y `CoachPage.tsx:34-72` |

### Hallazgos de esta iteración

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F11 | MENOR | `backend/services/coach_personal_context.py:180-181`, `:197-198`, `:224` | Los docstrings nuevos de `parse_previous_names` y `name_redaction_terms` están sin tildes («envia», «no valida», «o mas», «particulas», «de mas largo a mas corto»). Además, el de `redact_name` perdió la tilde que tenía en `main` («mayúsculas» pasó a «mayusculas»). Incumple el Art. P2 General.1. Corrección: «envía», «válida», «más», «partículas» y «mayúsculas». | implementer |
| F12 | NIT | `backend/tests/test_services/test_coach_personal_context.py:882`, `:1000` | Los comentarios de sección «Revision 2» de los tests no llevan tilde («Revisión», Art. P1 General.2 y P2 General.1). | test-author |
| F13 | NIT | `backend/services/coach_personal_context.py:204-206` | Un nombre de la lista que sea una sola palabra común o una partícula (por ejemplo, `previous_names=["de"]`) se anonimiza entero en toda la traza, porque el nombre completo se sustituye siempre. La spec lo acepta («Un cliente manipulado solo puede anonimizar palabras de su propia traza», Q12) y ADR-0038 lo documenta. Solo lo anoto por si conviene tenerlo en cuenta al leer trazas raras en Langfuse; no hace falta cambiarlo. | planner |

**Para el gate (sin responsable de rol):** el commit `092d472` cambia también `.sdd/config.json` (`max_iterations` de 5 a 6). Es un ajuste de todo el proyecto que llegará a `main` con el merge. El historial registra la aprobación del usuario para subir el límite de esta feature («edición puntual de state.json»). Conviene confirmar en el gate si el 6 debe quedarse en la configuración del proyecto o volver a 5 antes del cierre.

## 6. Decisión

**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES. F4, F5, F8, F9 y F10 están resueltos y probados, y no hay regresiones.

Comprobaciones en esta revisión:
- `previous_names` no llega al modelo, al system prompt, a Voyage ni a la respuesta.
- Su validación (1 a 5 nombres con la regla 018; si la lista no es válida, se ignora sin error) cumple la sección 6 de la spec.
- La regla de partes no produce falsos positivos fuera de lo que la spec acepta: «Mariano», «Josefina», «Joan» y «Anabel» no se tocan, y las partículas tampoco.

Para el gate del usuario:
- **F11 (MENOR, implementer):** tildes de tres docstrings. Se puede corregir ahora o llevar al backlog.
- **F12 y F13 (NIT):** opcionales.
- **`max_iterations` en `.sdd/config.json`:** confirmar si se queda en 6.
- **ADR-0038:** decidir si pasa a «Aceptada» (Art. P5.2).
- **AC manual del verify-report:** AC-010.1, posición visual del interruptor en escritorio y en móvil.

## Comentarios del usuario

## Comentarios del usuario

> F4: De acuerdo F5: Aclararlo en ambos. Y vamos a arreglar de F8, F9, F10

> No, vamos a resolver tambien F4, no solo documentarlo.

> 1. Corrijamos F11, F12 Y F13. 2. max_iterations queda en 6, mejor que quede aumentado. 3. Aceptada

> F13 (opciones A, B, C o D de plan.md §9.3): A
