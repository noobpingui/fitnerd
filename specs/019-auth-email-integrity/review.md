# Review 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Iteración:** 1 de 3
- **Diff revisado:** `git diff main...fix/019-auth-email-integrity` @ `ec0f765` (+ cambios sin commitear en `specs/019-auth-email-integrity/{backlog.md,state.json,verify-report.md}`, solo artefactos de la etapa verify)
- **Veredicto:** APPROVED

## 1. Resumen
La migración `e5b7d9f1a3c6` convierte a la forma canónica los correos de `users` y `password_reset_requests`, falla sin escribir nada si hay conflictos y crea dos restricciones `CHECK` que también se declaran en los modelos. No cambian servicios, rutas ni repositorios. La implementación es pequeña, fiel al plan y está bien cubierta: los 21 AC tienen test y los tests prueban de verdad el comportamiento.

He revisado aparte la seguridad de la migración de datos:
- **Atomicidad:** la consulta de conflictos (`e5b7d9f1a3c6_…py:34-45`) se hace antes de cualquier `UPDATE`, y `env.py:106` ejecuta todo en `context.begin_transaction()`. Si una escritura concurrente crea un conflicto entre la consulta y el `UPDATE`, la restricción única de `users.email` lanza `IntegrityError` y la transacción entera se revierte, sin aplicar nada a medias.
- **Sin cambios ante conflictos:** comprobado por AC-002.1, AC-002.2 y AC-002.3.
- **Idempotencia:** los `UPDATE … WHERE email <> <canónica>` no tocan filas ya canónicas (AC-001.3 compara `SELECT *`, `updated_at` incluido), y el ciclo upgrade → downgrade → upgrade funciona (AC-006.2).
- **Downgrade:** solo quita las dos restricciones (`:59-64`).
- **Expresión de la migración frente a la del modelo:** son idénticas, carácter a carácter. Además, compilé el DDL del modelo con el dialecto de Postgres y `[[:space:]]` sale intacto.
- **Caso B' del runbook:** el plan (3.1.4) es coherente con él, salvo un detalle de las consultas de comprobación (F1).

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí | `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py:47-51`; `test_canonical_emails_migration.py:88` |
| AC-001.2 | Sí | migración `:20` (`lower(regexp_replace(...))`), `:47-51`; `test_canonical_emails_migration.py:103` |
| AC-001.3 | Sí | migración `:50` (`WHERE email <> …`; el SQL directo no dispara `onupdate`); `test_canonical_emails_migration.py:118` compara la fila entera |
| AC-001.4 | Sí | `test_canonical_email_routes.py:80` (login 200 y `/me` con el `id` de la cuenta migrada) |
| AC-002.1 | Sí | migración `:34-45`, mensaje con comillas y `COLLATE "C"`; `test_canonical_emails_migration.py:166` (mensaje exacto) |
| AC-002.2 | Sí | migración `:37-39` (`GROUP BY` canónica; grupos separados por `; `); `test_canonical_emails_migration.py:194` |
| AC-002.3 | Sí | el `raise` (`:41-45`) va antes de los `UPDATE` y de `create_check_constraint`; `test_canonical_emails_migration.py:227` |
| AC-003.1 | Sí | migración `:47-51` (tabla `password_reset_requests`); `test_canonical_emails_migration.py:251` |
| AC-003.2 | Sí | sin comprobación de conflictos en solicitudes; `test_canonical_emails_migration.py:278` |
| AC-004.1 | Sí | migración `:53`; `backend/models/user.py:59-62`; `test_canonical_emails_migration.py:295` |
| AC-004.2 | Sí | ídem; `test_canonical_emails_migration.py:313` |
| AC-004.3 | Sí | ídem; `test_canonical_emails_migration.py:330` (`UPDATE` en un savepoint; el correo sigue igual) |
| AC-004.4 | Sí | migración `:54-56`; `backend/models/password_reset_request.py:35-37`; `test_canonical_emails_migration.py:352` |
| AC-004.5 | Sí | `test_canonical_emails_migration.py:369` |
| AC-005.1 | Sí | sin cambios de producción: `services/credential_rules.py` (`validate_email` → `strip().lower()`); `test_canonical_email_routes.py:104` |
| AC-005.2 | Sí | `test_canonical_email_routes.py:115` |
| AC-005.3 | Sí | `test_canonical_email_routes.py:130` |
| AC-005.4 | Sí | `services/auth_service.py:162` (`normalize_email`); `test_canonical_email_google.py:37` |
| AC-005.5 | Sí | `services/password_reset_service.py:60`; `test_canonical_email_routes.py:143` |
| AC-006.1 | Sí | migración `:59-64`; `test_canonical_emails_migration.py:390` |
| AC-006.2 | Sí | `test_canonical_emails_migration.py:410` |

