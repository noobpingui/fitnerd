# Review 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Iteración:** 2 de 3 (cuarta pasada, tras la corrección de F9 pedida por el usuario)
- **Diff revisado:** `git diff main...feat/021-usda-food-database` @ `b8cd1af`, centrado en `d4c1113..b8cd1af` (+ cambios sin commitear: solo `backlog.md`, `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
Desde el APPROVED anterior entran cuatro commits: `1c367c8` (spec), `20a6a29` (plan y ADR-0029), `2b53ca6` (tasks) y
`b8cd1af` (tests). No hay cambios de producción: `git diff d4c1113 HEAD` solo toca `specs/021-…`, el ADR-0029 y dos
archivos de test. La spec añade AC-001.8 a AC-001.12 (confirmación del script) y AC-006.10 (orden de texto por
longitud), y describe fielmente lo que ya hacen `backend/scripts/import_usda_foods.py` y `food_repository.py`, sin
abrir alcance nuevo. Los marcadores se han reetiquetado sin cambiar la lógica, y se ha añadido un caso parametrizado de
«y»/«yes». El snapshot es idéntico. He ejecutado los dos archivos de test: 21 passed. Quedan un MENOR de proceso (red
check por excepción) y varios NIT.

## 2. Cumplimiento de la spec
Solo se detallan los AC nuevos. El resto sigue igual que en la tercera pasada.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (párrafo IF … THEN nuevo) | Sí | `backend/scripts/import_usda_foods.py:17-30,57-60`: `_LOCAL_HOSTS`, `_is_local` (sin host → no local), `_confirm` y cancelación con código 1 antes de construir el servicio |
| AC-001.8 | Sí | `import_usda_foods.py:30` acepta `s/si/sí/y/yes` tras `strip().lower()`; `test_import_usda_foods_script.py:114-121` (s, S, sí, si) y `:164-171` (y, Y, yes, YES); un único aviso y código 0 |
| AC-001.9 | Sí | `import_usda_foods.py:26-29,58-60`; tests `:87-111` («n», vacío, EOF → código 1 y `FakeImportService.instances == []`) |
| AC-001.10 | Sí | `import_usda_foods.py:37-39,57`; test `:124-129` (`--yes` con respuesta «n» → sin aviso, código 0) |
| AC-001.11 | Sí | `import_usda_foods.py:17,22`; test `:133-143` (`localhost`, `127.0.0.1`, `[::1]`, `postgres`, `LOCALHOST`). SQLAlchemy quita los corchetes de `[::1]`, como explica el plan |
| AC-001.12 | Sí | `import_usda_foods.py:22` (`host is not None`); tests `:146-161` (`postgresql:///fitnerd` y `servidor-raro`) |
| Spec §6, textos del script | Sí | El aviso «La base de datos NO es local. ¿Escribir en ella? [s/N]: » (`:27`) y «Importación cancelada: no se ha escrito nada.» (`:59`) coinciden literalmente con la spec |
| REQ-006 (frase nueva) y AC-006.10 | Sí | `backend/repositories/food_repository.py:25` (`ts_rank_cd(..., 2)`); `test_food_text_ranking.py:17-54`: 50 largas con FDC ID menores, y el caso de solo tres alimentos. La spec aclara que AC-006.3 no cambia, y la fusión RRF no se ha tocado |
| Alcance §3 (línea nueva) | Sí | Solo enuncia la confirmación y `--yes`, ya implementadas en `d4c1113`. No hay alcance nuevo |

## 3. Cumplimiento del plan
- `plan.md` refleja el script real: firma de `_is_local` y `_confirm`, orden de los pasos y criterio de «host local».
  También recoge la normalización 2 del repositorio y la fila de tests de `test_food_text_ranking.py` y
  `test_import_usda_foods_script.py`.
- **Excepción a P1.3 (`monkeypatch`):** queda justificada en el plan, sección 5, con la alternativa descartada, tal
  como exige P1.3 («salvo justificación en `plan.md`»). Los dobles son escritos a mano y no hay `unittest.mock`. Esto
  cierra una laguna de las pasadas anteriores, en las que el plan decía «sin `monkeypatch`».
- **ADR-0029:** ahora documenta la normalización 2, la confirmación y sus consecuencias, incluido el riesgo de `--yes`
  en el runbook. Sigue en estado «Propuesta», coherente con el resto del plan.
- **`tasks.md`:** tiene 50 tareas. T-045 y T-046 son de reetiquetado, la matriz incluye AC-001.8–12 y AC-006.10, y
  T-051 y T-054 se describen como lo que ya hacía el código.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B1 / B4: trazabilidad completa. Hay 67 AC en `spec.md`, todos con marcador `SDD: 021`, y no hay marcadores con AC
      inexistentes (según el verify-report; lo he contrastado en los dos archivos reetiquetados). Se ha quitado el
      comentario de «sin AC propio».
- [x] B2 (integridad): `snapshot --check` es idéntico (0 cambiados, borrados o añadidos; snapshot de las 09:29:32,
      «reetiquetado … y test de y/yes»). Ese snapshot sigue a `spec rework` → `tests started` → `tests done`, así que el
      cambio de tests está autorizado en `history`. `commits.tests` = `b8cd1af` = HEAD, así que no hay cambios de tests
      posteriores. El diff `d4c1113..b8cd1af` de los tests solo cambia comentarios de marcador, borra un comentario y
      añade el test parametrizado de «y»/«yes». Ningún test se ha debilitado.
- [ ] B5.2 (rojo legítimo): ver F11. El test nuevo de «y»/«yes» nunca estuvo en rojo, como tampoco los 15 de F4 de la
      pasada anterior. El `red_check` PASS se registró por excepción, que consta en `history` (09:30:47, `result` y
      `approved`) con su motivo. La excepción está documentada, pero se apoya en una nota del orquestador.
- [x] B5.3: no hay `skip`, `xfail` ni `.only` nuevos; 1196 backend y 842 frontend en verde (verify-report). Los dos
      archivos, ejecutados en esta revisión: 21 passed.
- [x] B5.4: el script se prueba sin base ni red reales (URL `.invalid`, `FakeApp`).
- [x] B6.5: no hay secretos nuevos. La URL se muestra con la contraseña oculta.

### Parte II (proyecto)
- [x] P1.3: `monkeypatch` justificado en `plan.md` §5; sin `unittest.mock`.
- [x] P2: sin cambios de producción en esta pasada.
- [x] P2 General: los textos de la spec, el plan y el ADR están en español correcto y concuerdan con los del código.
- [x] P4: no hay migraciones nuevas. La protección frente a escribir en una base no local está ahora especificada.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ resuelto | `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py:35` | Resuelto en `0618094`. | implementer |
| F2 | ~~MENOR~~ resuelto en local | `specs/021-usda-food-database/backlog.md` (validación manual de F2) | Queda pendiente la medición en producción y el runbook (etapa docs). | implementer |
| F3 | ~~MENOR~~ resuelto | `backend/services/food_import_service.py:125` | Resuelto en `0618094`. | implementer |
| F4 | ~~MENOR~~ resuelto | `backend/scripts/import_usda_foods.py:17-30,57-60` | Resuelto en `d4c1113`; ahora especificado en AC-001.8 a AC-001.12. | implementer |
| F5 | ~~NIT~~ resuelto | `frontend/src/app/router.tsx:29` | Resuelto en `0618094`. | implementer |
| F6 | NIT (backlog) | `frontend/src/app/foodsRoute.test.tsx:113` | El marcador `AC-012.1` debería ser `REQ-012`. | test-author |
| F7 | NIT (backlog) | `specs/021-usda-food-database/backlog.md` (punto F7) | Las notas antiguas de `state.json` dicen «60 AC», y la línea editada del backlog dice ahora «(spec.md tiene ahora 67), pero `spec.md` tiene 61», que se contradice. Dejar una sola cifra (67) en la etapa docs. | implementer |
| F8 | NIT (backlog) | `backend/scripts/import_usda_foods.py:17` | Un túnel SSH a `localhost` se tomaría por base local y no preguntaría. Advertirlo en el runbook (etapa docs). | implementer |
| F9 | ~~MENOR~~ resuelto | `specs/021-usda-food-database/spec.md` (AC-001.8 – AC-001.12, AC-006.10); `test_import_usda_foods_script.py`; `test_food_text_ranking.py:17,42` | AC añadidos y marcadores reetiquetados sin cambiar la lógica. | spec-writer |
| F10 | ~~NIT~~ resuelto | `specs/021-usda-food-database/backlog.md` | Marcado como hecho. | implementer |
| F11 | MENOR | `specs/021-usda-food-database/state.json` (`history` 09:30:47) | El `red_check` es PASS por excepción, no por rojo observado. El caso «y»/«yes» (`test_import_usda_foods_script.py:164-171`) y los 15 de F4 se escribieron después del código, así que no cumplen B5.2 al pie de la letra. La excepción está anotada con su motivo, pero la autorización del usuario solo consta en la nota del orquestador. Los tests discriminan: el de «y»/«yes» fallaría sin `y` y `yes` en el conjunto de `:30`, y los de «n», vacío y EOF fallarían si se invirtiera la condición. Lo confirma el usuario en el gate de review. | test-author |
| F12 | NIT | `specs/021-usda-food-database/spec.md` (AC-001.8) | AC-001.8 enumera solo «s», «S», «si» y «sí», pero el test `test_host_no_local_responder_y_o_yes_continua` (marcado AC-001.8) prueba «y» y «yes», que solo aparecen en la §6. Conviene añadir «y» y «yes» al AC para que el marcador corresponda exactamente. | spec-writer |

## 6. Decisión
APPROVED: no quedan hallazgos BLOQUEANTES ni MAYORES. Los AC nuevos describen exactamente el comportamiento ya
implementado y revisado, sin alcance nuevo ni cambios de producción. El snapshot concuerda con el historial autorizado.
La excepción del red check está documentada en `history` (F11, MENOR) y la ratifica el usuario en el gate. F6 – F8 y
F12 son NIT para el backlog o la etapa docs.
