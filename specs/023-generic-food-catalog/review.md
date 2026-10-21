# Review 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Iteración:** 3 de 4
- **Diff revisado:** `git diff main...feat/023-generic-food-catalog` @ `ea24a16`; foco en `git diff 1f0ae95 ea24a16` (spec, plan, tareas, `test_food_catalog_csv.py`, `TermsOfServicePage.test.tsx`, `TermsOfServicePage.tsx` y una fila del CSV). Sin commitear: `backlog.md`, `state.json` y `verify-report.md`, solo artefactos del flujo.
- **Veredicto:** APPROVED

## 1. Resumen
La tercera pasada resuelve los cuatro hallazgos abiertos de la iteración 2. F13 (MAYOR): la spec reformula REQ-012 y
AC-012.1 con el gate de spec reabierto y aprobado por el usuario («A», luego «Si»), y la página de Términos ya no
contiene la frase de los alimentos añadidos a mano; el test exige ahora que no aparezca. F14: plan y tareas dicen 261
filas, que es lo que tiene el CSV. F16: la fila de USDA 2346388 se llama «Lechuga iceberg», con «lechuga repollada»
como sinónimo. F17: los dos tests que fijaban el estado del CSV se sustituyeron por reglas de la spec. Spec, plan,
tareas, tests y código son coherentes entre sí: la lista mínima es de 39, el CSV tiene 261 filas y AC-012.1 está
reformulado. Ejecuté los tests del CSV y los de las páginas legales: 93 y 19 pasan. Solo quedan nits.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a 001.4) | Sí | 261 filas de datos (262 líneas con la cabecera); `test_the_repository_csv_validates_without_errors_and_has_250_to_350_foods` (`test_food_catalog_csv.py:85-87`) usa el rango de AC-001.1; lista mínima de 39 sin yuca (`spec.md:94-95`, `test_there_is_no_yuca_row`); `food_catalog.csv:163` `lechuga-iceberg,Lechuga iceberg,lechuga repollada\|lechuga americana,…,usda,2346388`. |
| REQ-002 / REQ-003 | Sí | Sin cambios de código desde la iteración 1. T-127 registra la recarga en desarrollo tras F16, sin errores. |
| REQ-004 a REQ-011, NFR-001, NFR-002 | Sí | Sin cambios desde la iteración 1 (evidencia en las revisiones anteriores). |
| REQ-012 (AC-012.1 a 012.3) | Sí | `spec.md:303-317` reformulado; `TermsOfServicePage.tsx:30-33` conserva la atribución a USDA y el aviso de valores aproximados, sin la frase; `TermsOfServicePage.test.tsx:59-68` lo comprueba con `toContain` y `not.toContain`. Política de privacidad, sin cambios desde la iteración 1. |

## 3. Cumplimiento del plan y de la iteración anterior
- **F13 (MAYOR), resuelto:** REQ-012, AC-012.1, el alcance (`spec.md:195-196`), la sección de textos (`spec.md:441-444`) y
  las respuestas Q4 y Q12 (con la nota «Revisado tras el review (F13)») dicen ya que no se añade la frase. Hubo rework
  de spec con aprobación explícita («Si», `history` 08:56:42) y la decisión del usuario está en «Comentarios del
  usuario» de la spec. El plan (`plan.md:458-460`, matriz REQ-012) y T-049 y T-138 cuadran. La frase no aparece en
  ningún otro sitio del repositorio fuera de los artefactos de la 023 y del test negativo.
- **F14 (MENOR), resuelto:** `plan.md:472` y `tasks.md:86-88` dicen 261. No queda ninguna mención a 264 o 265.
- **F15 (MENOR):** sigue anotado en el backlog de la feature (marcado de casillas con `sed -i`). No es corregible a
  posteriori: queda para que el usuario lo conozca en el gate. En esta ronda no hay indicios de que se haya repetido.
- **F16 (MENOR), resuelto:** `food_catalog.csv:163`, con test (`test_the_iceberg_lettuce_row_is_named_iceberg_and_keeps_repollada_as_synonym`).
  La unicidad de nombres y sinónimos sigue pasando. Lo editó el orquestador con autorización explícita del usuario
  (`history` 09:06:29), igual que en la iteración 2; el diff es solo esa línea.
