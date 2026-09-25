# Protocolo del orquestador SDD

Este archivo es de lectura obligatoria para todas las skills `/sdd-*`. Lo ejecuta **la sesión principal**, nunca un subagente (ADR-0001). La tabla de etapas está en [`stages.md`](stages.md).

## 0. Principios
1. **El orquestador no hace el trabajo de los roles.** Nunca escribe spec, plan, tareas, tests, código, reportes ni reviews: delega siempre en el subagente de la etapa. Solo escribe `idea.md` y `state.json`, y copia literalmente las respuestas del usuario en la tabla "Preguntas abiertas" de `spec.md`.
2. **La comunicación entre agentes pasa solo por disco.** El prompt a un subagente contiene únicamente:
   - la ruta de la feature;
   - la etapa y el modo;
   - el número de iteración;
   - qué artefactos leer, incluidos los informes con hallazgos.

   No se pasan resúmenes de la conversación ni opiniones del orquestador.
3. **Nada avanza sin la aprobación explícita del usuario.** Son aprobación: "aprobado", "sí", "ok, sigue" o equivalentes claros. **No** lo son el silencio, un "mmm", una pregunta o un "luego vemos". Ante la duda, se pregunta.
4. **Una etapa por aprobación.** Nunca se encadena la siguiente etapa sin gate, ni se agrupan varias etapas en una sola aprobación.

## 1. Resolver la feature
- Con argumento (`NNN-slug` o solo `NNN`): se usa `specs/NNN-*/`.
- Sin argumento: se deduce de la rama actual (`feat/NNN-slug` o `fix/NNN-slug` → `specs/NNN-slug/`).
- Si no se puede resolver, se listan las features (como `/sdd-status`) y se pregunta cuál.
- **Siempre** se verifica que la rama actual coincide con `state.json.branch`. Si no coincide, hay que detenerse y proponer `git checkout <rama>`, que requiere aprobación.

## 2. Delegar una etapa
1. Lee `state.json` y comprueba las precondiciones de la etapa (`stages.md`). Si no se cumplen, detente y explica qué falta.
2. Antes de delegar, actualiza `state.json`: `stage=<etapa>`, `status="in_progress"` y una entrada en `history`. Los hooks leen este campo.
3. Invoca al subagente de la etapa con la herramienta Agent (`subagent_type: <agente>`) y un prompt mínimo como este:
   ```
   Feature: specs/NNN-slug/  ·  Etapa: <etapa>  ·  Modo: <red|full|->  ·  Iteración: <n>/3
   Lee tus entradas según tu definición. Hallazgos a corregir (si aplica): specs/NNN-slug/<verify-report.md|review.md>, ítems <F1, F3…>
   Tu mensaje final debe ser EXACTAMENTE el bloque "Informe final" de tu definición.
   ```
   La aprobación de cada etapa vive solo en `state.json` (`approvals`); los artefactos no tienen campo de estado.
4. Lee el **informe final** del agente (`STATUS / ARTIFACTS / SUMMARY / …`) y **verifica en disco** que los artefactos existen. No te fíes solo del informe.
5. Según el `STATUS` del informe:
   - `DONE`, `PASS` o `APPROVED`: pasa al gate (§3). Tras el `reviewer`, copia tú el veredicto de `review.md` a `state.json.review = {"verdict": …, "at": …}`, porque el reviewer no puede escribir `state.json`. Haz lo mismo con `CHANGES_REQUESTED`.
   - `NEEDS_INPUT`: muestra las preguntas al usuario con la respuesta propuesta de cada una. Cuando responda, copia las respuestas literalmente en el artefacto que corresponda y vuelve a delegar. Esto no consume iteración.
   - `FAIL` o `CHANGES_REQUESTED`: aplica el ciclo de corrección (§5).
   - `BLOCKED`: `status="blocked"`. Explica el bloqueo y el comando o la decisión que lo resuelve, y espera al usuario.

## 3. Gate de cierre de etapa
Pon `status="awaiting_approval"` y muestra **exactamente** esta estructura:

```markdown
## Etapa <etapa> cerrada · feature NNN-slug
**Agente:** <agente> · **Iteración:** n/3
**Producido:**
- `ruta` — qué contiene (1 línea)
**Decisiones del agente:** <las relevantes, o "ninguna">
**Verificación:** <resultado objetivo si aplica: tests, red check, veredicto>
**Qué debes revisar tú:** <2-4 puntos concretos para esta etapa (ver stages.md)>
**Siguiente etapa:** <etapa> (<agente>)
**Preguntas abiertas:** <o "ninguna">

---
## Commit propuesto (Regla B)        ← omitir esta sección si la etapa no hace commit
**Rama:** feat/NNN-slug
**Archivos:** (salida de `git status --short` y `git diff --stat` de lo que se añadirá)
**Resumen:** <lenguaje claro>
**Mensaje:**
    <mensaje según stages.md>

    Co-Authored-By: <línea indicada por el entorno>

---
Responde:
1. ¿Apruebas cerrar la etapa <etapa>?
2. ¿Apruebas el commit?              ← solo si hay commit
```

Después **termina tu turno** y espera.

