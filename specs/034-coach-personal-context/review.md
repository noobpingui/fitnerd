# Review 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Iteración:** 4 de 6
- **Diff revisado:** `git diff main...feat/034-coach-personal-context` @ `69ad615`, con atención a `git diff 092d472 69ad615` (ronda de F11, F12 y F13). Cambios sin commitear solo en `specs/034-coach-personal-context/{backlog.md,state.json,verify-report.md}`
- **Veredicto:** APPROVED

## 1. Resumen

La iteración 4 resuelve los tres puntos que el usuario pidió en el gate anterior:
- **F11:** tildes en los docstrings de `parse_previous_names`, `name_redaction_terms` y `redact_name`, y en un comentario de `_load_user`.
- **F12:** «Revisión 2» en los dos comentarios de sección de los tests.
- **F13, opción A:** `parse_previous_names` omite un nombre anterior que, ya saneado y sin distinguir mayúsculas, sea exactamente una de las 17 partículas. La lista se valida entera antes, así que una lista no válida se sigue ignorando entera. El nombre actual de la cuenta no tiene excepción.

La spec (NFR-003, REQ-013, sección 6 y AC-013.7) y ADR-0038 (ya «Aceptada» por el usuario) recogen la regla. El cambio de producción es de una línea (`coach_personal_context.py:192`) más docstrings; `name_redaction_terms` y `redact_name` no cambian. La integridad de los tests es correcta: `snapshot --check` idéntico y ningún cambio de test después de `commits.tests` (`ed84cf4`). En esta revisión ejecuté los 335 tests de `test_coach_personal_context.py`, `test_coach_observability.py` y `test_coach_service.py`, todos en verde; verify full está en PASS (3230 de pytest y 1963 de vitest). No hay hallazgos nuevos.

## 2. Cumplimiento de la spec

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 a REQ-012, NFR-001, NFR-002, NFR-004, NFR-005 | Sí | Sin cambios funcionales desde la iteración 3 (ver las revisiones anteriores). `git diff 092d472 69ad615 -- backend frontend` solo toca `coach_personal_context.py` y dos archivos de test |
| REQ-013 (AC-013.1 a AC-013.5) | Sí | Sin cambios. Con «de» como nombre anterior, el modelo sigue recibiendo el historial tal cual (`test_coach_observability.py:1084`, `llm.calls[0][1][:2] == history`) |
| REQ-013 (AC-013.6) | Sí | `coach_personal_context.py:183-191`: primero se valida la lista entera con `validate_first_name` y, si un elemento no vale, se devuelve `()`; las partículas se filtran después (`:192`). Test `test_coach_personal_context.py` (`test_parse_previous_names_still_ignores_an_invalid_list_with_a_particle`: `["de", "Carlitos", ""]` da `()`) |
| REQ-013 (AC-013.7) | Sí | `coach_personal_context.py:192`: `name.casefold() not in NAME_PARTICLES`, sobre el nombre ya saneado; `NAME_PARTICLES` (`:28-31`) son las 17 partículas de NFR-003, en minúsculas. Solo cuenta el nombre entero: «De la Fuente», «Del Mar», «Leo» y «Dee» se conservan, y `"d<>e"` se omite tras sanear. Tests: `test_parse_previous_names_skips_a_name_that_is_only_a_particle` (17 partículas × 4 formas), `test_parse_previous_names_only_skips_whole_particles`, `test_a_lone_particle_stays_intact_as_a_word` (17), y de extremo a extremo `test_coach_observability.py:1063` («de», «De» y «LA», con el contexto activado y desactivado: la traza conserva la partícula y «la proteína de la dieta», y no contiene «carlitos» ni «carlos») |
| NFR-003 (cláusula de F13) | Sí | El nombre actual no tiene excepción: `redact_name("la proteína de la dieta", "de", parse_previous_names(["De"]))` da `"la proteína [nombre] la dieta"` (`test_a_particle_previous_name_keeps_the_word_but_the_current_name_has_no_exception`). AC-N003.1 a AC-N003.8 siguen en verde |

## 3. Cumplimiento del plan

- La implementación sigue el plan, revisión 4 (§9.1 a §9.3):
  - la exclusión vive en `parse_previous_names`, sobre el nombre saneado y después de validar la lista entera;
  - `name_redaction_terms` y `redact_name` no cambian;
  - se mantiene el orden de la lista y, si todos los nombres son partículas, devuelve `()`.
- T-076 cambia el caso de 5 nombres de `["A", …, "E"]` a `["A", …, "F"]`, porque «e» es una de las partículas. El plan lo declara (nota del historial a las 08:28 y §9.3), el comentario del test lo explica y la expectativa no se debilita: sigue probando 5 nombres válidos de una letra.
- T-078 (F12) solo cambia dos comentarios; ninguna aserción, nombre de test ni marcador.
- No hay desviaciones sin justificar.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol.
  - `snapshot --check` da `identical: true` (snapshot de 2026-11-03T08:33:13Z), y `git diff ed84cf4 HEAD -- backend/tests frontend/src` está vacío, así que no hay cambios de test después del commit de tests.
  - Cambios de test posteriores al snapshot original, todos autorizados en `history`:
    1. `f89091e`: solo E501 (`rework` más `snapshot`).
    2. `ec5e486`: entrada de `read_first_name`, autorizada por el usuario.
    3. Rev. 2: expectativa de `name_redaction_terms("Ana María", ["María"])`, corregida según plan §3.3 (`rework` a las 05:11, red PASS y `snapshot` a las 05:54).
    4. `092d472`: orden de imports I001 (`rework` autorizado por el usuario y `snapshot` a las 07:25).
    5. `ed84cf4` (esta ronda): T-075 y T-077 (tests nuevos de F13, en rojo legítimo según el red check de las 08:32), T-076 (E → F) y T-078 (comentarios). Llegan por el `rework` de `plan` pedido por el usuario en el gate (08:14) y el de `spec` por la opción A (08:23), con red PASS y `snapshot` posterior (08:33). El red check registra que T-076 y T-078 pasan, como declara el plan.
