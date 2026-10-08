# Review 005 — Valoración 👍/👎 de las respuestas del coach como puntuación en Langfuse

- **Iteración:** 2 de 3
- **Commit / diff revisado:** `git diff main...feat/005-coach-feedback` @ `fbe1350` (centrado en `git show fbe1350`; más los cambios sin commitear de `state.json` y `verify-report.md`, que son del orquestador y del verifier)
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración comprueba las correcciones de F3, F4 y F5 de la iteración 1 (commit `fbe1350`), que el usuario pidió con la opción (a). Las tres están aplicadas tal como se pidieron, sin tocar tests ni comportamiento. El resto del cambio no ha variado desde la iteración 1, cuyo análisis de spec, plan y constitución sigue vigente. `verify.result` es `PASS` (verify full de la iteración 2: 314 tests de backend y 71 de frontend, `ruff-new`, lint, `tsc` y build en verde).

## 2. Cumplimiento de la spec
Sin cambios respecto a la iteración 1: todos los AC (AC-001.1 a AC-013.1 y AC-N001.1 a AC-N004.1) están implementados como se especificó. La evidencia por AC está en la tabla de la iteración 1 (commit `50afc6e`, `specs/005-coach-feedback/review.md` §2).

El único cambio que toca un AC es el de F5, en el texto de la política de privacidad:
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-012.x (política de privacidad) | Sí | `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx:37-40`: "las valoraciones (👍/👎) que das a sus respuestas (para mejorar el coach y por límites de uso)". Es coherente con la entrada de Langfuse y con que los votos no se guardan en fitnerd. `PrivacyPolicyPage.test.tsx` sigue pasando (no comprobaba la frase anterior). |

## 3. Cumplimiento del plan
`fbe1350` solo cambia una anotación de tipo, comentarios y una frase de copy. No hay desviaciones nuevas respecto al plan. Siguen pendientes, como en la iteración 1 y según el plan:
- la prueba manual del *upsert* de `user_feedback` en Langfuse tras desplegar;
- pasar ADR-0018 de "Propuesta" a "Aceptada" en la etapa docs;
- dejar anotado el riesgo del valor por defecto de `SECRET_KEY` (`config.py:31`, preexistente).

## 4. Checklist de la constitución
- [x] Art. 2: los SHA-256 de los 10 archivos de `tests_snapshot` coinciden con los actuales (comprobado con `node` y `crypto`), y `git diff d55088d HEAD -- backend/tests frontend/src/**/*.test.*` está vacío. `fbe1350` no toca tests.
- [x] Art. 4: los marcadores `SDD:` no han cambiado.
- [x] Art. 5: no hay tests borrados, saltados ni debilitados.
- [x] Art. 6: `coach_service.py:5` importa `FeedbackTokenSigner` desde `utils/feedback_token.py`, que solo importa la biblioteca estándar, así que no hay riesgo de import circular. Las capas se respetan.
- [x] Art. 6.4: no hay cambios de modelo, así que no hace falta migración.
- [x] Art. 7: no hay cambios de seguridad en esta iteración.
- [x] Art. 6.11: los textos visibles y los comentarios nuevos del frontend llevan tildes correctas.

## 5. Hallazgos
Estado de los hallazgos de la iteración 1:
| # | Severidad | Estado | Evidencia |
|---|---|---|---|
| F1 | MENOR | Diferido al backlog (decisión del usuario) | — |
| F2 | NIT | Diferido al backlog (decisión del usuario) | — |
| F3 | NIT | Corregido | `backend/services/coach_service.py:52` anota `feedback_signer: FeedbackTokenSigner \| None = None`; `:66-67`, el comentario sobre `user_id` ya está actualizado |
| F4 | NIT | Corregido | `CoachFeedbackButtons.tsx:14-15,33` y `types.ts:29-30` llevan tildes |
| F5 | NIT | Corregido | `PrivacyPolicyPage.tsx:40` |
| F6 | — | Informativo (verifier) | El verify-report de la iteración 2 sigue citando nombres de test que no existen literalmente (por ejemplo, `test_ask_with_feedback_returns_feedback_id_on_no_info`) |

Hallazgos nuevos:
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F7 | NIT | `backend/services/coach_service.py:66` | Al comentario reescrito le falta una tilde: debe decir "de quién es cada contador", no "de quien es". El resto del bloque de comentarios del archivo, que es preexistente, tampoco lleva tildes ("metodo", "vacio"), así que es coherente con el archivo; se puede ignorar. | implementer |

## 6. Decisión
**APPROVED.** No hay hallazgos BLOQUEANTES ni MAYORES. F3, F4 y F5 están corregidos; F1 y F2 quedan en el backlog por decisión del usuario; F7 es opcional. Quedan los pendientes de despliegue y de docs indicados en §3.

## Comentarios del usuario

Iteración 1 (2026-10-08), literal: "Opcion (a) y commit approved". Opción (a): el `implementer` corrige F3, F4 y F5; F1 y F2 pasan al backlog; F6 es informativo.