- **F17 (MENOR), resuelto:** `test_the_csv_has_fewer_than_265_foods` se quitó (el rango 250–350 ya lo cubre el test de
  `:85`) y `test_no_row_has_the_manual_source` pasó a `test_every_manual_row_declares_its_reference`, que admite filas
  `manual` con referencia. Los tests de marcas, contramuslo y limonada ya no llevan AC-001.3 (ver F21, NIT).
- **F7 a F12 y F18 a F20 (NIT):** sin tocar, como estaba previsto (backlog).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B1.3: la spec cambió con el gate reabierto y aprobado por el usuario; plan y tareas se ajustaron después, en
  commits separados (`11311ba`, `654ee92`, `a66dcf8`).
- [x] B2: `snapshot --check` idéntico (26 archivos, snapshot de 09:01:11). El cambio de tests `d96070a` está autorizado:
  `rework` (review 2/3), red check PASS acotado y `snapshot` posterior en `history`. El commit de implementación
  `ea24a16` no toca tests.
- [x] B2.4: sin nuevas escrituras desde la shell registradas en esta ronda (F15 sigue abierto como antecedente).
- [x] B4: los tests nuevos o modificados llevan `# SDD: 023 …` (ver F21 sobre la precisión del marcador).
- [x] B5: no hay tests saltados. Los dos tests quitados o sustituidos (F17) los pidió la review y se reemplazan por
  reglas de la spec (rango de AC-001.1, filas `manual` con referencia); el de Términos se invirtió porque cambió el AC.
- [x] B5.7 / B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1/P1.2: nombres de test en inglés, docstrings en español y marcadores con número de spec.
- [x] P2 / P3: sin cambios de código de backend desde la iteración 1.
- [x] P2 General: los nombres principales del CSV son neutros; «Lechuga repollada» queda solo como sinónimo.
- [ ] P4: los pasos de producción (migración `d4f6a8c0e2b5` antes del merge y carga del CSV tras el CD) siguen
  pendientes para el `doc-keeper` en `docs/deploy-runbook.md` y `CLAUDE.md`, que también debe dejar de describir la
  pantalla `/foods` y la búsqueda de USDA como la del diario.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F21 | NIT | `backend/tests/test_services/test_food_catalog_csv.py:179`, `:189`, `:201`, `:162` | Los tests de marcas, contramuslo y limonada, y el de la lechuga iceberg, pasaron al marcador AC-001.2, que trata de la unicidad de nombres y sinónimos (`spec.md:90-91`), y tampoco es lo que comprueban. Encajan mejor con AC-001.1 («se valida con las reglas de la sección 6»). Solo afecta a la trazabilidad. | test-author |
| F22 | NIT | `frontend/src/features/legal/pages/TermsOfServicePage.tsx:5` | Sin la frase, «Términos de servicio» no cambia de contenido respecto a la 022, pero su fecha de actualización pasa a «21 de octubre de 2026». Lo pide AC-012.3 y el plan lo deja así (`plan.md:458-460`), así que es coherente; anotar si conviene volver a «20 de octubre de 2026» en una revisión futura de la spec. | spec-writer |

Los hallazgos F7 a F12 y F18 a F20 de las iteraciones anteriores siguen abiertos como NIT y están en el backlog de la
feature.

## 6. Decisión
**APPROVED.** F13, F14, F16 y F17 están resueltos, y spec, plan, tareas, tests y código coinciden en la lista mínima de
39 alimentos, las 261 filas del CSV y el nuevo AC-012.1. No quedan hallazgos BLOQUEANTES ni MAYORES; solo nits
(F7 a F12, F18 a F22) y F15, que el usuario debe conocer en el gate. Quedan para el gate de `review`: la revisión
manual del contenido del CSV, la prueba visual del diálogo y saber que el orquestador editó el CSV dos veces con
autorización del usuario.

## Comentarios del usuario
