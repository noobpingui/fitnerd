# ADR-0020: Una medición por usuario y día, peso del perfil derivado de la última medición y consolidación de duplicados en la migración

- **Estado:** Aceptada · 2026-10-12 (aprobada por el usuario con el plan de la feature `008-metrics-from-profile`)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate de plan.

## Contexto
La spec 008 pide que haya como mucho una medición (`body_metrics`) por usuario y fecha, que registrar en una fecha ocupada combine los valores con la medición existente (`200`) en lugar de crear otra (`201`), que se puedan corregir y borrar mediciones, y que el peso del perfil (`user_profiles.weight`, en la unidad del usuario, ADR-0019) siga a la última medición de peso cada vez que cambian las mediciones. Además, hay que consolidar los duplicados que ya existen en producción al desplegar.

Opciones consideradas:
1. Solo lógica en el servicio (buscar la medición del día antes de insertar), sin restricción en la base. Dos peticiones simultáneas pueden crear duplicados.
2. Restricción única `(user_id, recorded_at)` en la base más búsqueda en el servicio, serializando las escrituras de cada usuario con el bloqueo de su fila de `users`.
3. `INSERT … ON CONFLICT DO UPDATE` en el repositorio. Mete la regla de combinación ("los valores ausentes se conservan") en SQL y la saca del servicio, donde no se puede probar con fakes.

Para la sincronización del peso: hacerla en el frontend (dos llamadas, no atómica) o en el servidor dentro de la misma transacción que la medición.

## Decisión
1. **Restricción única `uq_body_metrics_user_id_recorded_at`** sobre `body_metrics(user_id, recorded_at)` como garantía final, y la regla de "una por día" en `BodyMetricService` (busca la medición del día y la actualiza o crea una). Toda escritura de mediciones bloquea antes la fila del usuario (`UserRepository.get_by_id_for_update`, el mismo bloqueo que usa `ProfileService`), así que dos registros simultáneos del mismo día no llegan a chocar con la restricción.
2. **El peso del perfil se sincroniza en el servidor**, en `BodyMetricService`, dentro de la misma transacción que el registro, la corrección o el borrado: si la última medición con peso difiere en más de 0,05 kg del peso del perfil, el perfil toma ese peso convertido a su unidad, redondeado a un decimal y ajustado a su rango. `BodyMetricService` recibe por constructor `UserProfileRepository` y `UserRepository`; no llama a `ProfileService`.
3. **Consolidación de duplicados en la propia migración** que crea la restricción: SQL estático (sin concatenación) en `backend/utils/body_metric_consolidation.py`, que la migración importa y que un test de integración ejecuta contra Postgres. El módulo queda congelado: si en el futuro cambia la regla, se escribe una función nueva, no se edita esta.

## Consecuencias
- (+) La invariante "una medición por día" la garantiza la base aunque falle la lógica de la aplicación.
- (+) El peso del perfil y la última medición no divergen por un fallo de red entre dos llamadas del cliente; home, Macros y Métricas leen datos coherentes.
- (+) La regla de combinación y la de sincronización se prueban con fakes, sin Postgres.
- (−) `BodyMetricService` escribe en dos agregados (mediciones y perfil); el acoplamiento queda explícito en su constructor.
- (−) La consolidación no se puede deshacer: el `downgrade` solo quita la restricción. La migración se aplica a mano en producción (ADR-0016), y hasta entonces la restricción no existe en Supabase.
- (−) Una migración importa código de la aplicación; por eso el módulo de consolidación se trata como congelado.