Cuando el usuario responda:
- **Aprueba la etapa:**
  - Anota `approvals.<etapa> = {"at": "<ISO>", "note": "<texto literal breve del usuario>"}` y añade una entrada a `history`.
  - Si **también** aprueba el commit, haz commit (§4) y guarda el sha en `commits.<etapa>`.
  - Al aprobar la etapa `tests`, guarda `tests_snapshot = {"at", "sha256": {<ruta>: <hash>}}` con el SHA-256 de cada archivo de test de la feature, más `conftest.py`, `fakes.py` y `frontend/src/test/setup.ts` si los tocó. El reviewer lo usa para comprobar que los tests no cambiaron. Detecta también escrituras hechas desde la shell, a diferencia de los hooks.
  - Si aprueba la etapa pero **no** el commit, los cambios quedan sin commitear y se acumulan para el siguiente commit. Indícalo así en el siguiente gate.
  - Pon `stage=<siguiente>` y `status="in_progress"`.
  - Con `/sdd-run`, continúa con la siguiente etapa. Con una skill individual, termina indicando el siguiente comando.
- **Pide cambios:**
  - Si el cambio le corresponde al agente de la etapa, se lo devuelves con las indicaciones copiadas literalmente en el artefacto: en la sección de preguntas abiertas si es `spec.md`, o en una sección "Comentarios del usuario" al final si es otro artefacto.
  - Después vuelve a presentar el gate.
- **Rechaza o pausa:** `status="blocked"` y deja constancia en `history`.

## 4. Commits y push (Reglas B y C)
- **Solo el orquestador** ejecuta `git add`, `git commit`, `git push`, `git merge` y `git checkout -b`. Ningún subagente lo hace, y un hook lo impide.
- **Commit:**
  - Añade solo los archivos listados en el resumen aprobado, con `git add <rutas>` explícitas, **nunca** `git add -A` ni `git add .`.
  - Antes de hacer commit, comprueba que no se cuela ningún `.env`, `*.pem` ni secreto.
  - Usa un heredoc para el mensaje. Nunca `--no-verify` ni `--amend` sobre commits ya aprobados.
- **Push:** siempre en una aprobación **separada**. Muestra:
  ```markdown
  ## Push propuesto (Regla C)
  **Origen → destino:** feat/NNN-slug → origin/feat/NNN-slug
  **Commits a subir:** (salida de `git log --oneline origin/<rama>..HEAD`, o `<base_branch>..HEAD` si la rama es nueva)
  ¿Apruebas el push?
  ```
- El hook `git-guard` volverá a pedir confirmación nativa al ejecutar el comando. Es una segunda barrera, no sustituye al resumen.

## 5. Ciclos de corrección
| Falla | Vuelve a | Contador | Luego |
|---|---|---|---|
| red check `FAIL` (tests inválidos o que pasan sin implementación) | `test-author` | `iterations.tests` | red check de nuevo |
| verify `FAIL` atribuible a código | `implementer` | `iterations.implement` | verify de nuevo |
| verify `FAIL` atribuible a tests | `test-author`; después, red check solo de los tests tocados, implement y verify | `iterations.tests` | — |
| review `CHANGES_REQUESTED` | el responsable de cada hallazgo (`implementer`, `test-author`, `planner` o `spec-writer`) | `iterations.review` | verify `full` y review de nuevo |

- Antes de reenviar, incrementa el contador y apunta el retroceso en `history`, con `stage` igual a la etapa del agente responsable, para que los hooks le permitan escribir.
- Si un hallazgo afecta a **spec** o **plan**, el cambio reabre esa etapa: vuelven a `null` sus `approvals` y las de todas las posteriores, y los gates se repiten desde ahí.
- **Corregir un test después de `implement`** (hallazgo de verify o review asignado al `test-author`): no se repite el red check, porque el test debe **pasar** con la implementación existente. Tras la corrección, el orquestador actualiza `tests_snapshot` y lo apunta en `history` como un cambio autorizado. En la siguiente iteración, el reviewer confirma que el test sigue probando su AC.
- **Límite:** si un contador llega a `max_iterations` (3) y vuelve a fallar, pon `status="blocked"` y **escala al usuario** con:
  - un resumen de cada intento: qué falló y qué se cambió;
  - la causa raíz probable;
  - las opciones: (a) conceder N iteraciones más, (b) ajustar la spec o el plan, (c) intervenir manualmente, (d) abandonar la feature.
- Las correcciones pasan por el gate de la etapa que se repite, igual que la primera vez.

## 6. Mantenimiento de `state.json`
- Las fechas se obtienen siempre del sistema, nunca se escriben a mano: `node -e "console.log(new Date().toISOString())"`.
- Tras cada cambio, valida que sigue siendo JSON válido: `node -e "JSON.parse(require('fs').readFileSync('<ruta>','utf8'))"`.
- `history` solo crece: `{"at": "<ISO>", "stage": "<etapa>", "event": "<started|done|approved|changes_requested|rework|blocked|commit|push>", "note": "<breve>"}`.
- Nunca se borran aprobaciones históricas. Al reabrir una etapa, se ponen a `null` y se deja constancia en `history`.
