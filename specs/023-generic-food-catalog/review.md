# Review 023 — Catálogo genérico de alimentos en español que sustituye a USDA en la búsqueda del diario

- **Iteración:** 2 de 4
- **Diff revisado:** `git diff main...feat/023-generic-food-catalog` @ `1f0ae95`; foco en `git diff e7792b5 1f0ae95` (CSV, `test_food_catalog_csv.py`, spec, plan y tareas). Sin commitear: `backlog.md`, `state.json` y `verify-report.md`, solo artefactos del flujo.
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen
La segunda pasada corrige el CSV como pedía la iteración 1: no queda la fila `yuca-cocida` ni ninguna fila `manual`,
quedan 261 alimentos y F2 a F6 están resueltos (detalle en §3). Repetí la consulta de solo lectura a la base de
desarrollo: los 261 FDC ID existen, sus cuatro valores coinciden exactamente con `public.foods` (0 diferencias) y
`catalog_foods` tiene 261 filas, sin la yuca. Además, revisé una por una las 261 filas con la descripción de USDA de cada
FDC ID: no hay ningún alimento frito, ningún plato compuesto ni ninguno preparado con aceite. Lo que impide aprobar
viene de quitar la yuca: «Términos de servicio» sigue diciendo que «algunos alimentos de comida local se añadieron a
mano», y ya no hay ninguno (F13, que queda abierto desde la iteración 1, donde formaba parte de F1). También hay
desajustes menores entre los artefactos y el CSV real, y dos tests que fijan el estado actual del CSV en lugar de la
spec.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| REQ-001 (AC-001.1 a 001.4) | Sí | 261 filas (`test_the_repository_csv_validates_without_errors_and_has_250_to_350_foods`); la lista mínima de 39 se cubre por nombre o sinónimo, cada alimento en una fila distinta (`test_food_catalog_csv.py:66-81`); «Zanahoria» se cubre con el sinónimo de `zanahoria-cocida` (`food_catalog.csv:165`). Los 16 tests del CSV pasan (los ejecuté). Las reglas de contenido 1 a 3: ver §5 (sin hallazgos mayores). |
| REQ-002 / REQ-003 | Sí | Sin cambios de código desde la iteración 1. La recarga en desarrollo deja 261 filas y quita la yuca (consulta de solo lectura). |
| REQ-004 a REQ-011, NFR-001, NFR-002 | Sí | Sin cambios desde la iteración 1 (evidencia en la revisión anterior). |
| REQ-012 (AC-012.1 a 012.3) | **Parcial** | `TermsOfServicePage.tsx:33-34` dice «Algunos alimentos de comida local se añadieron a mano a partir de otras tablas de composición de alimentos.», como pide AC-012.1, pero el CSV ya no tiene ninguna fila `manual` (`test_no_row_has_the_manual_source`, `test_food_catalog_csv.py:161`). El texto legal describe un origen de datos que no existe. Ver F13. |

## 3. Cumplimiento del plan y de la iteración anterior
- **F1 (MAYOR), resuelto:** la fila `yuca-cocida` se quitó del CSV y de la base de desarrollo, y «Yuca cocida» salió de la
  lista mínima de la spec (§6), de AC-001.4 (39 alimentos) y de `MINIMUM_LIST` en el test. El cambio de spec reabrió el
  gate de spec, con aprobación explícita del usuario («Si», `history` 08:29:02). La parte de F1 sobre REQ-012 sigue
  abierta (F13).
- **F2, resuelto:** quedan una sola «Zanahoria cocida» (`:165`), con «zanahoria» como sinónimo, y un solo «Champiñones
  cocidos» (`:190`). «Frijoles navy cocidos» se quitó.
- **F3, resuelto:** ya no aparecen «pan bimbo» (`:15`) ni «queso filadelfia» (`:104`).
- **F4, resuelto:** «contramuslo de pollo» pasó a «Muslo de pollo al horno» (`:44`), y «limonada sin azúcar» se quitó
  (`:261`).
- **F5, resuelto:** «Ejotes cocidos», con «vainicas cocidas» como sinónimo (`:181`), y «Calabaza moscada al horno» (`:184`).
- **F6, resuelto:** «Abadejo de Alaska al horno» (`:76`), «Lubina rayada al horno» (`:74`) y «Sémola de maíz cocida»
  (`:208`) ya corresponden a su alimento de USDA.
- **F7 a F12 (NIT):** siguen sin tocar, como estaba previsto (en el backlog).
- **Coherencia de artefactos:** la spec, `MINIMUM_LIST` y AC-001.4 coinciden en los 39 alimentos. `plan.md:472` y
  `tasks.md:86,88` dicen que el CSV queda en **264** filas, pero tiene **261**, porque también se quitaron las tres
  filas de F2 (F14).
- **Edición del CSV por el orquestador:** según el `history` (08:38:09), el usuario lo autorizó de forma explícita
  porque el role-guard no reconoce `backend/scripts/data/` desde el cambio de config. El diff (`1f0ae95`) se limita a
  las correcciones de F1 a F6. No lo cuento como hallazgo, pero conviene arreglar el role-guard o el config (backlog).
- **`state.json`** sigue con `"max_iterations": 3` y el config tiene 4 (ya avisado en la iteración 1).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B1.3: la spec cambió con el gate reabierto y aprobado por el usuario, y plan y tareas se ajustaron después.
- [ ] B2.4: `backlog.md` («implement (corrección por review)») recoge que el implementer marcó T-120 a T-123 y T-125 en
  `tasks.md` con `sed -i` desde la shell. Solo cambió casillas y el contenido es correcto (69/69 `[x]`), pero la
  constitución lo prohíbe expresamente (F15).
- [x] B2: `snapshot --check` da idéntico (26 archivos, snapshot de 08:34:24). El commit `1f0ae95` no toca tests; el único
  cambio en tests desde `e7792b5` es `73274c3`, autorizado (`rework tests`, red PASS y `snapshot` en `history`).
- [x] B4: los tests nuevos de `test_food_catalog_csv.py` llevan `# SDD: 023 …`. Tres de ellos (marcas, contramuslo y
  limonada) están marcados como AC-001.3, que trata de las palabras prohibidas, y no de los sinónimos (F17).
- [x] B5: no hay tests borrados, saltados ni debilitados; `test_the_minimum_list_has_40_foods` se sustituyó por una versión
  más fuerte, que comprueba el CSV real.
- [x] B5.7 / B6.5: sin cambios de código; sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1.1/P1.2: marcadores con número de spec, nombres de test en inglés y docstrings en español.
- [x] P2 / P3: sin cambios de código desde la iteración 1 (ver revisión anterior).
- [x] P2.4: sin cambios de modelo ni de migración en esta iteración.
- [ ] P2 General: los nombres son ahora mayoritariamente neutros; queda «Lechuga repollada» (F16).
- [ ] P4: los pasos de producción (migración antes del merge y carga tras el CD) siguen pendientes para el `doc-keeper`
  en `docs/deploy-runbook.md`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F13 | MAYOR | `specs/023-generic-food-catalog/spec.md:303-311` y `:441-442`; `frontend/src/features/legal/pages/TermsOfServicePage.tsx:33-34` | REQ-012 y AC-012.1 exigen que «Términos de servicio» diga que «Algunos alimentos de comida local se añadieron a mano a partir de otras tablas de composición de alimentos.», y la página lo dice. Pero, sin la yuca, el CSV no tiene ninguna fila `manual`, y un test lo exige (`test_food_catalog_csv.py:161`). El texto legal atribuye a los datos un origen que no tienen. Ya lo señalé en la iteración 1 (REQ-012 «Parcial», dentro de F1), pero el ajuste de la spec solo cambió la lista mínima. Hay que reformular REQ-012 y AC-012.1, por ejemplo quitando la frase hasta que exista una fila `manual`. Después, el test-author ajusta `TermsOfServicePage.test.tsx:60-65` y el implementer, la página. Otra opción es que el usuario acepte de forma explícita en el gate mantener la frase pensando en el futuro. | spec-writer |
