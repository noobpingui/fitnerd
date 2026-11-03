# Review 033 — Nombre editable en el perfil, saludo en Home y registro sin fecha de nacimiento

- **Iteración:** 1 de 5 (segunda vuelta, tras corregir F1 a F5 de la primera)
- **Diff revisado:** `git diff main...feat/033-profile-first-name` @ `1324074`, con foco en `git diff 17d3227 1324074`, que contiene las correcciones. También se revisan los cambios sin commitear: `backlog.md`, `state.json` y `verify-report.md`, del orquestador y el verifier.
- **Veredicto:** APPROVED

## 1. Resumen
Desde la primera revisión hay cuatro commits:
- `2f1242d`: formato de `spec.md`.
- `7ecf0fe`: tests. Se quitan los `date_of_birth` ignorados de los helpers de registro, se elimina `clock` de `make_service` y se añade una referencia a AC-009.4 en `HomePage.test.tsx`.
- `1324074`: se retira `clock` de `AuthService` y de `_build_auth_service`.
- `tasks.md`: T-028 se desmarca, con los comentarios del usuario.

El código de producción solo pierde una dependencia muerta y no cambia de comportamiento. Las correcciones de F2 a F5 están bien hechas. La de F1 se queda a medias: T-028 se desmarcó, pero no se retiró ni se anotó como «sin cambios necesarios».

## 2. Cumplimiento de la spec
La implementación de los 36 AC no cambia desde la primera vuelta. La evidencia de la tabla anterior sigue valiendo, con las mismas líneas de producción: el único cambio, en `auth_service.py`, desplaza el código una o dos líneas.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.4 | Sí | `backend/services/auth_service.py` no lee `date_of_birth`. Los tests de `test_auth_routes.py:677-803` y `test_fixed_clock_routes.py:185-202` siguen enviando la fecha a propósito, con el parámetro opcional `register_payload(date_of_birth=…)` en `:25-34`, y comprueban que se ignora. Reejecutados: 193 passed. |
| AC-002.1, AC-002.2 | Sí | sin cambios desde la primera vuelta |
| AC-003.1 | Sí (guarda de regresión) | excepción al Art. B5.2 aprobada por el usuario (`tasks.md`, «Comentarios del usuario») |
| AC-004.1 a AC-004.3 | Sí | sin cambios |
| AC-005.1 a AC-005.4 | Sí | sin cambios |
| AC-006.1 a AC-006.4 | Sí | sin cambios |
| AC-007.1 a AC-007.8 | Sí | sin cambios. `spec.md:81-82`: AC-007.1 y AC-007.2 ya van en líneas separadas. |
| AC-008.1 a AC-008.6 | Sí | sin cambios |
| AC-009.1 a AC-009.4 | Sí | sin cambios. Referencia a AC-009.4 en `HomePage.test.tsx:102-104`. |

### Estado de los hallazgos de la primera vuelta
| # | Estado | Evidencia |
|---|---|---|
| F1 (T-028) | Parcial | `tasks.md:43`: la casilla pasa de `[x]` a `[ ]`, pero la tarea ni se retira ni se anota como «sin cambios necesarios». Ver F6. |
| F2 (formato de la spec) | Resuelto | `spec.md:81-82` en dos líneas y línea en blanco antes de `### REQ-008` (`:89`). El evento de `history` registra 36 AC. |
| F3 (marcador de AC-009.4) | Resuelto | Comentario en `HomePage.test.tsx:102-104` que remite al test con marcador de `ProfilePage.test.tsx`. No duplica el marcador `SDD:`, así que no falsea la trazabilidad. |
| F4 (`clock` muerto) | Resuelto | `auth_service.py:33-35` sin `clock` y sin importar `utc_now`. `auth_routes.py:22-27` sin `clock=`. El `current_clock` de `auth_routes.py:14` sigue en uso para `PasswordResetService` (`:37`), así que no es una importación muerta. Ninguna otra construcción de `AuthService` pasa `clock`: `test_auth_service.py:104` y `test_canonical_email_google.py:42` no lo hacen. |
| F5 (`date_of_birth` en los helpers de registro) | Resuelto | Quitado en `conftest.py`, `test_auth_routes.py`, `test_canonical_email_routes.py`, `test_food_library_routes.py`, `test_meal_library_routes.py`, `test_meal_routes.py`, `test_password_reset_routes.py` y `test_resend_email_routes.py`. Los `date_of_birth` que quedan en `test_body_metric_routes.py`, `test_retired_catalog_routes.py` y `test_progress_analysis_routes.py` son del cuerpo de `PUT /api/profile`, donde sí se usa, o de los tests de AC-001.x que prueban que se ignora. Es correcto. |

