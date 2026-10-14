# ADR-0022: Marcador de trazabilidad `SDD:` con el número de spec

- **Estado:** Aceptada · 2026-10-14 (decidida por el usuario tras el hallazgo F4 de la review de `011-analysis-extreme-pace`)
- **Decidido por:** el usuario; cambio del harness en una rama `chore/…` (CLAUDE.md, Convenciones).

## Contexto
Cada spec numera sus requisitos desde `REQ-001`, así que los IDs se repiten entre specs. El marcador de la constitución (Art. 4.3) solo lleva los IDs (`# SDD: REQ-006 AC-006.1`), sin decir de qué spec son. Cuando dos specs comparten archivo de test, buscar un ID mezcla los tests de las dos:

- La 011 añadió tests a `test_progress_analysis_service.py` y `test_progress_analysis_routes.py` con marcadores `REQ-005`, `REQ-006` y `REQ-008` que también existen en la 010 (review F4 de la 011; el verifier lo anotó dos veces).
- `ProfilePage.test.tsx` lleva `AC-011.5`–`AC-011.7` de la 006, y `BodyMetricsPage.test.tsx` y `PrivacyPolicyPage.test.tsx` llevan `AC-012.3` de la 006 y de la 005; la 008 tuvo que aclararlo a mano.

El verifier (modo `red` y trazabilidad de `verify`) y el reviewer identifican los tests de la feature por estos marcadores, así que la ambigüedad afecta al propio flujo, no solo a las búsquedas.

Opciones consideradas:
1. **Número de spec como primer token:** `SDD: 011 REQ-006 AC-006.1`.
2. **Número pegado a cada ID:** `SDD: 011/REQ-006 011/AC-006.1`. Más explícito con varios IDs, pero más largo y repetitivo.
3. **Reetiquetar los ~915 marcadores existentes** (56 archivos, specs 001–011). Habría que deducir la spec de cada test, justo donde hay colisiones, con `git blame`; mucho coste y riesgo de error.

## Decisión
Opción 1, obligatoria desde la spec 011.
- Formato: `SDD: NNN <IDs>`, donde `NNN` es el número de tres dígitos de la carpeta `specs/NNN-slug/`. Ejemplos: `# SDD: 011 REQ-006 AC-006.1` y `// SDD: 011 REQ-009 AC-009.3`.
- Los marcadores sin número (`SDD: REQ-… AC-…`) quedan como **formato antiguo válido** para los tests de las specs 001–010; no se reetiquetan en bloque.
- En este cambio se reetiquetan solo los marcadores de la 011 y los casos ambiguos ya conocidos (`ProfilePage.test.tsx` y `BodyMetricsPage.test.tsx` → 006; `PrivacyPolicyPage.test.tsx` → 005).
- El `test-author` escribe el prefijo de la feature en curso; el `verifier` identifica los tests de la feature por `SDD: NNN` y comprueba la trazabilidad de cada AC contra marcadores con ese prefijo.

## Consecuencias
- (+) Buscar `SDD: 011` devuelve todos los tests de una spec, y `SDD: 011 .*AC-006.1` uno concreto, sin mezclar specs que comparten archivo.
- (+) El modo `red` del verifier ya no confunde los tests existentes de otra spec con los nuevos.
- (+) Cambio mínimo: los marcadores antiguos siguen siendo válidos y no hay que tocar 900 líneas.
- (−) Convivirán dos formatos. Un test antiguo que una feature nueva modifique para cubrir un AC suyo debe llevar su propio marcador con prefijo (puede tener varios marcadores).
- (−) Cambian la constitución (Art. 4.3), el CLAUDE.md (Convenciones), las fichas del `test-author` y del `verifier` y la documentación del harness.
