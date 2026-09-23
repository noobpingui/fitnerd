# ADR-0004 — Gate humano al cerrar cada etapa

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario. Se recomendaron 3 gates (spec, plan+tareas, merge) y el usuario eligió gates en **cada etapa**.

## Contexto
El usuario quiere controlar el flujo de cerca, sobre todo mientras aprende a usar el harness.

## Decisión
- **Cuándo se detiene el orquestador:** tras cada una de estas etapas, espera la aprobación explícita del usuario:
  `spec → plan → tasks → tests (rojo) → implement → verify → review → close (merge)`.
- **Contenido de cada gate:**
  - Qué se produjo, con las rutas de los archivos.
  - Decisiones que tomó el agente.
  - Qué viene en la siguiente etapa.
  - Preguntas abiertas.
  - La propuesta de commit de esa etapa, si la hay (ADR-0007).
- **Qué cuenta como aprobación:**
  - Solo una respuesta explícita ("aprobado", "sí" o equivalente).
  - El silencio o una respuesta ambigua no aprueban.
  - Si el usuario pide cambios, se aplican y se vuelve a presentar el gate.
- **Cómo se aprueban commit y push:**
  - El gate de etapa y la aprobación del commit se presentan en el mismo mensaje, en dos secciones separadas y claramente rotuladas.
  - Si el usuario solo aprueba la etapa, no se hace commit.
  - Los pushes se aprueban siempre por separado.
- **Ciclos de corrección:** si el `verifier` o el `reviewer` fallan, el trabajo vuelve al agente responsable junto con sus hallazgos. Tras **3 iteraciones** sin éxito se escala al usuario.

## Consecuencias
- (+) El usuario tiene control total y detecta pronto cualquier desviación.
- (−) Más fricción: unas 8 pausas por feature. Se mitiga con la vía rápida para cambios triviales que definirá la guía de uso.
- Revisable: cuando el usuario se sienta cómodo, se puede reducir a 3 gates cambiando solo la skill del orquestador.
