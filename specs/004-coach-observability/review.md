# Review 004 — Observabilidad del coach de IA con Langfuse Cloud

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff main...feat/004-coach-observability` @ `54ae3ca` más los cambios sin commitear del árbol de trabajo (correcciones F1, F2 y F5 de la iteración 1, `state.json` y `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración comprueba las correcciones que el usuario pidió en el gate de la iteración 1: F1 (implementer), F2 (test-author) y F5 (planner). Las tres están hechas y ninguna cambia el comportamiento.
- El AST del código de producción es idéntico al de `HEAD`.
- El AST de los tests es idéntico salvo docstrings y el orden de los nombres dentro de dos imports.
- Los 12 SHA-256 de `tests_snapshot` (actualizado a las 07:38:24 como cambio autorizado) coinciden.
- Ejecuté los 109 tests de la feature (`109 passed in 0.74s`) y `ruff-new.mjs main` (sin violaciones nuevas).

La evaluación de la spec, el plan y la constitución de la iteración 1 sigue vigente, porque el código funcional no ha cambiado. No hay hallazgos nuevos.

## 2. Cumplimiento de la spec
No cambia respecto a la iteración 1: los 42 AC están implementados como se especificaron. La tabla con la evidencia por `archivo:línea` está en la iteración 1. Las líneas citadas siguen siendo válidas, porque las correcciones solo tocaron comentarios de una línea, sin añadir ni quitar ninguna.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Código de producción sin cambios funcionales | Sí | AST de `backend/services/coach_service.py`, `backend/utils/embeddings.py` y `backend/utils/llm_client.py` idéntico al de `HEAD` (comparación con `ast.dump` sin docstrings) |
| AC cubiertos por tests que pasan | Sí | 109 passed (feature y servicios afectados); el verifier informa de 236 passed en la suite completa |

## 3. Cumplimiento del plan
- **Sin desviaciones nuevas.** F5 solo cambia el estado de ADR-0017 a "Aceptada" (`docs/sdd/decisions/ADR-0017-observabilidad-langfuse.md:3`, `docs/sdd/decisions/README.md:23`) y no toca `plan.md`, tal como se registró en `state.json` (07:35:47).
- **Integridad de los tests:**
  - Los 12 SHA-256 de `state.json.tests_snapshot` coinciden con los archivos actuales.
  - `git diff cf6649b HEAD -- backend/tests` sigue vacío, así que implement no tocó los tests.
  - Los cambios sin commitear en los 8 archivos de test solo afectan a docstrings y comentarios (F2) y al formato ruff ya autorizado. En `conftest.py` y en `test_coach_observability.py` cambia también el orden de los nombres importados (`from extensions import (...)` y `SYSTEM_PROMPT, CoachService`). No hay asserts, tests ni marcadores `SDD:` que cambien.
  - En `conftest.py` también se corrigieron las tildes del docstring de `_clear_email_outbox` ("vacíos", "integración"), que venía de la feature anterior. Es inocuo y no cuenta como hallazgo.
- **Nota para el orquestador:** el cambio ajeno en `CLAUDE.md` ya no aparece en `git status`, así que se descartó como pidió el usuario.

## 4. Checklist de la constitución
- [x] Art. 2: roles respetados. F1 lo corrigió el implementer (producción), F2 el test-author (tests) y F5 el planner (ADR), según el historial de `state.json`.
- [x] Art. 4: la trazabilidad no cambia. Los marcadores `SDD:` siguen iguales y el verifier informa de 42/42 AC cubiertos.
- [x] Art. 5: no se borró, saltó ni debilitó ningún test. Siguen sin usarse `unittest.mock` ni `monkeypatch`, y los fakes siguen escritos a mano.
- [x] Art. 6: capas e inyección sin cambios. No cambian los modelos, así que no hace falta migración.
- [x] Art. 7: sin secretos; `@require_auth`, el `user_id` del token, la validación y el rate limiting no cambian.
- [x] Art. 6.11 y Art. 5.6: los comentarios nuevos de producción (`coach_service.py:48`, `:75` y `:170`; `embeddings.py:26`; `llm_client.py:37`) y los docstrings de los tests nuevos ya llevan tildes. Una búsqueda de las palabras señaladas en la iteración 1 no encuentra más casos en los archivos nuevos.
  - **Única coincidencia:** `test_coach_observability.py:31` ("informacion", "especifico"). Es una copia literal del mensaje fijo preexistente del coach, que la spec prohíbe cambiar, así que es correcto que siga igual.

## 5. Hallazgos
### Estado de los hallazgos de la iteración 1
| # | Severidad | Decisión del usuario | Estado | Evidencia |
|---|---|---|---|---|
| F1 | MENOR | Corregir | Resuelto | `backend/services/coach_service.py:48`, `:75` y `:170`; `backend/utils/embeddings.py:26`; `backend/utils/llm_client.py:37` con tildes; AST idéntico |
| F2 | MENOR | Corregir | Resuelto | Docstrings y comentarios con tildes en los archivos de test nuevos; AST idéntico salvo docstrings y orden de imports; snapshot actualizado como cambio autorizado |
| F3 | MENOR | Al backlog | Diferido con aprobación | Test de ruta para AC-N001.1 (test-author) |
| F4 | MENOR | Al backlog | Diferido con aprobación | Import perezoso de `langfuse` en la primera pregunta y aviso repetido si falla la fábrica (planner) |
| F5 | NIT | Corregir | Resuelto | ADR-0017 "Aceptada" en el ADR y en el índice |
| F6 | NIT | Aceptado tal cual | Cerrado | — |
| F7 | NIT | Aceptado tal cual | Cerrado | — |
| F8 | NIT | Aceptado tal cual | Cerrado | — |

### Hallazgos nuevos
Ninguno.

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES, y tampoco hay hallazgos nuevos. F1, F2 y F5 están resueltos sin cambios funcionales. F3 y F4 quedan en el backlog por decisión del usuario, y conviene registrarlos en la etapa docs para que no se pierdan.

## Comentarios del usuario

**Gate de review, iteración 1 (2026-10-07).** Respuesta literal del usuario: "(a) y descarta el cambio de CLAUDE.MD, posiblemente fui yo que presione la barra espaciadora."

Opción (a), tal como se le presentó: corregir ahora F1 (implementer), F2 (test-author) y F5 (planner); F3 y F4 pasan al backlog; F6, F7 y F8 se aceptan tal cual.