También comprobé que todos los caminos de escritura de `users.email` y `password_reset_requests.email` (`auth_service.py:84` y `:170`, `password_reset_service.py:76` y `:110`) pasan por `validate_email` o `normalize_email`. Fuera de los tests, no hay otros constructores de `User(` ni de `PasswordResetRequest(` en el código, así que la restricción no rechaza nada de lo que hoy escribe `main`. Por eso es seguro aplicar la migración antes del merge.

## 3. Cumplimiento del plan
- **Desviación menor:** la migración añade una constante `CANONICAL_EMAIL_EXPR` (`:20`), que el plan no preveía, y usa `bind.exec_driver_sql` en lugar de `text()`. Está justificada en el comentario de `:30`: `text()` interpreta `:spac` de `[[:space:]]` como parámetro enlazado. Lo comprobé: `text("…'[[:space:]]'…")._bindparams` devuelve `['spac']`. La duplicación de la constante queda como NIT (F4).
- **Plan 3.1.2, modelos:** coinciden con el plan, con el esquema `public` conservado (`user.py:59-62`; `password_reset_request.py:35-37`, al principio de la tupla).
- **Plan 5.3, adaptación de los tests de la 014:** solo cambian la preparación (`drop_canonical_email_checks` o el fixture `legacy_email_schema`). Sus aserciones y marcadores siguen iguales.
- **Plan 3.1.4, paso manual:** sigue la estructura del caso B' del runbook (backup verificado, comprobación de solo lectura, migración antes del merge, comprobación posterior y marcha atrás). Ver F1 sobre cómo se ejecutarán sus consultas.

## 4. Checklist de la constitución
### Parte I (base)
- [x] **B2:** los tests no cambiaron durante implement. `snapshot --check` da `identical: true`, sin archivos cambiados, borrados ni añadidos, y `git diff a7f7801 HEAD -- backend/tests` sale vacío. Hay una incidencia de proceso de B2.4 registrada por el propio implementer (F3).
- [x] **B4:** los 21 marcadores `SDD: 019 REQ-… AC-…` corresponden a los AC que prueban.
- [x] **B5:**
  - no hay tests borrados, saltados ni debilitados: los cinco de la 014 conservan sus aserciones;
  - no hay llamadas a servicios externos: Google con un fake por constructor y el correo por el transporte en memoria;
  - los esqueletos están sustituidos. Volví a ejecutar los 143 tests de los archivos afectados y pasan todos.
- [x] **B5.7:** el ratchet no encuentra violaciones nuevas (verify-report).
- [x] **B6.5:** no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] **P1 general 1:** marcadores con el número de spec (`SDD: 019 …`).
- [ ] **P1 general 2 y P2 general 1:** los docstrings están en español, pero `INTEGRACION` va sin tilde (F6, NIT).
- [x] **P1 backend 1-5:**
  - tests en `test_services/` y `test_routes/`;
  - nombres en inglés;
  - fakes a mano (`FakeJWTManager` y `FakeGoogleVerifier`), sin `unittest.mock` ni `monkeypatch`;
  - Postgres de prueba;
  - esqueleto con `NotImplementedError("not implemented")`, según el historial.
