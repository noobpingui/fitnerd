# ADR-0006 — Modelo asignado a cada agente

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario

## Contexto
Los roles exigen distinto tipo de trabajo. Unos son de razonamiento y juicio (especificar, diseñar, revisar); otros son mecánicos (descomponer, escribir tests, implementar, ejecutar comandos).

## Decisión
| Agente | Modelo | Motivo |
|---|---|---|
| `spec-writer` | `opus` | detecta ambigüedades y define bien los requisitos |
| `planner` | `opus` | decisiones de arquitectura y riesgos |
| `reviewer` | `opus` | juicio crítico frente a spec, plan y constitución |
| `task-breaker` | `sonnet` | descomposición estructurada |
| `test-author` | `sonnet` | escritura de código de test |
| `implementer` | `sonnet` | implementación guiada por los tests |
| `verifier` | `haiku` | ejecuta comandos y compara resultados con criterios explícitos |
| `doc-keeper` | `sonnet` | actualiza documentación a partir del diff (añadido con la ADR-0011) |

Se usan alias (`opus`, `sonnet`, `haiku`) en lugar de IDs fijos para que los agentes tomen automáticamente la versión vigente.

## Consecuencias
- (+) Buen equilibrio entre coste, velocidad y calidad.
- (−) Si `haiku` interpreta mal la salida de algún comando, el `verifier` puede subirse a `sonnet` cambiando una sola línea.
