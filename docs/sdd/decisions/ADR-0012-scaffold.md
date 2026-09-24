# ADR-0012 — Paso de andamiaje (scaffold) antes del red check

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario (opción b), a partir del problema F5 detectado en la prueba en seco `000-example`

## Contexto
En TDD estricto, los tests se escriben antes de que exista el código. En TypeScript/Vitest los imports son estáticos: si el módulo no existe, **todo el archivo de test** falla con un único error de import. El `verifier` no puede comprobar entonces que **cada** criterio de aceptación falla por comportamiento ausente, que es lo que exige el Art. 5.2 de la constitución.

El `planner` de `000-example` propuso un esqueleto que lance un error, pero ningún rol podía crearlo: el `test-author` no toca producción y el `implementer` solo actuaba después del red check.

## Decisión
- **Tipo de tarea nuevo, `(scaffold)`:** el `task-breaker` crea una por cada módulo, función o clase **nuevos** que los tests vayan a importar. No hacen falta para rutas HTTP nuevas, porque un 404 ya es rojo legítimo.
- **Secuencia de la etapa `tests`:**
  1. `implementer` en **modo `scaffold`**: solo firmas exportadas, con un cuerpo que únicamente lanza `Error("not implemented")` o `NotImplementedError`.
  2. `test-author` escribe los tests contra esas firmas.
  3. `verifier` hace el red check.
- **Qué comprueba el `verifier`:**
  - que los esqueletos no contienen lógica;
  - que **cada** test falla de forma individual;
  - si un test pasa con el esqueleto (por ejemplo un `toThrow()` genérico), lo marca como FAIL porque no prueba nada.
- **Cambio en el hook:** `role-guard` permite al `implementer` escribir en la etapa `tests`. Sigue sin poder tocar tests.

## Consecuencias
- (+) El rojo es test a test y el typecheck del test-author funciona desde el principio, con lo que se detectan antes los tests débiles.
- (+) Los roles se mantienen: el código de producción, aunque sea un esqueleto, lo escribe el `implementer`.
- (−) Una delegación más en la etapa `tests`.
- (−) El `implementer` puede escribir producción antes del red check. Si se excediera e implementara lógica real, los tests pasarían y el red check lo marcaría como FAIL; además, el verifier revisa los esqueletos.
