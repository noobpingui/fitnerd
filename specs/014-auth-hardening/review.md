# Review 014 — Endurecer la autenticación: token de reset atómico, emails en minúsculas, reglas de contraseña unificadas y logs saneados

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...feat/014-auth-hardening` @ `1ac3b26` (+ cambios sin commitear: solo `backlog.md`, `state.json` y `verify-report.md` de la feature). Foco en el delta `e2a3976..1ac3b26` (corrección de F1–F5).
- **Veredicto:** APPROVED

## 1. Resumen
La iteración 2 corrige los cinco hallazgos de la review anterior. F1: `reset_password` valida el enlace y la contraseña con una lectura sin bloqueo y después relee con `FOR UPDATE` y `populate_existing` y revalida el enlace, así que una contraseña inválida ya no toma el bloqueo ni depende del orden de llegada. F2: tildes corregidas en los textos nuevos de los tests. F3: los escapes de U+2028 y U+2029 se escriben como `" "` y `" "`. F4: `concurrent_resets` comprueba que las peticiones llegaron a esperar el bloqueo. F5: se añadió REQ-013 a la spec, aprobada por el usuario, y un `emailSchema` con `trim` compartido por los tres formularios. El cambio es pequeño y está bien acotado. Las suites afectadas pasan: 106 tests de backend de reset y correo, y 49 tests del frontend de `features/auth`, ejecutados en esta revisión.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 – AC-009.5, AC-011.1 – AC-012.6 | Sí (sin cambios desde la iteración 1, ver su review) | Diff `e2a3976..1ac3b26` no toca esas rutas salvo `email_sender.py:42-43` (solo la forma de escribir las claves, mismo valor) |
| AC-010.1, AC-010.2 | Sí | `backend/services/password_reset_service.py:147-148` (relectura con bloqueo y revalidación); `backend/repositories/password_reset_repository.py:40-49` (`with_for_update` + `populate_existing`); tests `test_two_simultaneous_resets_with_the_same_link_only_one_wins`, `test_reset_password_lost_race_gives_invalid_link_and_rolls_back_without_commit` |
| AC-010.3 | Sí (F1 resuelto) | `password_reset_service.py:139-141`: `validate_new_password` corre antes de cualquier bloqueo; el test de ruta ahora exige `done[0] and waiters >= 1` (`test_password_reset_routes.py:728`), es decir, que la petición "corta" termine mientras la válida espera el bloqueo, lo que la hace determinista; unitario `test_reset_password_with_short_password_does_not_lock_nor_consume_the_link` |
| AC-010.4 | Sí | `password_reset_service.py:119-127` (`_ensure_link_is_usable` con `used_at`); `test_used_link_is_rejected_and_the_password_does_not_change` |
| AC-013.1 – AC-013.3 | Sí | `frontend/src/features/auth/schemas.ts:21` (`z.string().trim().pipe(z.email("Email inválido"))`), usado en `:24`, `:30` y `:39`; tests en `schemas.test.ts`, `RegisterForm.test.tsx`, `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` |
| AC-013.4, AC-013.5 | Sí | `schemas.ts:21` (tras el `trim`, `"   "` y `"no-es-un-correo"` fallan en `z.email`); `RegisterForm.test.tsx` usa `fireEvent.submit` para saltarse la validación nativa de jsdom y llegar a zod (comentado en el helper) |
| AC-N001.1 | Sí | Verify: backend 807 y frontend 504 en verde; snapshot idéntico |

## 3. Cumplimiento del plan
- La implementación sigue el plan de la iteración 2 (§3.3 pasos 1-6, ADR-0025 punto 4 actualizado): nueva `get_by_token_hash_for_update` con `populate_existing`, `get_by_token_hash` vuelve a ser una lectura sin bloqueo y el bcrypt se calcula antes de bloquear.
- Pequeña desviación: el plan (§3.3 paso 6) dice reutilizar el mismo `now` en las dos validaciones, pero `_ensure_link_is_usable` llama a `self.clock()` en cada validación (`password_reset_service.py:125`) y hay una tercera lectura en `:154`. El efecto es más estricto (la caducidad se vuelve a comprobar ya con el bloqueo) y no contradice ningún AC (ver F1, NIT).
- `emailSchema` conserva las mayúsculas en el cliente, como fija la spec en §6.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` idéntico (11 archivos, snapshot del 03:07:35). Los cambios de tests de esta iteración llegan por el `rework` de review → spec → tests, con red check PASS y `snapshot` registrados en `history`. El commit de implementación `1ac3b26` no toca tests.
- [x] B4: marcadores `SDD: 014 REQ-010 …` y `SDD: 014 REQ-013 AC-013.x` coherentes con lo que prueba cada test
- [x] B5: no hay tests borrados, saltados ni debilitados. El único cambio de aserción en un test existente (`ready` de AC-010.3) lo hace más estricto. No hay llamadas externas reales.
- [x] B5.7: ratchet de ruff sin violaciones nuevas; lint, `tsc -b` y build del frontend en verde (verify-report)
- [x] B6.5: sin secretos ni variables nuevas

