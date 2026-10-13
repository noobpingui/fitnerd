# Plan 008 — Mediciones de Métricas coherentes con el perfil

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-12)

## 1. Resumen de la solución

En el backend, `BodyMetricService` pasa a ser el único punto de escritura de mediciones. Valida el cuerpo crudo (rangos nuevos, fecha y tipo del cuerpo), combina el registro con la medición del mismo día (`200`) o la crea (`201`), corrige (`PUT` nuevo) y borra. En la misma transacción sincroniza el peso del perfil con la última medición de peso. Todas las escrituras de un usuario se serializan con el bloqueo de su fila de `users`, y una restricción única `(user_id, recorded_at)` garantiza la invariante en la base. Una migración consolida los duplicados existentes y crea la restricción (ADR-0020).

En el frontend, Métricas tiene una sección "Historial" con paginación de 10 en 10, corrección en línea (react-hook-form + zod) y borrado con un diálogo de confirmación. Las mutaciones invalidan las queries de mediciones y de perfil. El formulario del perfil envía `recorded_at` con la fecha del dispositivo.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | `backend/migrations/versions/<rev>_one_body_metric_per_user_and_day.py` (`down_revision = 'c6a1f0d2e9b4'`) | `backend/models/body_metric.py` | Restricción única `uq_body_metrics_user_id_recorded_at` y consolidación de duplicados (REQ-006, AC-001.7) |
| backend · utils | `backend/utils/body_metric_consolidation.py` | — | SQL estático de consolidación, que comparten la migración y su test (REQ-006) |
| backend · repositories | — | `backend/repositories/body_metric_repository.py` | `get_by_user_and_date` y `get_latest_with_weight` |
| backend · services | — | `backend/services/body_metric_service.py` | Validación nueva, combinación por día, corrección, borrado con sincronización del peso del perfil, reloj inyectado |
| backend · routes | — | `backend/routes/body_metric_routes.py` | `POST` con `201`/`200`, `PUT /<uuid>` nuevo, `get_json(silent=True)`, `_build_body_metric_service()` con los repositorios nuevos |
| backend · tests | `backend/tests/test_routes/test_body_metric_routes.py`, `backend/tests/test_services/test_body_metric_consolidation.py` | `backend/tests/fakes.py`, `backend/tests/test_services/test_body_metric_service.py` | Fakes compartidos y adaptación del fixture de los 4 tests existentes (ver §5.4) |
| frontend · features/body-metrics | `components/MetricsHistory.tsx`, `components/MetricEditForm.tsx`, `components/DeleteMetricDialog.tsx`, `schemas.ts`, `components/MetricsHistory.test.tsx`, `schemas.test.ts` | `api.ts`, `hooks.ts`, `types.ts`, `pages/BodyMetricsPage.tsx`, `pages/BodyMetricsPage.test.tsx` | Historial, corrección, borrado e invalidación de queries |
| frontend · features/profile | — | `components/PhysicalDataForm.tsx`, `pages/ProfilePage.tsx`, `pages/ProfilePage.test.tsx` | `recorded_at` con la fecha del dispositivo y descripción nueva de "Datos físicos" |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

**Modelo `BodyMetric`** (`backend/models/body_metric.py`): `__table_args__` pasa a ser
`(UniqueConstraint("user_id", "recorded_at", name="uq_body_metrics_user_id_recorded_at"), {"schema": "public"})`. No hay columnas nuevas. Se mantiene el índice actual de `user_id`.

**Módulo `backend/utils/body_metric_consolidation.py`**: expone `consolidate_duplicate_body_metrics(connection)`, que ejecuta con `sqlalchemy.text` dos sentencias estáticas, sin parámetros ni concatenación:

1. `UPDATE`: en cada grupo `(user_id, recorded_at)` con más de una fila, actualiza la fila que se conserva, que es la registrada más tarde (`ORDER BY created_at DESC, id DESC`, con `ROW_NUMBER() = 1`). Sus columnas `weight`, `body_fat_percentage`, `muscle_mass_percentage` y `notes` toman, cada una por separado, el valor de la fila más reciente del grupo que lo tenga no nulo (subconsulta correlacionada `… WHERE col IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1`).
2. `DELETE`: borra las filas con `ROW_NUMBER() > 1` de cada grupo.

Los grupos de una sola fila no se tocan (AC-006.2) y la partición incluye `user_id` (AC-006.3). Un comentario indica que el módulo está **congelado** porque lo usa una migración (ADR-0020).

