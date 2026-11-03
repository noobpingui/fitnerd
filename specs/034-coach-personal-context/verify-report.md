# Verify report 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

- **Modo:** red (tras la etapa tests, ronda F11, F12 y F13: T-075 a T-078)
- **Fecha:** 2026-11-03T08:30:49.321Z · **Rama:** `feat/034-coach-personal-context` @ `8d003fa` (los cambios de tests de esta ronda están sin commit en el árbol de trabajo) · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_services/test_coach_personal_context.py tests/test_services/test_coach_observability.py` (`backend`) | ⚠️ rojo esperado | 94 failed, 211 passed. Los 94 fallos son los tests nuevos de T-075 (88) y T-077 (6). Todos son `AssertionError` de comportamiento ausente. T-076 (`test_parse_previous_names_accepts_a_valid_list`, con «F») pasa. |
| frontend | — | no ejecutado | Esta ronda no añade tests de frontend (T-075 a T-078 son solo de backend). |
| backend | lint-ratchet, typecheck, build | no aplica | Modo red: solo se ejecutan los tests nuevos. |

Comprobación adicional, sin marcador ni comando de config: `test_coach_service.py` y `test_coach_routes.py` no cambian en esta ronda y no se ejecutan en modo red.

Detalle de los 94 tests nuevos en rojo, con la aserción que falla:

- `test_parse_previous_names_skips_a_name_that_is_only_a_particle`, 68 casos (17 partículas × 4 formas): `parse_previous_names([forma, "Carlitos"]) == ("Carlitos",)` recibe la partícula también en la salida.
- `test_parse_previous_names_only_skips_whole_particles`: la salida incluye `"de"` (y `"d<>e"` tras sanear).
- `test_parse_previous_names_still_ignores_an_invalid_list_with_a_particle`: la segunda aserción, `(["de", "Carlitos"]) == ("Carlitos",)`, falla porque devuelve `("de", "Carlitos")`.
- `test_a_particle_previous_name_keeps_the_word_but_the_current_name_has_no_exception`: la traza anonimiza «de» como nombre anterior.
- `test_a_lone_particle_stays_intact_as_a_word`, 17 casos: «de», «la»… se sustituyen por «[nombre]» en `x {p} y`.
- `test_a_previous_name_that_is_only_a_particle_is_not_anonymized_in_the_trace`, 6 casos (contexto activado y desactivado × «de», «De», «LA»): la palabra de la partícula no aparece en la traza.

Revisión de expectativas frente al plan §9.3: todas las aserciones coinciden con el diseño de la opción A (la partícula se omite en `parse_previous_names`; `name_redaction_terms`, `redact_name` y el nombre actual no cambian; «E» pasa a «F» en el caso válido de 5 nombres). No hay imports de símbolos fuera del plan ni errores de fixture o sintaxis.

Comprobaciones de integridad de los tests:

- Esqueletos (scaffold): esta ronda no tiene ninguno (tasks.md, Fase A0 «No aplica»). Ningún `not implemented` ni `NotImplementedError` queda en `coach_personal_context.py`, `coach_service.py` ni `coach_routes.py`.
- Cambios de tests existentes: solo T-076 (`test_coach_personal_context.py`, un caso de `test_parse_previous_names_accepts_a_valid_list`, «E» → «F», mismo resultado esperado) y T-078 (comentarios de sección y de docstrings, sin aserciones ni nombres). En `test_coach_observability.py` el diff solo añade líneas.
- `skip`, `xfail`, `.only` o `.skip` nuevos: ninguno. Las únicas coincidencias del diff son los nombres de test `…skips_a_name…` y `…only_skips_whole_particles…`, que describen comportamiento y no son marcadores.

## 2. Trazabilidad

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-013 | AC-013.7 | T-075, T-077 (impl. pendiente: T-079) | `backend/tests/test_services/test_coach_personal_context.py::test_parse_previous_names_skips_a_name_that_is_only_a_particle` (68 casos), `::test_parse_previous_names_only_skips_whole_particles`, `::test_parse_previous_names_still_ignores_an_invalid_list_with_a_particle`, `::test_a_particle_previous_name_keeps_the_word_but_the_current_name_has_no_exception`, `::test_a_lone_particle_stays_intact_as_a_word` (17 casos); `backend/tests/test_services/test_coach_observability.py::test_a_previous_name_that_is_only_a_particle_is_not_anonymized_in_the_trace` (6 casos) | ❌ rojo legítimo (aserción de comportamiento) |
| NFR-003 (cláusula de partículas, F13) | AC-013.7 y AC-N003.4 | T-075, T-077 | Los mismos tests de la fila anterior | ❌ rojo legítimo (aserción de comportamiento) |
| REQ-013 | AC-013.3 (caso válido de 5 nombres) | T-076 (cambio de «E» a «F») | `backend/tests/test_services/test_coach_personal_context.py::test_parse_previous_names_accepts_a_valid_list` | ✅ pasa (cambio autorizado por el plan §9.3) |

- AC sin test: no evaluado en modo red (se comprueba en full).
- REQ sin tarea: no evaluado en modo red (se comprueba en full).
- Tareas sin marcar `[x]`: no evaluado en modo red. T-079 y T-080 están pendientes, como se espera antes de implementar.
- `skip`, `xfail`, `.only` o equivalentes nuevos en el diff: ninguno (ver §1).

## 3. Criterios de aceptación manuales

—

## 4. Fallos (si los hay)

Ninguno. Los 94 tests nuevos fallan por comportamiento ausente y ninguno pasa sin implementación.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | — | — | — |
