# Review 021 — Base de alimentos de USDA en Postgres con búsqueda híbrida

- **Iteración:** 2 de 3 (tercera pasada, pedida por el usuario tras el APPROVED anterior)
- **Diff revisado:** `git diff main...feat/021-usda-food-database` @ `d4c1113`, centrado en `0618094..d4c1113` (+ cambios sin commitear: solo `state.json` y `verify-report.md` de la feature)
- **Veredicto:** APPROVED

## 1. Resumen
Desde el APPROVED anterior entran dos commits, `adeb9e6` (tests) y `d4c1113` (implementación), que hacen tres cosas.
F4: `import_usda_foods.py` pide confirmación `[s/N]`, o `--yes`, si la base no es local. Ranking: `find_text_matches`
normaliza `ts_rank_cd` por la longitud del documento. Tests: 17 nuevos. La lógica de «host local» es segura por defecto, el AC-006.3 se
sigue cumpliendo y no veo regresiones. He comprobado en la base local, con una consulta de solo lectura, que «banana» devuelve ahora «Bananas, raw» en
primer lugar. Solo quedan hallazgos MENORES y NIT.

## 2. Cumplimiento de la spec
Ningún AC cambia de comportamiento salvo el orden interno de los candidatos de texto, que la spec no fija. Lo que no se
menciona abajo sigue igual que en la iteración 2.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 – AC-005.2 | Sí (sin cambios) | `usda_csv_reader.py`, `food_import_service.py`; la confirmación de `import_usda_foods.py:57-60` va antes de construir el servicio, así que la importación no cambia cuando se continúa |
| AC-006.1 | Sí | `backend/repositories/food_repository.py:25-29`; «chicken breast» sigue pasando (`test_food_routes.py`); además, `test_food_text_ranking.py:17-54` |
| AC-006.3 | Sí | La fusión RRF no cambia (`backend/services/food_search_service.py:39-46`). La normalización solo reordena la lista de texto, y quien coincide por las dos vías suma dos términos `1/(k+pos)`. Con `k=60` y 40 candidatos por lista, eso supera siempre a quien solo está en una (`test_fuse_rankings_double_hit_wins_even_at_the_end_of_both_lists`, `test_food_routes.py:122-141`, en verde) |
| AC-006.2, AC-006.4 – AC-006.9 | Sí (sin cambios) | `food_search_service.py:57-83`; los 79 tests de búsqueda, script y ranking pasan (ejecutados en esta revisión) |
| AC-007.1 – AC-014.1, AC-N001.1, AC-N002.1, AC-N002.2 | Sí (sin cambios) | Ver la iteración 2; el frontend no cambia en esta pasada (842 tests, lint, tsc y build en verde según el verify-report) |
| Alcance §3: consultas manuales y tamaño de `public.foods` | Hecho en local | `backlog.md`, sección «validación manual de F2»: 22 consultas, 48 MB, migraciones aplicadas en local. La medición en producción sigue pendiente (P4, etapa docs) |

## 3. Cumplimiento del plan
- **F4, resuelto (`backend/scripts/import_usda_foods.py:17-30,57-60`):** es seguro por defecto.
  - `_is_local` devuelve `False` si no hay host (socket Unix, `postgresql:///db`) o si el host es desconocido. Solo se
    tratan como locales `localhost`, `127.0.0.1`, `::1` y `postgres`, sin distinguir mayúsculas.
  - `postgres` es el nombre del servicio de `docker-compose.yml`. `docker-compose.prod.yml` no tiene servicio `postgres`
    (línea 4), y la base de producción es un host de Supabase, que no es local y siempre pregunta.
  - La respuesta por defecto (vacía), cualquier texto que no sea `s/si/sí/y/yes` y `EOFError` (sin TTY, CI) cancelan
    con código 1 antes de construir el servicio o de escribir nada.
  - Antes de preguntar, el script muestra la URL con la contraseña oculta (`render_as_string(hide_password=True)`).
  - Lo que se escapa son los casos raros en los que un host local apunta en realidad a una base remota, como un túnel SSH a `localhost` o
    `127.0.0.2`. Esos los trato en sentido contrario: `127.0.0.2` pregunta, y está bien. Ver F8.
- **Normalización `ts_rank_cd(..., 2)` (`food_repository.py:25`):** divide el rango por la longitud del documento. Lo
  he contrastado contra la base local importada (8.262 alimentos), con una consulta de solo lectura. Los primeros para
  «banana» son ahora `Bananas, raw`, `Bananas, dehydrated…`, `Melon, banana`… El problema que anotó el orquestador
  queda corregido. El desempate por `fdc_id` se mantiene, y `websearch_to_tsquery` sigue sin interpolar la consulta (SQL
  parametrizado).
