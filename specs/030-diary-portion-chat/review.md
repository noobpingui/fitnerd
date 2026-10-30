# Review 030 — Chat de porciones del diario (backend)

- **Iteración:** 4 de 5 (cuarta review, tras corregir F10, F11 y F12; `iterations.review` = 2, `iterations.tests` = 3)
- **Diff revisado:** `git diff main...feat/030-diary-portion-chat` @ `d3322d4` (+ cambios sin commitear solo en `specs/030-diary-portion-chat/{state.json,verify-report.md,backlog.md,review.md}`)
- **Veredicto:** APPROVED

## 1. Resumen
Esta iteración solo corrige los tres NIT de la tercera review que el usuario pidió cerrar: F10 (docstring de
`test_coach_routes.py`) y F11 (marcador de AC) en los tests (`b527231`), y F12 (`GenerativeClient.model` como
propiedad de solo lectura) en producción (`d3322d4`). Los tres están corregidos, el snapshot de tests es idéntico al
registrado tras el `rework tests` autorizado y los 314 tests de los seis archivos afectados pasan en local. F8 se
mantiene por decisión del usuario. No quedan hallazgos BLOQUEANTES ni MAYORES.

## 2. Cumplimiento de la spec
REQ-001 a REQ-011 y NFR-001 a NFR-003 no cambian: desde `378eb19` solo cambian el docstring de
`test_coach_routes.py`, un marcador de `test_meal_routes.py` y la anotación del `Protocol` en `utils/llm_client.py`
(`git diff 378eb19 HEAD`). Ningún archivo de reglas, servicio o ruta del endpoint se ha tocado.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 … AC-011.3, AC-N001.1 … | Sí (sin cambios) | Mismas líneas que en la segunda y tercera review (`7fc3615`, `378eb19`) |
| AC-011.1 | Sí | `meal_routes.py:157-161`; `test_portion_estimate_routes.py:413` y ahora también `test_meal_routes.py:598` `test_portion_estimate_rejects_a_body_larger_than_4096_bytes` (marcador corregido) |
| AC-011.4 | Sí | `test_meal_routes.py:580` `test_post_accepts_a_valid_body_larger_than_4096_bytes` sigue cubriéndolo con su marcador |
| Coach (contrato) | Sí, sin cambios de comportamiento | `llm_client.py:114-116`: `model` es una propiedad de solo lectura del `Protocol`; `LLMClient.model` (`str`, L46) y `LazyLLMClient.model` (atributo, L139/L144) la satisfacen; el único consumidor es `coach_service.py:153` (solo lectura) |

## 3. Cumplimiento del plan
- Sin desviaciones nuevas. F12 no cambia lógica: solo tipa como solo lectura lo que `CoachService` ya leía.
- Sin cambios de modelo ni migración (P2.4). ADR-0037 sigue «Propuesta»: la acepta la sesión principal en el gate
  (Art. P5.2).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: los tests no cambiaron durante implement: `snapshot --check` idéntico (sin cambios, borrados ni añadidos)
      respecto al snapshot de `17:45:42` («F10/F11 corregidos»), que sigue a un `rework tests` registrado en
      `history` (`17:44:26`); `git diff b527231 HEAD -- backend/tests` vacío (`d3322d4` no toca tests).
- [x] B4: marcadores `SDD: 030 …` coherentes; F11 resuelto (`test_meal_routes.py:598` → AC-011.1, y AC-011.4 sigue
      marcado en `test_meal_routes.py:580`).
- [x] B5: sin tests borrados, saltados ni debilitados (los cambios de tests son un docstring y un comentario); sin
      llamadas reales; excepción B5.2 para F3/F5 aceptada por el usuario.
- [x] B5.7: ratchet de ruff sin violaciones nuevas (verify-report, iteración 4).
- [x] B6.5: sin secretos; `PORTION_ESTIMATE_MODEL` en `config.py`; `.env.example` y runbook quedan para `docs`.

### Parte II (proyecto)
- [x] P1 backend.3: sin `monkeypatch` ni `unittest.mock` en los tests de la feature.
- [x] P1.1–P1.2, P1 backend 1, 2, 4, 5: marcadores con `030`, docstrings en español, nombres en inglés.
- [ ] P2.General.1 (parcial, NIT): el docstring corregido de `test_coach_routes.py:2` mantiene «invalidas» sin tilde
      (F13).
- [x] P2.1–P2.5, P3.1–P3.5: sin cambios en rutas, servicios ni reglas del endpoint desde la segunda review.
- [x] P2.4 / P4: sin cambios de modelo ni migración.
- [x] P5.2: ADR-0037 sin aceptar por ningún subagente. P5.3: sin cambios en `backend/scripts/data/**`.

### Hallazgos de la tercera review
| # | Estado |
|---|---|
| F2–F5 (proceso) | Sin código que corregir; se mantienen como MENOR para el backlog. |
| F8 (coach sin clave → 503) | Se deja tal cual por decisión del usuario (es configuración). Cerrado. |
| F10 (docstring) | Corregido: `test_coach_routes.py:1-6` describe ahora `coach_llm` y la fixture `no_real_coach_model`. Queda la tilde (F13). |
| F11 (marcador) | Corregido: `test_meal_routes.py:598` lleva `AC-011.1`. |
| F12 (`Protocol`) | Corregido: `llm_client.py:115-116` con `@property def model(self) -> str \| None`. |

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F2 | MENOR | `backend/tests/fakes.py:769-817` | (Arrastrado.) En la iteración 1 el test-author añadió `FakeStructuredLLMClient` con `cat >>` (Art. B2.4). Contenido correcto; sin acción. | test-author |
| F3 | MENOR | `backend/tests/test_services/test_portion_estimate_service.py:389-447`, `specs/030-diary-portion-chat/tasks.md:57-65` | (Arrastrado.) En la iteración 2 el test-author escribió desde la shell (`cat >>`, `sed -i`). Declarado en `backlog.md`; contenido comprobado. Reforzar la instrucción del rol. | test-author |
| F4 | MENOR | `specs/030-diary-portion-chat/tasks.md:71-74` | (Arrastrado.) El implementer marcó T-038 a T-041 con `sed -i` (Art. B2.4). Solo cambiaron esas casillas. | implementer |
| F5 | MENOR | — | (Arrastrado.) En el red check de la iteración 2 hubo tres llamadas reales a Anthropic; hoy ya no ocurre. El usuario puede revisar el coste en la consola de Anthropic. | test-author |
| F13 | NIT | `backend/tests/test_routes/test_coach_routes.py:2` | El docstring del módulo dice «las preguntas invalidas»: falta la tilde («inválidas», Art. P2.General.1). Lo señaló el verifier. | test-author |

## 6. Decisión
APPROVED: F10, F11 y F12 están corregidos sin tocar comportamiento, el snapshot de tests es coherente con el
`rework tests` autorizado, `d3322d4` no toca tests y no hay hallazgos BLOQUEANTES ni MAYORES. F8 queda cerrado por
decisión del usuario; F2 a F5 son faltas de proceso ya declaradas y F13 es un NIT para el backlog. Fuera de esta
review quedan la etapa `docs` (`PORTION_ESTIMATE_MODEL` en `backend/.env.example` y en `docs/deploy-runbook.md`,
precio de Haiku en Langfuse) y la aceptación de ADR-0037 por la sesión principal con la aprobación del usuario.