| F14 | MENOR | `specs/023-generic-food-catalog/plan.md:472`, `tasks.md:86`, `tasks.md:88` | Dicen que el CSV queda en 264 filas, pero tiene 261, porque también se quitaron `zanahoria`, `champinones` y `frijoles-navy-cocidos` (F2). La docstring de `test_food_catalog_csv.py:150` («264 filas o menos») sí es correcta. | planner |
| F15 | MENOR | `specs/023-generic-food-catalog/tasks.md:83-88` | Según el backlog de la feature, el implementer marcó estas casillas con `sed -i` desde la shell, algo que prohíbe el Art. B2.4. El resultado es correcto, pero el usuario debe conocerlo en el gate y no debe repetirse. | implementer |
| F16 | MENOR | `backend/scripts/data/food_catalog.csv:163` | «Lechuga repollada» es un regionalismo (sobre todo de Costa Rica y del Cono Sur) como nombre principal; es el mismo caso que «Vainicas» en F5 (regla 2). El alimento de USDA es «Lettuce, iceberg»: el nombre neutro sería «Lechuga iceberg» (o «Lechuga americana»), con «lechuga repollada» como sinónimo. | implementer |
| F17 | MENOR | `backend/tests/test_services/test_food_catalog_csv.py:149-151`, `:161-163` | `test_the_csv_has_fewer_than_265_foods` (exige menos de 265 filas) y `test_no_row_has_the_manual_source` (exige que no haya filas `manual`) fijan el estado actual del CSV, no una regla de la spec. AC-001.1 admite de 250 a 350 filas y el formato admite filas `manual`, que el plan conserva «para el futuro» (`plan.md:473`). Añadir un alimento o la yuca con fuente verificable, como prevé la decisión del usuario, rompería estos tests sin incumplir la spec. Además, los tests de marcas, contramuslo y limonada (`:171-203`) llevan el marcador AC-001.3, que no habla de sinónimos. Conviene usar el rango de AC-001.1 y quitar o reformular el test de filas `manual` según se resuelva F13. | test-author |
| F18 | NIT | `food_catalog.csv:34`, `:192`, `:171` | Hay alimentos crudos que se suelen comer cocidos (regla 3): «Tempeh» y «Puerro» (ya en F9) y, además, «Pak choi» («Cabbage, chinese (pak-choi), raw»). | implementer |
| F19 | NIT | `food_catalog.csv:151`, `:153`, `:138`, `:106`, `:112`, `:203` | Hay sinónimos dudosos que no estaban en F8. «graviola» (guanábana) es portugués, como «pinha». «granadilla» en «Maracuyá» la usa USDA («Passion-fruit, (granadilla)»), pero en Costa Rica, Colombia y México es otra fruta (*Passiflora ligularis*). «queso gruyer» en «Queso suizo» es otro queso (USDA tiene «Cheese, gruyere», 413 kcal frente a 393). «natilla» en «Crema agria» es correcto en Costa Rica, pero en España y Colombia es un postre. «tomate verde» en «Tomatillo» es correcto en México, pero en otros países es el tomate sin madurar. | implementer |
| F20 | NIT | `food_catalog.csv:169`, `:188`, `:202` | «berza» está en «Repollo», «berza rizada cocida» en «Col rizada cocida» y «berza cocida» en «Col verde cocida»: buscar «berza» devuelve tres coles distintas. | implementer |

**Pasada completa de las 261 filas con las reglas 1 a 3 (sin hallazgos aparte de los de arriba):**
- **Regla 1, alimentos compuestos:** ninguna fila es un plato o una combinación. Los procesados (panes, tortillas,
  galletas saladas, jamones, tocino, quesos, bebidas vegetales, mantequillas de frutos secos y chocolate amargo) son de
  un ingrediente base, como admite la regla.
- **Regla 3, fritos o con aceite:** ninguna descripción de USDA dice *fried* ni *with oil*. Las tortillas son
  «ready-to-bake or -fry» sin preparar, las palomitas son «air-popped», el maní es «dry-roasted» y el tocino es
  «baked». Las galletas saladas llevan grasa en la receta, como el pan, y lo acepto como procesado.
- **Regla 3, crudo o cocido:** los granos, las legumbres, los tubérculos, las carnes y los pescados son todos de cocción
  sin grasa añadida (*boiled*, *roasted*, *broiled*, *dry heat*, *moist heat*, *braised*, *steamed*). Los crudos son
  frutas, verduras de ensalada, frutos secos y semillas, salvo F18.
- **Una sola versión:** las variantes que quedan son alimentos distintos (por ejemplo, leche entera, semidescremada y
  descremada, que pide la lista mínima; arvejas verdes y secas; atún en agua y fresco; las lechugas de hoja, romana e
  iceberg). Las acepto.

## 6. Decisión
**CHANGES_REQUESTED.** F1 a F6 están resueltos, y el CSV (261 filas, valores idénticos a USDA, sin fritos, compuestos
ni filas `manual`) cumple las reglas de contenido salvo nits. Para aprobar falta resolver F13: la frase de «Términos
de servicio» sobre los alimentos añadidos a mano ya no es cierta. Hay dos caminos: que el `spec-writer` reformule
REQ-012 y AC-012.1 (con el ajuste posterior del test y de la página) o que el usuario acepte la frase de forma explícita
en el gate de `review`. F14 a F17 son menores y se pueden corregir en la misma ronda.

## Comentarios del usuario
