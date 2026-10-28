# Verify report 028 — Biblioteca de alimentos del diario: personalizados reutilizables, recientes y favoritos, con búsqueda compartida

- **Modo:** red (tras la etapa tests, iteración 3)
- **Fecha:** 2026-10-28T00:37:05.411Z · **Rama:** `feat/028-diary-food-library` @ `7b952b1` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run src/features/diary/components/FoodSearchPanel.test.tsx src/features/diary/schemas.test.ts` (`frontend`) | ✅ | 156 tests: 150 pasan y 6 fallan. Los 6 fallos son los tests nuevos de la iteración 3 (5 de F9 y 1 de F11), todos por comportamiento ausente (rojo legítimo esperado). |

- Backend: en la iteración 3 no hay tests nuevos ni cambios de backend (T-176 es una tarea de implementación, F10), así que no se ejecuta en este modo.
- Lint, tipos y build no se ejecutan en modo red.
- Los avisos «not wrapped in act(...)» que salen en la salida del test de escritura durante el borrado en curso son avisos de consola de react-hook-form y no causan el fallo. El fallo de ese test es la aserción de foco.

## 2. Trazabilidad
Solo se revisan los tests nuevos de la iteración 3 (T-169 a T-175).

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-017 | AC-017.7 | T-169, T-170, T-172 | `FoodSearchPanel.test.tsx` (F9 tests 1, 2 y 4) | ✅ rojo legítimo (la confirmación sigue abierta o reaparece) |
| NFR-002 | AC-N002.3 | T-169, T-170, T-172 | `FoodSearchPanel.test.tsx` (F9 tests 1, 2 y 4) | ✅ rojo legítimo |
| REQ-017 | AC-017.3 | T-171, T-173 | `FoodSearchPanel.test.tsx` (F9 tests 3 y 5) | ✅ rojo legítimo (el aviso reaparece tras volver a «Favoritos»; el foco va a «Borrar» y no a la caja) |
| NFR-002 | AC-N002.4 | T-173 | `FoodSearchPanel.test.tsx` (F9 test 5) | ✅ rojo legítimo |
| REQ-018 | AC-018.7 | T-175 | `schemas.test.ts` («`schemas.ts` ya no exporta `proposalFormSchema`») | ✅ rojo legítimo (el símbolo sigue exportado) |
| REQ-018, REQ-019 | AC-018.2, AC-018.4, AC-018.7, AC-019.1, AC-019.3 | T-174 (adaptados) | `schemas.test.ts` (`proposalIssues`, `describe` de `proposalReviewSchema`) | ✅ pasan: solo cambia el esquema usado; las aserciones y los mensajes se mantienen |

- Guardas de regresión de `proposalReviewSchema`: 4 bloques y 9 casos, igual que ratificó el usuario; no se han ampliado. Pasan.
- AC sin test: no se evalúa en este modo (lo hace `verify` en modo full).
- REQ sin tarea: no se evalúa en este modo.
- Tareas sin marcar `[x]`: T-169 a T-175 están marcadas por la sesión principal, como se indicó. T-176 a T-178 siguen pendientes (etapa implement).
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff del frontend: ninguno.
- Esqueletos `(scaffold)`: la iteración 3 no añade ninguno («Fase A0 (iteración 3)» de `tasks.md`: no aplica).

Observaciones (no bloquean el PASS):
- Los cinco tests de F9 tienen el marcador `// SDD:` en la línea que está dos líneas por encima de `it(`, porque entre medias hay un comentario «// Rojo hoy: …». El Art. B4.3 pide el marcador en la línea inmediatamente anterior a la definición del test. Los IDs están presentes y la trazabilidad se cumple; conviene moverlo en la siguiente pasada del test-author.

## 3. Criterios de aceptación manuales
- Ninguno en este modo. Los AC manuales de la feature (AC-N002.2, lector de pantalla) se listan en la etapa verify.

## 4. Fallos (si los hay)
| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno. Los 6 fallos son rojos legítimos esperados antes de implementar T-177 y T-178. | — | — |

Detalle de los rojos legítimos (todos por aserción de comportamiento, sin errores de import, fixture, timeout ni sintaxis):
- F9 test 1 (`FoodSearchPanel.test.tsx`, línea 1168): tras vaciar la caja, la confirmación sigue en el DOM.
- F9 test 2 (línea 1189): tras volver a «gallo», la confirmación sigue en el DOM.
- F9 test 3 (línea 1211): el aviso «No se pudo borrar el alimento.» reaparece al volver a mostrar «Favoritos».
- F9 test 4 (línea 1244): al volver el alimento a «Favoritos», reaparece la confirmación.
- F9 test 5 (línea 1270): tras el fallo con texto escrito, el foco está en «Borrar» y debería estar en la caja.
- F11 (`schemas.test.ts`, línea 618): `proposalFormSchema` sigue exportado (`expected [...] to not include 'proposalFormSchema'`).