- [x] B4: los marcadores `SDD: 034 REQ-013 AC-013.7`, `AC-013.6` y `NFR-003 AC-N003.4` encajan con lo que prueba cada test.
- [x] B5: no hay tests borrados, saltados ni debilitados. No hay llamadas a servicios reales.
- [x] B5.7: el ratchet no tiene violaciones nuevas; oxlint, `tsc -b` y build en verde (verify-report, iteración 5). `git diff --check main...HEAD` limpio.
- [x] B6.5: sin secretos ni variables nuevas.
- [x] Límite de iteraciones: `max_iterations` vale 6 en `.sdd/config.json` y en `state.json`. El usuario autorizó la subida a 6 (historial a las 06:44 y 07:24, «opción A y 1») y confirmó en el gate que se quede así en el proyecto («2. max_iterations queda en 6, mejor que quede aumentado»; historial a las 08:14). La review va por la iteración 4 de 6.

### Parte II (proyecto)
- [x] P1: dobles escritos a mano, sin `unittest.mock`; nombres de test en inglés y comentarios en español con tildes («Revisión 2», «Revisión 3»).
- [x] P2.1 y P2.2: sin cambios en la ruta; la regla vive en el servicio.
- [x] P2.3: sin errores nuevos; un nombre que es partícula se ignora sin error, como pide la spec.
- [x] P2.4: sin cambios de modelo ni migraciones.
- [x] P2.5: reutiliza `NAME_PARTICLES`, `validate_first_name` y `sanitize_first_name`; no duplica la lista de partículas.
- [x] P2 General.1: F11 resuelto; los docstrings y comentarios nuevos de `coach_personal_context.py` llevan tildes. Los textos sin tilde que quedan en el diff (`DONT_KNOW_ANSWER`, «La pregunta no puede estar vacia») son textos visibles que ya existían en `main` y se conservan por REQ-012; el plan (T-080) los excluye a propósito.
- [x] P3.1: el nombre actual sale siempre de la cuenta del token; la excepción de las partículas solo afecta a `previous_names`.
- [x] P3.2 y P3.3: sin cambios en la validación de entrada ni en el rate limiting.
- [x] P4: sin pasos manuales en producción.
- [x] P5.1: LF.
- [x] P5.2: ADR-0038 está en «Aceptada», con la aprobación explícita del usuario («3. Aceptada»), y la editó la sesión principal en el commit del plan (`11fd6ce`).
- [x] P5.3: no toca `backend/scripts/data/**`.

## 5. Hallazgos

### Hallazgos de iteraciones anteriores

| # | Estado |
|---|---|
| F11 (MENOR) | **Resuelto.** `coach_personal_context.py:180-182`, `:198-199`, `:225` y `:254` |
| F12 (NIT) | **Resuelto.** `test_coach_personal_context.py:882` y `:1000` |
| F13 (NIT) | **Resuelto (opción A).** `coach_personal_context.py:192`; AC-013.7 probado en `test_coach_personal_context.py` y `test_coach_observability.py:1063` |
| `max_iterations` en `.sdd/config.json` | **Resuelto.** El usuario confirmó que se queda en 6 |

### Hallazgos de esta iteración

Ninguno.

Comprobé además estos casos límite, sin encontrar problemas:
- `"  de  "` y `"d<>e"` se sanean a «de» y se omiten.
- «De la Fuente» se conserva como nombre anterior. Sus partes «De» y «la» siguen sin anonimizarse sueltas por la regla de F4, y el nombre completo sí se anonimiza.
- Si todos los nombres de la lista son partículas, el resultado es `()` y solo se anonimiza el nombre actual, igual que sin lista.

## 6. Decisión

**APPROVED.** No quedan hallazgos BLOQUEANTES ni MAYORES, ni tampoco MENOR o NIT. F11, F12 y F13 están resueltos sin regresiones, y los cambios de test de esta ronda están autorizados en el historial.

Para el gate del usuario:
- **AC manual del verify-report:** AC-010.1, posición visual del interruptor en escritorio y en móvil.

## Comentarios del usuario

## Comentarios del usuario

> F4: De acuerdo F5: Aclararlo en ambos. Y vamos a arreglar de F8, F9, F10

> No, vamos a resolver tambien F4, no solo documentarlo.

> 1. Corrijamos F11, F12 Y F13. 2. max_iterations queda en 6, mejor que quede aumentado. 3. Aceptada

> F13 (opciones A, B, C o D de plan.md §9.3): A