- **Desviación respecto a la spec:** ni la confirmación del script ni el criterio de relevancia por longitud tienen AC
  propio, y los tests llevan los marcadores aproximados `REQ-001` y `AC-006.1`. Está justificado como pasada pedida por el usuario y ya
  figura en el backlog del test-author. Ver F9.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` es idéntico (0 cambiados, borrados o añadidos). Desde `commits.tests` (`b1ac9ee`), los
      tests cambian en `d009a5a` (E501) y `adeb9e6` (17 tests nuevos). Los dos están autorizados en `history`
      (`rework tests` → `done` → `snapshot` a las 07:08 y a las 09:11-09:13). `d4c1113` no toca tests.
- [x] B4: los marcadores son coherentes en lo esencial. Los de esta pasada son aproximados, por falta de AC (F9).
- [x] B5: no hay tests borrados, saltados ni debilitados. Los tests del script usan dobles escritos a mano y una URL
      `.invalid`, sin base ni red reales. Los de ranking usan el Postgres de pruebas. El de ranking con 50
      descripciones largas fallaría sin la normalización: las largas tienen un FDC ID menor y ganarían el desempate.
      Prueba de verdad el cambio.
- [x] B5.7: el ratchet de ruff no da violaciones nuevas (verify-report).
- [x] B6.5: no hay secretos ni variables nuevas. La URL impresa oculta la contraseña.

### Parte II (proyecto)
- [x] P1: los tests están en `tests/test_scripts/` y `tests/test_services/`, con dobles escritos a mano y marcador `SDD: 021`.
- [x] P2.1 / P2.2: el cambio de ranking se queda en el repositorio. El script sigue construyendo el servicio con
      inyección por constructor.
- [x] P2 General: mensajes y comentarios en español correcto.
- [x] P3.4: SQL parametrizado (`func.websearch_to_tsquery` con parámetro ligado).
- [x] P4: sin migraciones nuevas en esta pasada. Una operación que escribe en una base no local exige ahora
      confirmación explícita.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | ~~MAYOR~~ resuelto | `backend/migrations/versions/c8e2a4f6b9d3_create_foods_table.py:35` | Resuelto en `0618094`. | implementer |
| F2 | ~~MENOR~~ resuelto en local | `specs/021-usda-food-database/backlog.md` (validación manual de F2) | Migraciones aplicadas, importación real, 22 consultas y tamaño (48 MB) medidos en local. Quedan pendientes la medición en producción y el runbook (etapa docs). | implementer |
| F3 | ~~MENOR~~ resuelto | `backend/services/food_import_service.py:125` | Resuelto en `0618094`. | implementer |
| F4 | ~~MENOR~~ resuelto | `backend/scripts/import_usda_foods.py:17-30,57-60` | Confirmación `[s/N]` o `--yes` con base no local. Ante la duda (sin host o con host desconocido) pregunta. EOF y respuesta vacía cancelan. | implementer |
| F5 | ~~NIT~~ resuelto | `frontend/src/app/router.tsx:29` | Resuelto en `0618094`. | implementer |
| F6 | NIT (backlog) | `frontend/src/app/foodsRoute.test.tsx:113` | El marcador `AC-012.1` debería ser `REQ-012`. | test-author |
| F7 | NIT (backlog) | `specs/021-usda-food-database/state.json` (notas) | «60 AC» frente a los 61 de `spec.md`. Corregirlo en la documentación. | implementer |
| F8 | NIT | `backend/scripts/import_usda_foods.py:17` | Un túnel SSH (`localhost:XXXX` → Supabase) se tomaría por local y no preguntaría. Basta con advertirlo en el runbook, o con decidir la pregunta por `FLASK_ENV` además del host. | implementer |
| F9 | MENOR (backlog) | `backend/tests/test_scripts/test_import_usda_foods_script.py:89-164`; `backend/tests/test_services/test_food_text_ranking.py:16,42` | Ni la importación segura ni el orden por longitud tienen AC en `spec.md`, y los tests llevan los marcadores aproximados `REQ-001` y `AC-006.1`. Conviene añadir los dos AC y reetiquetar. Ya está anotado en el backlog del test-author. | spec-writer |
| F10 | NIT | `specs/021-usda-food-database/backlog.md` (validación manual, punto «banana») | El punto sigue abierto `[ ]`, pero ya está corregido: en local, «Bananas, raw» sale primero. Marcarlo como hecho en la etapa docs. | implementer |

## 6. Decisión
APPROVED: no quedan hallazgos BLOQUEANTES ni MAYORES. La confirmación del script es segura por defecto, la
normalización de `ts_rank_cd` corrige el caso «banana» sin afectar al AC-006.3, y los tests nuevos están autorizados
en `history` y prueban de verdad los cambios. F6 – F10 son menores o NIT. Junto con «avena cocida» y el umbral 0,6 del
backlog, los decide el usuario en el gate de review.
