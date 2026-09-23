# ADR-0002 — Formato de requisitos: híbrido (historia de usuario, EARS y Given/When/Then)

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario

## Contexto
El `verifier` y el `reviewer` necesitan requisitos precisos y comprobables. Al mismo tiempo, el usuario tiene que poder leer la spec de un vistazo en el gate. EARS por sí solo es preciso pero árido, y las historias de usuario por sí solas son ambiguas.

## Decisión
`spec.md` combina tres elementos:
1. **Historia de usuario** como contexto: "Como … quiero … para …".
2. **Requisitos con ID** (`REQ-001`, `REQ-002`, …) redactados en EARS:
   - `THE SYSTEM SHALL …`
   - `WHEN <evento> THE SYSTEM SHALL …`
   - `IF <condición> THEN THE SYSTEM SHALL …`
   - `WHILE <estado> …`
   - `WHERE <feature> …`
3. **Criterios de aceptación** Given/When/Then por cada REQ, con ID propio (`AC-001.1`, `AC-001.2`, …).

Los requisitos no funcionales usan el prefijo `NFR-001`.

## Consecuencias
- (+) Cada REQ y cada AC tienen un ID que se puede rastrear hasta sus tareas y tests.
- (+) Los AC en Given/When/Then se traducen casi directamente a tests.
- (−) Escribir la spec lleva algo más de trabajo, que recae en el `spec-writer`, no en el usuario.
