# ADR-0034: Finales de línea LF, aceptación de ADR por la sesión principal y edición de archivos de datos

- **Estado:** Propuesta · 2026-10-22 (rama `chore/harness-friction`)
- **Decidido por:** el orquestador, a petición del usuario; pendiente de su aprobación en el gate de cierre.

## Contexto
Tras las specs 019 a 025 se repiten tres fricciones del flujo SDD que no son de ninguna feature:

1. **Finales de línea.** El repositorio guarda LF, pero `core.autocrlf=true` en Windows deja los archivos de texto en
   CRLF en el disco. Los hashes de `tests_snapshot` se calculan sobre el disco y los diffs de cada review mezclan
   avisos de CRLF, sin que el contenido cambie. El backlog lo anota en las specs 018, 019, 020, 022, 023 y 025.
2. **Aceptar una ADR.** El role-guard del plugin solo deja al `planner` escribir ADR y solo en la etapa `plan`; el
   `doc-keeper` no puede tocar `docs/sdd/decisions/`. Cada vez la ADR queda en «Propuesta» y se acepta a mano en una
   rama `chore/…` posterior (ADR-0025, 0027, 0028, 0029 y 0032) o, en la 025, la edita el orquestador en la etapa `docs`.
3. **Archivos de datos.** `backend/scripts/data/food_catalog.csv` no es producción ni test para el guard, así que
   ningún rol puede escribirlo. En la 023 lo editó el orquestador con autorización explícita del usuario.

Los puntos que dependen del propio plugin `sdd-beto` (que el guard reconozca una categoría de datos, que el
`test-author` pueda borrar o renombrar sus tests, que una etapa del flujo acepte ADR) no se pueden resolver en este
repositorio: el guard vive en el plugin y se sobrescribe al actualizarlo.

## Decisión
- **`.gitattributes` con `* text=auto eol=lf`** (y `*.sh text eol=lf`, y los binarios sin conversión). Los archivos de
  texto quedan en LF en el repositorio y en la copia de trabajo, con independencia de `core.autocrlf`.
- **Quién acepta una ADR.** La sesión principal (el orquestador) cambia `Estado` a «Aceptada» en la ADR y en el índice
  de `docs/sdd/decisions/README.md`, en la rama de la feature, cuando el usuario escribe su aprobación explícita en el
  gate de `review`, y antes del commit de la etapa `docs`. El `doc-keeper` lo pide en su informe y no lo hace. Las ADR de
  una rama `chore/…` las acepta el usuario en el gate de esa rama.
- **Archivos de datos.** Los archivos de datos que no son código (hoy `backend/scripts/data/**`) solo los edita la
  sesión principal, con autorización explícita del usuario en el chat, y la review lo anota.
- Estas reglas se añaden a la constitución del proyecto como Art. P5.

## Consecuencias
- Los diffs y los hashes de tests dejan de depender de la configuración local de Git. Hay que renovar una vez la copia
  de trabajo (`git checkout-index --force --all` con el árbol limpio) para que los archivos existentes pasen a LF.
- Un clon nuevo en Linux o en CI no cambia: ya usaba LF.
- Quien edite en Windows con un editor que fuerce CRLF verá que Git lo normaliza al hacer `git add`.
- Las ADR siguen sin poder aceptarse sin una persona: cambia solo quién edita el archivo, no quién decide.
- Peticiones al plugin `sdd-beto`, fuera de este repositorio: una categoría de ruta «datos» editable por el
  `implementer` y excluida del ratchet, permitir al `test-author` borrar y renombrar sus propios tests, y una forma de
  aceptar ADR desde el flujo.