## 3. Cumplimiento del plan
- Retirar `clock` de `AuthService` contradice lo que el plan justificaba al principio (conservarlo porque la ruta y los tests lo inyectaban), pero lo autorizó el usuario («sí a F4», en `tasks.md`, «Comentarios del usuario») y simplifica el código sin cambiar el comportamiento. Se acepta.
- T-028 no produjo cambios (ver F6). El resto sigue el plan, como en la primera vuelta.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` idéntico (25 archivos, snapshot del 2026-11-03T02:25:13Z), y `git diff 7ecf0fe 1324074` no toca ningún test, solo `auth_routes.py`, `auth_service.py` y `state.json`. Los tests cambiaron después de `e9db40a` en `b1e03ac` (E501) y en `7ecf0fe` (F1, F3, F4 y F5). Los dos cambios están registrados en `history` con `rework tests` y un `snapshot` posterior, y el usuario los autorizó. Ninguno modifica aserciones: solo quita una clave ignorada de los payloads, el `clock` del fake y añade un comentario. El implementer no tocó tests.
- [x] B4: marcadores coherentes, 36/36 AC con test (verify-report). La nota de F3 no añade un marcador duplicado.
- [x] B5: sin tests borrados, saltados ni debilitados. Los tests de AC-001.x siguen enviando `date_of_birth` donde hace falta para probar que se ignora. Red check reaprobado por decisión explícita del usuario, citando `e9db40a`.
- [x] B5.7: ruff de `services/auth_service.py` antes y después: las mismas tres violaciones previas (E501, I001 y F401 de `UnitOfWork`), ninguna nueva. Verify: ratchet, lint, `tsc` y `build` en verde.
- [x] B6.5: sin secretos ni variables nuevas.
- [ ] B7: T-028 sigue sin marcar (F6). Hay que resolverlo antes de `close`.

### Parte II (proyecto)
- [x] P1: marcadores con número de spec y comentarios en español. Fakes a mano, sin `FakeClock` sobrante en `test_auth_service.py`.
- [x] P2 backend: `AuthService` sigue recibiendo sus dependencias por constructor. Se quita una que no se usaba.
- [x] P2.4: no hay cambio de modelo ni hace falta migración. Comprobado a mano.
- [x] P2 frontend y P2 general: sin cambios desde la primera vuelta.
- [x] P3: sin endpoints nuevos ni cambios de autorización.
- [x] P4: sin pasos manuales en producción. El `doc-keeper` sigue teniendo pendiente actualizar `CLAUDE.md`, que aún describe la validación de la fecha de nacimiento en el registro de la 018.
- [x] P5: no se tocan archivos de datos ni ADRs.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F6 | MENOR | `specs/033-profile-first-name/tasks.md:43` (T-028) | F1 está a medias. T-028 pasó de `[x]` a `[ ]`, pero sigue en la lista como trabajo pendiente («Adapta los tests de refresco…»), cuando no hay nada que hacer: `PhysicalDataForm.refresh.test.tsx` no compara el payload del `PUT` de forma exacta y pasa sin cambios. Mientras siga sin marcar, no se cumple la definición de «hecho» del Art. B7 («todas las tareas marcadas `[x]`»). Hay que retirarla o marcarla `[x]` con la nota «sin cambios necesarios: el archivo no compara el payload de forma exacta; AC-007.3 lo cubren T-024, T-026 y T-027» antes de `close`. | planner |
| F7 | NIT | `specs/033-profile-first-name/backlog.md:41-43` | F3, F4 y F5 siguen como `[ ]` abiertos en el backlog de la feature, aunque ya están resueltos (`7ecf0fe` y `1324074`). Hay que cerrarlos o quitarlos para que no pasen al backlog del proyecto en `close`. | planner |

## 6. Decisión
APPROVED. No hay hallazgos BLOQUEANTES ni MAYORES:
- F2, F3, F4 y F5 están resueltos.
- La integridad de los tests se mantiene: el snapshot es idéntico, los cambios posteriores a la etapa `tests` están autorizados en `history` y en los comentarios del usuario, y el commit de implement no toca tests.
- Los tests afectados pasan: 193 passed en `test_auth_service.py`, `test_canonical_email_google.py`, `test_auth_routes.py` y `test_fixed_clock_routes.py`.

Quedan F6 (MENOR), que hay que cerrar antes de `close` para cumplir el Art. B7, y F7 (NIT), sobre el mantenimiento del backlog.