**Migración** (`flask db migrate` como base, revisada a mano; Art. 6.4):
- `upgrade()`: `consolidate_duplicate_body_metrics(op.get_bind())` y después `op.create_unique_constraint("uq_body_metrics_user_id_recorded_at", "body_metrics", ["user_id", "recorded_at"], schema="public")`.
- `downgrade()`: solo `op.drop_constraint(…, type_="unique", schema="public")`. La consolidación no se deshace, y así se indica en el docstring.
- **No** toca `user_profiles`: no hay sincronización inicial (spec §6, Q5).
- En producción se aplica a mano (ADR-0016). Hasta entonces, el servicio sigue funcionando: busca la medición del día antes de insertar.

### 3.2 Contratos de API

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/body-metrics` | `@require_auth` | — | `200` con una lista de mediciones, ordenada por `recorded_at` descendente (sin cambios) | `401` |
| POST | `/api/body-metrics` | `@require_auth` | `{weight?, body_fat_percentage?, muscle_mass_percentage?, notes?, recorded_at?}` | `201` con la medición si se crea · `200` con la medición combinada si ya había una en esa fecha | `400` (mensajes de spec §6) · `401` |
| PUT (nuevo) | `/api/body-metrics/<uuid:metric_id>` | `@require_auth` | `{weight?, body_fat_percentage?, muscle_mass_percentage?}`; se ignora cualquier otro campo | `200` con la medición corregida | `400` · `401` · `404` "Registro no encontrado" |
| DELETE | `/api/body-metrics/<uuid:metric_id>` | `@require_auth` | — | `204` (sin cambios) | `401` · `404` "Registro no encontrado" |

La medición se serializa con `_serialize()`, que no cambia. El `user_id` sale siempre de `g.decoded_token["id"]` y nunca del cuerpo (NFR-001). La ruta lee el cuerpo con `request.get_json(silent=True)` y lo pasa **sin desempaquetar** al servicio, que es quien valida (Art. 7.3). La ruta de `POST` decide el código según `result.created`.

### 3.3 Lógica de negocio

**`BodyMetricService`** (`backend/services/body_metric_service.py`):

```python
BodyMetricService(body_metric_repository, user_repository, user_profile_repository, unit_of_work, clock=utc_now)
save_metric(user_id, data) -> SaveMetricResult(metric, created: bool)   # POST
update_metric(user_id, metric_id, data) -> BodyMetric                   # PUT
delete_metric(user_id, metric_id) -> None                               # DELETE
list_metrics(user_id)                                                   # sin cambios
```

`utc_now` y `WEIGHT_RANGES` se importan de `services/profile_service.py` (reutilización; el rango del perfil es uno solo). `create_metric` desaparece y la sustituye `save_metric`.

**Constantes de mensajes** (texto literal de la spec §6): `INVALID_BODY_MESSAGE` "Los datos de la medición no son válidos", `NO_VALUES_MESSAGE`, `WEIGHT_MESSAGE` "El peso debe estar entre 29,9 y 300 kg", `FAT_MESSAGE`, `MUSCLE_MESSAGE`, `INVALID_DATE_MESSAGE`, `FUTURE_DATE_MESSAGE` y `NOT_FOUND_MESSAGE` "Registro no encontrado". Los rangos son `WEIGHT_RANGE = (29.9, 300)`, `FAT_RANGE = (3, 60)` y `MUSCLE_RANGE = (10, 70)`, y `KG_PER_LB = 0.45359237`.

**Validación** (función pura `_validate_values(data)`, compartida por `POST` y `PUT`). Lanza el primer `ValidationError` en este orden, así que solo se informa de un error:
1. `data` no es `dict` → `INVALID_BODY_MESSAGE` (AC-002.7).
2. Los tres valores son `None` o están ausentes → `NO_VALUES_MESSAGE` (AC-002.1, AC-003.4).
3. Por cada valor no `None`, en el orden peso, grasa y músculo: si no es número (`int` o `float`, no `bool`, finito; `"80"` no vale) o está fuera de su rango, inclusivo → su mensaje (AC-002.2–002.4, AC-002.8).
4. Solo en `POST`, `_parse_recorded_at(value, today)`:
   - `None` o ausente → `today`;
   - no es `str`, no cumple `^\d{4}-\d{2}-\d{2}$` o `date.fromisoformat` falla → `INVALID_DATE_MESSAGE`;
   - `> today + 1 día` → `FUTURE_DATE_MESSAGE` (AC-002.5, AC-002.6, AC-001.6).

   `today` es `self.clock().date()`, que es UTC.
5. `notes` (solo en `POST`) debe ser `str` o `None`; si no, `INVALID_BODY_MESSAGE`. Este caso no lo cubre ningún AC: evita un 500 al guardar un objeto en `Text`.

Los valores se guardan tal como llegan, sin redondear.

**Esquema transaccional** de las tres escrituras, con el mismo patrón que `ProfileService.save_profile`:
1. Validar **antes** de tocar nada, para que un `400` no modifique el estado (REQ-002, AC-002.9).
2. Abrir `try:`.
3. `user_repository.get_by_id_for_update(user_id)`, que serializa las escrituras del usuario (incluido `PUT /api/profile`). Si devuelve `None` → `ResourceNotFoundError("Usuario no encontrado")`; es un caso degenerado, con un token de un usuario borrado.
4. Operación (ver abajo).
5. `self._sync_profile_weight(user_id)`.
6. `unit_of_work.commit()`.
7. `except Exception: unit_of_work.rollback(); raise`.

**Operaciones:**
- `save_metric` (REQ-001): `existing = body_metric_repository.get_by_user_and_date(user_id, recorded_at)`.
  - Si existe, cada campo de `weight`, `body_fat_percentage`, `muscle_mass_percentage` y `notes` cuyo valor recibido no es `None` sustituye al guardado (Q13); los demás se conservan. Resultado: `created=False`.
  - Si no existe, `BodyMetric(...)` y `body_metric_repository.create(...)`. Resultado: `created=True`.
- `update_metric` (REQ-003): `metric = get_by_id_and_user(metric_id, user_id)`; si es `None` → `ResourceNotFoundError(NOT_FOUND_MESSAGE)` (AC-003.5, AC-N001.2). Los tres valores se asignan tal cual (`None` deja el campo vacío). No toca `recorded_at` ni `notes` (AC-003.2, AC-003.3).
- `delete_metric` (REQ-004): si no existe → `404`; si existe, `body_metric_repository.delete(metric)`.

**`_sync_profile_weight(user_id)`** (REQ-005):
1. `profile = user_profile_repository.get_by_user_id(user_id)`. Si no hay perfil, no hace nada (AC-005.9).
2. `latest = body_metric_repository.get_latest_with_weight(user_id)`. Si es `None`, no hace nada (AC-005.6).
3. `profile_kg = profile.weight` si la unidad es `kg`, o `profile.weight * KG_PER_LB` si es `lb`. Si `abs(latest.weight - profile_kg) <= 0.05`, no hace nada (AC-005.4, AC-005.5).
4. Si no, `value = _round1(latest.weight` (en kg) o `latest.weight / KG_PER_LB` (en lb)`)` con `Decimal` y `ROUND_HALF_UP`, igual que en el perfil. Después, `value = min(max(value, low), high)` con `WEIGHT_RANGES[unit]` (AC-005.8), y `profile.weight = value`.
5. No toca ningún otro campo del perfil ni de `users` (AC-005.10).

En el repositorio real, la consulta de la última medición ve los cambios pendientes por el *autoflush* de la sesión.

**Repositorio** (`BodyMetricRepository`), con métodos nuevos que usan el ORM y filtran siempre por `user_id`:
- `get_by_user_and_date(user_id, recorded_at)`: `select … where user_id == … and recorded_at == …` → `first()`.
- `get_latest_with_weight(user_id)`: `where user_id == … and weight is not None order_by(recorded_at.desc()) limit 1` → `first()`.

**Rutas** (`body_metric_routes.py`):
- `_build_body_metric_service()` construye `BodyMetricRepository`, `UserRepository`, `UserProfileRepository` y `UnitOfWork` sobre `db.session`.
- `POST` deja de usar `date.fromisoformat` y `date.today()`; el servicio resuelve la fecha.
- `_build_progress_analysis_service()` no cambia.

### 3.4 Frontend

**`features/body-metrics/types.ts`**
- `CreateBodyMetricPayload` no cambia; `recorded_at?` ya existe.
- Nuevo `UpdateBodyMetricPayload = { weight: number | null; body_fat_percentage: number | null; muscle_mass_percentage: number | null }`.

**`api.ts`**: `updateBodyMetric(id: string, payload: UpdateBodyMetricPayload)` → `apiFetch<BodyMetric>(\`/api/body-metrics/${id}\`, { method: "PUT", body: payload })`. Los demás no cambian.

**`hooks.ts`** (claves `bodyMetricsKeys.list = ["body-metrics"]` y `profileKeys.detail = ["profile"]`, importada de `@/features/profile/hooks`):
- `useUpdateBodyMetric()`: `mutationFn: ({ id, payload }) => updateBodyMetric(id, payload)`. En `onSuccess` **devuelve** `Promise.all([invalidateQueries(list), invalidateQueries(profile)])`, de modo que la mutación sigue en `isPending` hasta que se recargan las queries activas. Así el formulario y el diálogo se cierran con los datos nuevos ya en caché, y `/profile`, `/home` y `/macros` leen el perfil sincronizado (REQ-011).
- `useDeleteBodyMetric()`: igual, con la invalidación del perfil añadida.
- `useCreateBodyMetric()` no cambia: desde el perfil, el perfil ya tiene el peso nuevo (setQueryData) y la sincronización del servidor no lo altera (la diferencia es ≤ 0,05 kg). Se mantiene sin cambios para no alterar los tests de la spec 006 que cuentan lecturas del perfil.

**`schemas.ts` (nuevo)**: `makeMetricCorrectionSchema(weightUnit: "kg" | "lb", originalWeightDisplay: string, originalWeightKg: number | null)`. Es un `z.object({ weight: z.string(), fat: z.string(), muscle: z.string() })` con `superRefine`:
- Los tres vacíos (tras `trim`) → issue en la raíz con "Registra al menos un valor" (AC-009.5).
- Peso no vacío → número finito en `LIMITS.kg` o `LIMITS.lb` (de `@/features/onboarding/constants`), o "Entre 30 y 300 kg" / "Entre 66 y 660 lb" con `path: ["weight"]`.
  - **Excepción:** si el texto es igual a `originalWeightDisplay` y `originalWeightKg` está en 29,9–300, se acepta sin comprobar el rango. Así, una medición de 29,9 kg (65,9 lb) puede corregirse en su grasa (riesgo R4).
- Grasa no vacía → 3–60 o "Entre 3 y 60 %". Músculo no vacío → 10–70 o "Entre 10 y 70 %". Se reutilizan los límites `FAT_LIMITS` y `MUSCLE_LIMITS` de `PhysicalDataForm`, movidos a `features/body-metrics/schemas.ts` y exportados. `PhysicalDataForm` los importa de ahí, sin cambiar su comportamiento.

Además, una función pura `correctionPayload(values, weightUnit, original: BodyMetric): UpdateBodyMetricPayload`:
- Si el texto del peso no cambió → `original.weight` (AC-009.3).
- Si el usuario cambió el peso en `lb` → `Math.round(n * KG_PER_LB * 10) / 10` (AC-009.4).
- Si cambió el peso en `kg` → `Number(text)`.
- Grasa y músculo: `Number(text)` o `null` si están vacíos (AC-009.2).

**`components/MetricsHistory.tsx` (nuevo)**: props `metrics: BodyMetric[]`, `weightUnit` y `toDisplayWeight`.
- Ordena una copia por `recorded_at` descendente.
- Estado `visibleCount` (10, y suma 10 con "Mostrar más", que solo se muestra si `visibleCount < metrics.length`; AC-008.3, AC-008.4) y estado `editingId`.
- Renderiza una `<table>` con cabeceras "Fecha", "Peso", "% Grasa" y "% Músculo" y una columna de acciones con cabecera solo para lectores de pantalla.
- Celdas:
  - fecha: `formatDate(recorded_at)`;
  - peso: `${one.format(toDisplayWeight(kg))} ${weightUnit}`;
  - grasa y músculo: `${one.format(v)} %`;
  - "—" si el valor es nulo.

  `one` es `Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 })`, el mismo de la página.
- Botones de icono (`Pencil` y `Trash2` de lucide) con `aria-label` "Corregir medición del {formatDate}" y "Borrar medición del {formatDate}" (AC-008.5).
- La fila en edición se sustituye por `<tr><td colSpan={5}><MetricEditForm …/></td></tr>`.

**`components/MetricEditForm.tsx` (nuevo)**: react-hook-form con `zodResolver(makeMetricCorrectionSchema(…))` y `mode: "onChange"`. Los valores iniciales son el peso en la unidad del perfil y la grasa y el músculo como texto (`""` si son nulos).
- Campos con `NumberField` (`@/features/onboarding/components/NumberField`) y `Label` con `htmlFor` únicos por `id` de la medición: "Peso (kg)" o "Peso (lb)", "% Grasa corporal" y "% Masa muscular" (AC-009.1).
- Errores: bajo cada campo, y el de la raíz como texto "Registra al menos un valor".
- "Guardar" está `disabled` si `!formState.isValid || mutation.isPending`, y su texto pasa a "Guardando…" mientras guarda (AC-009.5–009.7).
- Al guardar con éxito, llama a `onDone()`, que cierra el formulario.
- Si falla, el formulario sigue abierto con los valores y muestra `role="alert"` con "No se pudo guardar la medición. Inténtalo de nuevo." (AC-009.8).
- "Cancelar" (`type="button"`) llama a `onCancel()` sin mutar nada (AC-009.9).

**`components/DeleteMetricDialog.tsx` (nuevo)**: `Dialog` de `@/components/ui/dialog` con `showCloseButton={false}`, para evitar el texto "Close" en inglés.
- `DialogTitle` "¿Borrar la medición del {fecha}?" y `DialogDescription` "Esta acción no se puede deshacer." (AC-010.1).
- Botones:
  - "Cancelar" cierra el diálogo sin mutar (AC-010.2);
  - "Borrar" llama a `mutate(id)`; se deshabilita y no reenvía mientras `isPending` (AC-010.5). Si va bien, cierra el diálogo; la lista se recarga (AC-010.3 y AC-010.6). Si falla, muestra `role="alert"` con "No se pudo borrar la medición. Inténtalo de nuevo." y deja el diálogo abierto (AC-010.4).
- Mientras `isPending`, el diálogo ignora `onOpenChange(false)`.

**`pages/BodyMetricsPage.tsx`**: dentro del bloque `insights && metrics`, entre "Análisis del coach" (`fadeIn(3)`) y "Constancia" (pasa a `fadeIn(5)`), se añade `<Section title="Historial"><MetricsHistory metrics={metrics} weightUnit={weightUnit} toDisplayWeight={toDisplayWeight} /></Section>` con `fadeIn(4)` (AC-008.7). Se elimina el comentario obsoleto sobre "Historial" reducido a la racha. El estado vacío no cambia (AC-008.6).

**`features/profile/components/PhysicalDataForm.tsx`**: el `mutateAsync` de la medición añade `recorded_at: todayIsoDate()` (ya importado de `@/lib/dates`, en hora local; AC-007.1 y AC-007.2). Nada más cambia.

**`features/profile/pages/ProfilePage.tsx`**: la descripción de "Datos físicos" pasa a ser el texto de AC-007.3.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `BodyMetricService.save_metric` (búsqueda con `get_by_user_and_date`, combinación de campos no nulos, `created`); ruta `POST` (201/200); restricción única en el modelo y la migración; bloqueo de `users` con `get_by_id_for_update` |
| REQ-002 | `_validate_values` y `_parse_recorded_at` en `BodyMetricService` (validación antes de escribir), con el reloj UTC inyectado; `get_json(silent=True)` en las rutas |
| REQ-003 | `BodyMetricService.update_metric`; ruta `PUT /api/body-metrics/<uuid>` |
| REQ-004 | `BodyMetricService.delete_metric` (ya existe; se añaden el bloqueo y la sincronización); ruta `DELETE` sin cambios |
| REQ-005 | `BodyMetricService._sync_profile_weight` con `UserProfileRepository` y `BodyMetricRepository.get_latest_with_weight`; `WEIGHT_RANGES` de `profile_service` |
| REQ-006 | `backend/utils/body_metric_consolidation.py` invocado desde la migración nueva, antes de crear la restricción única |
| REQ-007 | `PhysicalDataForm` (`recorded_at: todayIsoDate()`); descripción en `ProfilePage`; combinación por día del backend (REQ-001) |
| REQ-008 | `MetricsHistory.tsx` dentro de `BodyMetricsPage` (orden, columnas, unidad, "—", paginación y nombres accesibles) |
| REQ-009 | `MetricEditForm.tsx`, `makeMetricCorrectionSchema` y `correctionPayload` en `schemas.ts`, `useUpdateBodyMetric` y `updateBodyMetric` |
| REQ-010 | `DeleteMetricDialog.tsx` y `useDeleteBodyMetric` |
| REQ-011 | `onSuccess` de `useUpdateBodyMetric` y `useDeleteBodyMetric`, que espera la invalidación de `["body-metrics"]` y `["profile"]`; en el servidor, la sincronización de REQ-005 |
| NFR-001 | `@require_auth` en las cuatro rutas; `user_id` siempre del token; `get_by_id_and_user` filtra en la misma consulta; el servicio ignora `user_id` del cuerpo y solo lee el perfil del usuario del token |

## 5. Estrategia de pruebas

### 5.1 Fakes nuevos (`backend/tests/fakes.py`)
- **`FakeBodyMetricRepository`**: almacén en memoria de instancias reales de `BodyMetric`. `create` les asigna `id = uuid4()` y `created_at`, porque los valores por defecto del modelo solo se aplican al hacer flush.
  - Métodos: `create`, `delete`, `list_by_user` (descendente), `get_by_id_and_user`, `get_by_user_and_date` y `get_latest_with_weight`, más `created` y `deleted` para las aserciones.
  - Constructor opcional `metrics=[…]` para precargar.
- **`FakeUserProfileRepository`**: `get_by_user_id` sobre un dict de perfiles (`SimpleNamespace` o `UserProfile` sin sesión).
- **`FakeLockingUserRepository`**: `get_by_id_for_update`, que registra las llamadas en `for_update_calls`.
- Se reutilizan `FakeUnitOfWork` y `FakeClock`, fijado en `datetime(2026, 10, 12, 12, 0)` (fecha UTC del servidor de los AC).

### 5.2 Tests unitarios de servicio (`backend/tests/test_services/test_body_metric_service.py`)
Sin Postgres; cada AC lleva el marcador `# SDD:`.
- **REQ-001:** AC-001.1–001.5 (crear, combinar con el mismo `id`, combinación parcial, otro día, otro usuario) y AC-001.6, con `recorded_at` ausente → `date(2026,10,12)` del reloj. AC-001.7: secuencia de registros, correcciones y borrados sobre el fake → fechas únicas.
- **REQ-002:** AC-002.1–002.9 con mensajes literales, incluidos `"80"` como texto, `True`, `NaN` y los límites exactos 29,9/300, 3/60 y 10/70. Fecha: `"2026-10-13"` se acepta y `"2026-10-14"` se rechaza; también `"2026-02-30"`, `"20261012"` y `123`. Cuerpo `None` o lista. En cada rechazo se comprueba que el fake no cambió y que `committed` es `False`.
- **REQ-003:** AC-003.1–003.5. Las notas y la fecha se conservan, y `404` por un `id` ajeno o inexistente.
- **REQ-004:** AC-004.1–004.2.
- **REQ-005:** AC-005.1–005.10:
  - conversión a lb (176,4);
  - sin cambio por debajo de 0,05 kg (173 lb frente a 78,5 kg);
  - sin mediciones de peso, el perfil queda igual;
  - medición con peso nulo, se pasa a la anterior;
  - ajuste al límite de 30 kg;
  - sin perfil, el fake de perfiles sigue vacío;
  - los demás campos del perfil no cambian.
- **NFR-001:** AC-N001.2 (unitario: corregir o borrar con el `user_id` de A el `id` de B → `404`; B intacto) y AC-N001.3 (`data` con `user_id` de B → la medición queda con el `user_id` de A).

### 5.3 Tests de integración de rutas (`backend/tests/test_routes/test_body_metric_routes.py`, Postgres)
Usan `registered_user` y el helper `create_user` (mismo patrón que `test_profile_routes.py`), y `PUT /api/profile` para crear perfiles. Como el reloj es el real, las fechas relativas se calculan con `datetime.now(timezone.utc).date()`; los ejemplos exactos (2026-10-12) quedan en los unitarios.
- **REQ-001:**
  - AC-001.1, 001.2 (`201` y después `200` con el mismo `id` y un solo elemento en el `GET`), 001.4, 001.5;
  - AC-001.6 (sin `recorded_at` → hoy UTC);
  - AC-001.7 (secuencia con `POST`, `PUT` y `DELETE` → `GET` sin fechas repetidas);
  - además, un test de que la base rechaza un duplicado insertado directamente con `IntegrityError`, que comprueba la restricción.
- **REQ-002:**
  - AC-002.1–002.5 y AC-002.7: cuerpo ausente, `data="[]"` y `"no-json"` con `content_type` JSON;
  - AC-002.6 con `hoy+1` aceptado y `hoy+2` rechazado;
  - AC-002.8, AC-002.9;
  - AC-002.10: insertar `BodyMetric(body_fat_percentage=2)` directamente con `db.session` y leerlo con `GET`.
- **REQ-003:** AC-003.1–003.5 por HTTP.
- **REQ-004:** AC-004.1–004.2.
- **REQ-005:** AC-005.1–005.3, 005.8 (con `recorded_at` de hoy UTC), 005.9 (`GET /api/profile` → `profile: null`, `onboarding_completed: false`) y 005.10 (compara el `GET /api/profile` completo antes y después, salvo `weight`).
- **NFR-001:**
  - AC-N001.1: `PUT` y `DELETE` sin token y con un token inválido → `401`, sin cambios;
  - AC-N001.2: A contra un `id` de B → `404`; B intacto, también su perfil;
  - AC-N001.3: `POST` de A con `"user_id": <id de B>` → `GET` de B vacío y su perfil intacto.

### 5.4 Test de consolidación (`backend/tests/test_services/test_body_metric_consolidation.py`, Postgres con `db_session`)
Dentro de la transacción del test:
1. `ALTER TABLE public.body_metrics DROP CONSTRAINT uq_body_metrics_user_id_recorded_at`.
2. Insertar usuarios y mediciones duplicadas con `created_at` explícitos.
3. `consolidate_duplicate_body_metrics(db_session.connection())`.
4. Comprobar los resultados.
5. `db_session.rollback()` en un `finally`. El DDL de Postgres es transaccional, así que la restricción vuelve.

Cubre AC-006.1 (79,8 y 20), AC-006.2 (sin cambios) y AC-006.3 (dos usuarios no se mezclan).

**Adaptación de los tests existentes** (no es debilitarlos, Art. 5.3): los 4 tests de `test_body_metric_service.py` usan el constructor antiguo, `create_metric(...)` con kwargs y un fake local sin los métodos nuevos. El test-author cambia el fixture a los fakes compartidos y la llamada a `save_metric(user_id, {...})`, y conserva cada aserción:
- el peso 0 sigue rechazándose (ahora por el rango de 29,9);
- la grasa 150 sigue rechazándose;
- los valores vacíos siguen rechazándose;
- el registro solo con peso se crea, queda en `created` y hace commit.

### 5.5 Frontend (Vitest + RTL; red simulada con `vi.mock` de `api.ts`, como hacen ya `BodyMetricsPage.test.tsx` y `ProfilePage.test.tsx`)
- **`features/body-metrics/schemas.test.ts`**: `makeMetricCorrectionSchema` (los tres vacíos, límites en kg y lb, grasa y músculo, excepción del peso sin cambios) y `correctionPayload` (peso sin cambiar → kg original; 160 lb → 72,6; vacío → `null`). Apoya AC-009.3–009.6.
- **`features/body-metrics/components/MetricsHistory.test.tsx`**: render dentro de `QueryClientProvider`, con `updateBodyMetric`, `deleteBodyMetric` y `listBodyMetrics` simulados.
  - AC-008.1–008.5: orden, "—", lb, 23 → 10/20/23 y nombres accesibles con `formatDate`.
  - AC-009.1–009.9: campos, payload exacto de `updateBodyMetricMock`, "Guardando…" con una promesa pendiente, error que conserva los valores y "Cancelar" sin llamada.
  - AC-010.1–010.5: diálogo, "Cancelar" sin llamada, éxito (la lista simulada se recarga sin la fila), error y doble clic con una promesa pendiente → una sola llamada.
  - Para que la fila muestre "79 kg" tras guardar (AC-009.2), `listBodyMetrics` devuelve en la segunda llamada la medición corregida.
- **`features/body-metrics/pages/BodyMetricsPage.test.tsx`**:
  - AC-008.6 (sin mediciones → "Aún no tienes mediciones" y sin "Historial");
  - AC-008.7 (orden de los títulos `h2`: "Análisis del coach" < "Historial" < "Constancia");
  - AC-010.6 (borrar la única medición → estado vacío);
  - AC-011.1 (corregir 78,5 → 78 y el KPI "Peso" muestra "78 kg"; se busca dentro del KPI).
  - **Ajuste obligatorio de dos aserciones existentes:** `findByText(/173[.,]1 lb/)` y `getByText(/78[.,]5 kg/)` pasarán a encontrar dos nodos (KPI e historial), y `*ByText` falla con varias coincidencias. El test-author las acota a la tarjeta del KPI "Peso" con `within(…)` sin cambiar el valor esperado, y lo anota en un comentario.
- **REQ-011 entre pantallas** (`BodyMetricsPage.test.tsx`, con `MemoryRouter` que incluye `/body-metrics`, `/profile` y `/home`, como `renderPage(extra)` en `ProfilePage.test.tsx`):
  - AC-011.2: después del borrado, `getProfile` devuelve el perfil con peso 80; navegar a `/profile` → el campo de peso vale 80;
  - AC-011.3: navegar a `/home` → "80 kg";
  - AC-011.4: `listBodyMetrics` devuelve después solo la de grasa 22 → en `/profile` "% Grasa corporal" vale 22.

  También se comprueba que, tras la mutación, `getProfile` se llama otra vez, es decir, que el perfil se invalidó.
- **`features/profile/pages/ProfilePage.test.tsx`**: con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 12, 20, 0))` (20:00 local, para que la fecha difiera de la UTC en husos negativos):
  - AC-007.1: `createMetricMock.mock.calls[0][0]` incluye `recorded_at: "2026-10-12"`;
  - AC-007.2: dos guardados seguidos con peso 80 y luego 79,5 → los dos con `recorded_at` de hoy y el segundo con 79,5; "Cambios guardados" visible. La parte "una sola fila en el historial" depende del servidor y la cubre AC-001.2 en integración;
  - AC-007.3: el texto literal de la descripción.

### 5.6 Cobertura por AC
Todos los AC de REQ-001 a REQ-011 y de NFR-001 tienen al menos un test asignado en los apartados 5.2–5.5. Los de backend con reloj exacto están en los unitarios; las fechas relativas al reloj real, en integración; y la consolidación, en su test con Postgres.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| R1. La migración (consolidación irreversible y restricción única) se aplica a mano en Supabase y puede olvidarse o fallar por duplicados no previstos | Media | Alto | La consolidación va **antes** de crear la restricción y en la misma migración. Antes de aplicarla, contar los duplicados con un `SELECT user_id, recorded_at, count(*) … HAVING count(*) > 1` y hacer una copia de seguridad de la tabla. Ejecutar `flask db upgrade` siempre con `FLASK_ENV=development` en local (punto delicado de CLAUDE.md). El reviewer comprueba la migración a mano (Art. 6.4). Mientras no se aplique, el servicio no duplica, porque busca antes de insertar. |
| R2. Los tests existentes se rompen por cambios de diseño previstos: el constructor y la firma de `BodyMetricService` (4 tests unitarios) y el texto repetido en Métricas (2 aserciones de `BodyMetricsPage.test.tsx`) | Alta | Medio | Se documenta en §5.4 y §5.5 qué se adapta y cómo, conservando cada aserción. El verifier comprueba que no se debilita ni se borra ningún test. |
| R3. Dos escrituras simultáneas del mismo usuario y día chocan con la restricción única (`IntegrityError` → 500) | Baja | Medio | Toda escritura bloquea antes la fila de `users` (`SELECT … FOR UPDATE`), el mismo bloqueo que usa `PUT /api/profile`, así que también se serializa con el guardado del perfil. |
| R4. Una medición de 29,9 kg (66 lb guardadas desde el perfil) se muestra como 65,9 lb y no podría corregirse sin tocar el peso | Media | Bajo | Excepción en `makeMetricCorrectionSchema`: el peso sin cambiar es válido si su valor original en kg está entre 29,9 y 300 (el rango del servidor). |
| R5. `PhysicalDataForm` guarda su estado inicial en `useState`; si el perfil se recarga mientras está montado, no se actualiza | Baja | Bajo | En el flujo de la spec, el formulario se monta al navegar a `/profile` después de la mutación, y la mutación espera a que se recarguen las queries activas (`onSuccess` devuelve las invalidaciones). Resincronizar el formulario montado queda fuera de alcance. |
| R6. La migración importa código de la aplicación (`utils/body_metric_consolidation.py`) | Baja | Medio | El módulo se declara congelado (ADR-0020). Su test lo ejecuta contra Postgres, así que se prueba el mismo SQL que corre en producción. |

## 7. Cumplimiento de la constitución

- **Art. 4 (trazabilidad):** cada AC tiene test asignado (§5.6); cada REQ y NFR está en el mapa (§4).
- **Art. 5 (TDD):** los tests se derivan de la spec. Los unitarios usan fakes escritos a mano e inyectados por constructor, sin `unittest.mock` ni `monkeypatch` (el reloj es `FakeClock`). En el frontend, la red se simula en `api.ts`. Los tests existentes se adaptan sin debilitarlos (§5.4 y §5.5).
- **Art. 6.1–6.3 (capas y errores):** las rutas solo leen el JSON, llaman al servicio y serializan. La validación y las reglas están en el servicio, el acceso a datos en el repositorio, y solo `UnitOfWork` hace commit o rollback. Los errores son `ValidationError` y `ResourceNotFoundError`, y las dependencias se inyectan por constructor desde `_build_body_metric_service()`.
- **Art. 6.4 (migraciones):** la migración se incluye con la restricción y la consolidación. El reviewer la comprueba porque `create_all()` no la detecta.
- **Art. 6.5 y 6.10 (lint):** ruff sin violaciones nuevas en los archivos Python tocados; `npm run lint` y `npx tsc -b` limpios.
- **Art. 6.6–6.9 (frontend):** la organización por feature se mantiene (`api.ts`, `hooks.ts`, `types.ts`, `schemas.ts` nuevo, `components/` y `pages/`). Las llamadas pasan por `apiFetch`, el estado de servidor está en TanStack Query con claves en `hooks.ts`, y el formulario de corrección usa react-hook-form con zod. El `Dialog` es el de shadcn, en `components/ui/`. **Excepción heredada:** `PhysicalDataForm` sigue sin react-hook-form (spec 006). Esta feature solo le añade `recorded_at` y mueve las constantes de límites; reescribirlo queda fuera de alcance.
- **Art. 6.11:** todos los textos en español y sin voseo; el diálogo oculta el botón "Close" en inglés de shadcn (`showCloseButton={false}`).
- **Art. 7.2:** el `PUT` nuevo usa `@require_auth` y filtra por el `user_id` del token, en la misma consulta.
- **Art. 7.3:** el servicio valida todo input con `ValidationError`, y el frontend con zod.
- **Art. 7.5:** sin SQL concatenado; la consolidación usa `text()` estático, sin entrada externa.
- **Art. 7.1:** no hay variables de entorno nuevas.
- **No se usa ningún DEBERÍA sin cumplir.**

## 8. ADRs

- [ADR-0020](../../docs/sdd/decisions/ADR-0020-una-medicion-por-dia.md): una medición por usuario y día (restricción única y combinación en el servicio, con bloqueo de la fila del usuario), peso del perfil sincronizado en el servidor y consolidación de duplicados en la migración. Estado: Aceptada.