### Parte II (proyecto)
- [x] P1 general: marcadores con número de spec; docstrings y comentarios de los tests nuevos en español con tildes (F2 resuelto)
- [x] P1 backend: fake `FakePasswordResetRepository` escrito a mano con el gancho `before_lock`, sin `mock` ni `monkeypatch`
- [x] P1 frontend: nombres `it("…")` en español, `vitest` importado explícitamente, red simulada con `vi.mock` de la `api` o `fetch`, como en la iteración 1
- [x] P2.1–P2.3: el bloqueo vive en el repositorio y la lógica en el servicio; solo `UnitOfWork` hace commit o rollback; errores con `ValidationError`
- [x] P2.4: sin cambios de modelo en esta iteración; la migración `a7d3f9c1e5b2` no cambia
- [x] P2.5: no se duplican utilidades
- [x] P2 frontend: `emailSchema` en `schemas.ts` (zod), dentro de `features/auth`
- [x] P2 general: textos visibles sin cambios ("Email inválido" ya existía)
- [x] P3.2: el correo se valida con zod en el cliente y con `validate_email` en el servidor
- [x] P3.4: el ORM con parámetros enlazados
- [ ] P4: el paso manual de producción (volcado y `flask db upgrade` de `a7d3f9c1e5b2`) sigue pendiente para la etapa `docs`, como estaba previsto

## 5. Hallazgos
### Estado de los hallazgos de la iteración 1
| # | Estado | Evidencia |
|---|---|---|
| F1 | Resuelto | `password_reset_service.py:139-148`; ADR-0025 punto 4; unitarios nuevos y test de ruta determinista (`:728`) |
| F2 | Resuelto | Ninguna línea añadida en `main...HEAD` bajo `backend/tests` o `frontend/src` contiene las palabras sin tilde señaladas. Quedan textos anteriores a la 014 (p. ej. el `describe` "LoginForm - recuperacion de contraseña"), anotados en el backlog y fuera de alcance. |
| F3 | Resuelto | `backend/utils/email_sender.py:42-43` |
| F4 | Resuelto | `backend/tests/test_routes/test_password_reset_routes.py:599-607` (`reached = wait_until(...)` + `assert reached`) |
| F5 | Resuelto | REQ-013 en `spec.md` y `frontend/src/features/auth/schemas.ts:21` |

### Hallazgos nuevos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | NIT | `backend/services/password_reset_service.py:125,154` | `_ensure_link_is_usable` lee el reloj en cada llamada, en vez de usar un único `now` como dice el plan §3.3. Si el enlace caduca justo durante el bcrypt (unos 250 ms), la petición recibe "enlace no válido" después de haber calculado el hash. Es correcto (el enlace ya caducó), pero difiere del plan. Pasar `now` como parámetro alinearía código y plan. Opcional. | implementer |
| F2 | NIT | `backend/services/password_reset_service.py:150-152` | La comprobación `user is None` va después del `FOR UPDATE`, así que una fila huérfana toma el bloqueo un instante antes de rechazarse. Es inofensivo (`user_id` es FK, así que no debería pasar). Solo como observación. | implementer |

## 6. Decisión
APPROVED: los cinco hallazgos de la iteración 1 están resueltos y no hay hallazgos BLOQUEANTES ni MAYORES. Los dos NIT nuevos son opcionales. Pendiente para `docs`: documentar el paso manual de la migración `a7d3f9c1e5b2` en `docs/deploy-runbook.md` (Art. P4) y pasar ADR-0025 a "Aceptada" si el usuario la aprueba en este gate. Las tildes de los textos de tests anteriores a la 014 quedan en el backlog.

## Comentarios del usuario

Vamos a corregir todos de una vez, desde f1 a f5