- [x] **P2 backend 1-3, 5:** sin cambios en capas, servicios ni rutas; se reutiliza `credential_rules.py`.
- [x] **P2 backend 4:** el cambio de modelo (dos `CheckConstraint`) incluye su migración, escrita a mano y justificada en el plan (el autogenerado no detecta `CHECK`). La revisé contra el modelo: los nombres y la condición coinciden, `down_revision = 'a7d3f9c1e5b2'` y es la única cabeza (verify-report).
- [x] **P3.4:** el SQL de la migración solo interpola constantes del propio archivo (`:35-39`, `:49-50`).
- [x] **P3.5:** no hay `.env` ni claves en el diff.
- [ ] **P4:** el paso manual de producción está descrito en `plan.md` (3.1.4), pero `docs/deploy-runbook.md` y `CLAUDE.md` aún no lo recogen. Le toca a la etapa docs, así que no es un hallazgo de esta revisión; ver F1 para que se haga bien.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MENOR | `specs/019-auth-email-integrity/plan.md:69-70` | Las consultas de comprobación de solo lectura del paso manual llevan `[[:space:]]`, y la plantilla del paso 4 del runbook (`docs/deploy-runbook.md:101-103`) las ejecuta con `conn.execute(text(sql))`. `text()` toma `:spac` como parámetro enlazado (comprobado: `text("…'[[:space:]]'…")._bindparams == ['spac']`), así que la consulta falla con «A value is required for bind parameter 'spac'». No daña datos, pero rompe la comprobación previa del caso B'. Al llevar el procedimiento al runbook, hay que indicar `conn.exec_driver_sql(...)` o escapar los dos puntos (`\:`), o usar `btrim`/`[ \t\n\r\v\f]` en las consultas de comprobación. | planner |
| F2 | NIT | `docs/sdd/decisions/ADR-0027-garantia-de-correo-canonico-con-check.md:3`, `docs/sdd/decisions/README.md:33` | ADR-0027 sigue en «Propuesta». Su propio texto dice que se acepta en el gate de `review`, así que, si el usuario lo aprueba aquí, hay que pasarla a «Aceptada» en el ADR y en el índice. | planner |
| F3 | MENOR | `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py` | Incidencia de proceso (Art. B2.4), anotada por el propio implementer en `backlog.md`: escribió la migración con un script de Python lanzado desde la shell, en lugar de con Write o Edit. Revisé el contenido y es correcto, así que no hace falta rehacerlo; queda registrado para que no se repita. | implementer |
| F4 | NIT | `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py:16-20` | `CANONICAL_EMAIL_SQL` y `CANONICAL_EMAIL_EXPR` repiten la misma expresión dentro del mismo archivo. Se podría definir `CANONICAL_EMAIL_SQL = f"email = {CANONICAL_EMAIL_EXPR}"` para que no diverjan. | implementer |
| F5 | NIT | `backend/migrations/versions/e5b7d9f1a3c6_canonical_email_check_constraints.py:32` | `op.get_bind()` y `exec_driver_sql` impiden el modo *offline* (`flask db upgrade --sql`). La 014 hace lo mismo (`a7d3f9c1e5b2…py:24`) y el runbook no usa ese modo; solo es informativo. | implementer |
| F6 | NIT | `backend/tests/test_routes/test_canonical_email_routes.py:1` | «Tests de INTEGRACION»: falta la tilde (Art. P2 general 1). | test-author |
| F7 | NIT | `specs/019-auth-email-integrity/plan.md:184`, `:198` | El plan habla de «23 AC», pero la spec define 21 (AC-001.1 a AC-006.2). Ya está en el backlog. | planner |
| F8 | NIT | `backend/tests/test_services/test_canonical_emails_migration.py` | El plan (3.1.1) afirma que `[[:space:]]` también recorta tabuladores y saltos de línea, pero ningún test lo comprueba: todos usan espacios. Ningún AC lo exige; sería un test de refuerzo opcional. | test-author |

No hay hallazgos BLOQUEANTES ni MAYORES.

## 6. Decisión
**APPROVED.** Los 21 AC están implementados tal como los especifica la spec. La migración es atómica, no modifica nada ante conflictos, es idempotente sobre datos canónicos y su `downgrade` solo quita las restricciones. Los tests no cambiaron después del snapshot. Antes del despliegue, la etapa docs debe tener en cuenta F1 al escribir el caso B' en `docs/deploy-runbook.md`; los demás puntos pueden ir al backlog.

## Comentarios del usuario
