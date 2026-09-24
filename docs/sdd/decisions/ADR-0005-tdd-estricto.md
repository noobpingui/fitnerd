# ADR-0005 — TDD estricto para el código nuevo o modificado

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario

## Contexto
La cobertura actual es baja: en el backend hay 28 tests que cubren 4 de 11 servicios, y en el frontend 9 tests (ver `00-discovery.md`). Si los tests se escriben después, tienden a reflejar la implementación en lugar de la spec.

## Decisión
- **Quién escribe los tests:** el `test-author`, a partir de `spec.md` y `tasks.md`, **antes** de que exista la implementación. Cada test cita su REQ/AC en el nombre o en un comentario, por ejemplo `# REQ-001 / AC-001.2`.
- **Comprobación del rojo:** el `verifier`, en modo `red`, confirma que los tests nuevos **fallan por la razón esperada** (comportamiento ausente, no errores de sintaxis o de import) antes de pasar a `implement`.
- **Esqueletos:** los símbolos nuevos que importan los tests se crean antes como esqueletos que lanzan "not implemented" (ADR-0012), para que el rojo sea test a test.
- **Qué no puede hacer el `implementer`:** modificar los tests. Si un test le parece incorrecto, lo reporta y el orquestador devuelve el caso al `test-author` o escala al usuario.
- **Alcance:** solo el código nuevo o modificado por la feature. No se exige cubrir de forma retroactiva el código existente.

## Consecuencias
- (+) Los tests validan la spec, no la implementación, y la trazabilidad REQ → test queda garantizada.
- (−) Los tests de backend requieren Postgres levantado (`docker compose up -d postgres`). El `verifier` lo comprueba y, si falta, lo reporta como bloqueo de entorno.
- (−) El código muy acoplado (rutas con `LLMClient` instanciado dentro) es difícil de probar con TDD. La constitución fijará el patrón de inyectar fakes en los servicios.
