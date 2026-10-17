# Plan 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-16)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución

- **Backend:** un único cambio de validación. `_parse_recorded_at` de `services/body_metric_service.py` rechaza las fechas anteriores en más de 366 días a la fecha del reloj inyectado, con un mensaje nuevo (REQ-005). La sincronización del peso del perfil ya usa la medición de peso de **fecha** más reciente (`get_latest_with_weight` ordena por `recorded_at`, spec 008 y ADR-0020), así que REQ-006 no cambia código: se cubre con tests de regresión.
- **Frontend (Métricas):** un botón "Registrar medición" bajo el subtítulo abre el diálogo nuevo `RegisterMetricDialog`. El diálogo usa react-hook-form y un esquema zod nuevo en `body-metrics/schemas.ts`, y reutiliza `useCreateBodyMetric`, `NumberField`, `Dialog` (shadcn), `LIMITS`, `FAT_LIMITS` y `MUSCLE_LIMITS`.
- **Frontend (008 F2):** `useCreateBodyMetric` pasa a invalidar también el perfil, como ya hacen la corrección y el borrado (REQ-008). `PhysicalDataForm` comprueba, tras registrar, si queda una medición de peso posterior a hoy y, si la hay, muestra el aviso y el peso real del perfil (REQ-009).
- **Migración:** no. **Dependencias nuevas:** ninguna. **Contrato de API:** solo una validación nueva en `POST /api/body-metrics`.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | services | — | `backend/services/body_metric_service.py` | Límite de 366 días hacia atrás en `_parse_recorded_at` y mensaje `TOO_OLD_DATE_MESSAGE` (REQ-005) |
| backend | tests | — | `backend/tests/test_services/test_body_metric_service.py`, `backend/tests/test_routes/test_body_metric_routes.py` | REQ-003 (servidor), REQ-005, REQ-006, REQ-009 (AC-009.5) y NFR-001 |
| frontend | lib | — | `frontend/src/lib/dates.ts` | `shiftIsoDate` para calcular "hoy menos 365 días" sin desfases de zona horaria |
| frontend | body-metrics / schemas | — | `frontend/src/features/body-metrics/schemas.ts` | Esquema del formulario de registro y payload del POST (REQ-002, REQ-003) |
| frontend | body-metrics / lógica pura | `frontend/src/features/body-metrics/laterWeight.ts` | — | Buscar la medición de peso de fecha posterior a hoy (REQ-009) |
| frontend | body-metrics / hooks | — | `frontend/src/features/body-metrics/hooks.ts` | `useCreateBodyMetric` invalida mediciones **y** perfil y espera la recarga (REQ-008) |
| frontend | body-metrics / components | `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx` | — | Diálogo "Registrar medición" (REQ-001 a REQ-004, NFR-002) |
| frontend | body-metrics / pages | — | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx` | Botón "Registrar medición", textos nuevos y apertura del diálogo (REQ-001, REQ-010) |
| frontend | profile / components | — | `frontend/src/features/profile/components/PhysicalDataForm.tsx` | Aviso de medición posterior a hoy y peso sincronizado en el formulario (REQ-009) |
| frontend | tests | `frontend/src/features/body-metrics/components/RegisterMetricDialog.test.tsx`, `frontend/src/features/body-metrics/pages/BodyMetricsPage.register.test.tsx`, `frontend/src/features/body-metrics/laterWeight.test.ts` | `frontend/src/features/body-metrics/schemas.test.ts`, `frontend/src/lib/dates.test.ts`, `frontend/src/features/profile/pages/ProfilePage.test.tsx` | Cobertura de los AC del frontend |

No cambian `routes/body_metric_routes.py`, `repositories/body_metric_repository.py`, los modelos, `api.ts` ni `types.ts`: `createBodyMetric` y `CreateBodyMetricPayload` ya admiten `recorded_at` y los campos opcionales.

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No hay cambios de modelo ni de datos. Las mediciones de más de un año que ya existen se conservan: el límite nuevo solo se aplica en `save_metric` (POST). `update_metric` (PUT) ignora `recorded_at` y `delete_metric` no lo lee (AC-005.4 y AC-005.5).

### 3.2 Contratos e interfaces

**HTTP: `POST /api/body-metrics`** (con `@require_auth`; el usuario sale del token, como hasta ahora).

| `recorded_at` (fecha del servidor `T`, UTC) | Resultado |
|---|---|
| ausente | `T` |
| no es `AAAA-MM-DD` o no es una fecha real | `400` "La fecha de la medición no es válida" (sin cambios) |
| `> T + 1 día` | `400` "La fecha de la medición no puede ser futura" (sin cambios) |
| `< T − 366 días` | `400` "La fecha de la medición no puede tener más de un año de antigüedad" (**nuevo**) |
| entre `T − 366` y `T + 1`, ambos incluidos | `201` si se crea · `200` si combina con la de esa fecha |

El orden de validación no cambia: primero los valores (`_validate_values`), luego la fecha y por último las notas, siempre antes de bloquear la fila del usuario y de escribir nada. Un `400` no modifica mediciones ni perfil.

**Backend: símbolos nuevos de `backend/services/body_metric_service.py`** (los tests los importan):

```python
TOO_OLD_DATE_MESSAGE = "La fecha de la medición no puede tener más de un año de antigüedad"
PAST_LIMIT_DAYS = 366
```

`_parse_recorded_at(value, today)` conserva su firma. No hacen falta esqueletos de funciones.

**Frontend: firmas exactas de los símbolos nuevos** (los tests los importan; el `implementer` crea los esqueletos con `throw new Error("not implemented")` y los parámetros con `_`, Art. P1 frontend 5):

`frontend/src/lib/dates.ts`
```ts
// Suma (o resta, con días negativos) días a una fecha "YYYY-MM-DD" y devuelve
// otra "YYYY-MM-DD". Opera en UTC para no depender del huso ni del horario de verano.
export function shiftIsoDate(isoDate: string, days: number): string
```

`frontend/src/features/body-metrics/schemas.ts`
```ts
export const REGISTRATION_PAST_DAYS = 365

export type MetricRegistrationValues = {
  date: string    // "YYYY-MM-DD" o "" si el usuario la borró
  weight: string
  fat: string
  muscle: string
}

export type MetricRegistrationErrorKey = "date" | "weight" | "fat" | "muscle" | "values"

// `today` es la fecha del dispositivo ("YYYY-MM-DD"). El aviso "Registra al
// menos un valor" va en la ruta ["values"] para que `fieldMessages` lo recoja.
export function makeMetricRegistrationSchema(
  weightUnit: WeightUnit,
  today: string
): z.ZodType<MetricRegistrationValues, MetricRegistrationValues>

// Cuerpo del POST: la fecha siempre; cada valor solo si está relleno; el peso
// convertido a kg (si la unidad es lb) y redondeado a un decimal.
export function registrationPayload(
  values: MetricRegistrationValues,
  weightUnit: WeightUnit
): CreateBodyMetricPayload
```

`frontend/src/features/body-metrics/laterWeight.ts`
```ts
import type { BodyMetric } from "@/features/body-metrics/types"

// La medición con peso de fecha más reciente cuya fecha es posterior a
// `today` ("YYYY-MM-DD"), o null si no hay ninguna.
export function laterWeightMetric(
  metrics: BodyMetric[],
  today: string
): BodyMetric | null
```

`frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`
```ts
type RegisterMetricDialogProps = {
  metrics: BodyMetric[]     // para el aviso de fecha con medición (REQ-004)
  weightUnit: WeightUnit
  onClose: () => void       // al cancelar o al guardar con éxito
}

export function RegisterMetricDialog(props: RegisterMetricDialogProps): JSX.Element
```
(El esqueleto puede declarar `_props: RegisterMetricDialogProps` y lanzar `not implemented`.)

**Cambios de comportamiento en símbolos existentes:**
- `useCreateBodyMetric()` (`body-metrics/hooks.ts`): `onSuccess: () => invalidateMetricsAndProfile(queryClient)`. Devuelve la promesa, así que `mutateAsync` solo se resuelve cuando se han recargado las queries activas de mediciones y perfil, igual que `useUpdateBodyMetric` y `useDeleteBodyMetric`.

### 3.3 Lógica

**Backend (`BodyMetricService`).** Dependencias sin cambios: repositorios, `UnitOfWork` y `clock` por constructor; `_build_body_metric_service()` usa el reloj real por defecto (Art. P2 backend 2).
- `_parse_recorded_at(value, today)`: tras la comprobación de fecha futura, `if parsed < today - timedelta(days=PAST_LIMIT_DAYS): raise ValidationError(TOO_OLD_DATE_MESSAGE)`. Los límites son inclusivos: `T − 366` se acepta (AC-005.1) y `T − 367` se rechaza (AC-005.2).
- **REQ-006 y AC-009.5:** sin cambios. `_sync_profile_weight` toma `get_latest_with_weight`, que ordena por `recorded_at desc`, con la tolerancia de 0,05 kg, la conversión a lb y el ajuste al rango del perfil de la spec 008. Una medición pasada con fecha anterior a la última de peso no cambia el perfil.
- **NFR-001:** sin cambios. La ruta usa `@require_auth` y `g.decoded_token["id"]`; el servicio ignora cualquier `user_id` del cuerpo.

**Frontend: reglas puras.**
- `makeMetricRegistrationSchema(weightUnit, today)`, con `superRefine` y mensajes de la sección 6 de la spec:
  - `date === ""` → `["date"]` "Elige una fecha".
  - `date > today` (comparación de cadenas ISO) → "La fecha no puede ser futura".
  - `date < shiftIsoDate(today, -REGISTRATION_PAST_DAYS)` → "Solo puedes registrar mediciones del último año".
  - Los tres valores vacíos → `["values"]` "Registra al menos un valor".
  - Peso no vacío fuera de `LIMITS.kg` o `LIMITS.lb` (`inRange` de `onboarding/schemas.ts`) → `["weight"]` "Entre 30 y 300 kg" o "Entre 66 y 660 lb".
  - Grasa y músculo con `FAT_LIMITS` y `MUSCLE_LIMITS` → "Entre 3 y 60 %" y "Entre 10 y 70 %".
  - Se reutilizan los mismos helpers y constantes que `makeMetricCorrectionSchema`. No se crea un rango nuevo.
- `registrationPayload(values, unit)`: `{ recorded_at: values.date, weight?, body_fat_percentage?, muscle_mass_percentage? }`. Peso: `Math.round(Number(w) * (unit === "lb" ? KG_PER_LB : 1) * 10) / 10` (160 lb → 72,6; 80 kg → 80). Las claves de los campos vacíos **no** se incluyen (ni con `null` ni con `undefined`; AC-003.1 y AC-003.3).
- `shiftIsoDate`: parte la cadena, usa `Date.UTC(y, m - 1, d + days)` y formatea con `getUTC*`. `shiftIsoDate("2026-10-12", -365) === "2025-10-12"`.
- `laterWeightMetric(metrics, today)`: filtra `weight !== null && recorded_at > today` y devuelve la de mayor `recorded_at`.

**Frontend: estado de servidor (REQ-008).** Con `useCreateBodyMetric` invalidando `bodyMetricsKeys.list` y `profileKeys.detail`:
- Métricas, el perfil y el guard de onboarding (que tiene `useProfile` activo) se recargan en el momento.
- Home y Macros, si no están montados, quedan marcados como obsoletos y se recargan al montarse, aunque `useProfile` tenga `staleTime`: la invalidación lo anula.
- No hace falta tocar `useSaveProfile`. Su `setQueryData` sigue igual y, cuando además se registra una medición, la invalidación posterior trae el peso sincronizado (AC-008.3).
- Un guardado que solo cambia la meta no registra medición, así que no relee el perfil: el test AC-011.7 de la spec 006 (una sola lectura) sigue válido sin tocarlo (Art. B5.3).

**Frontend: REQ-009 en `PhysicalDataForm`.**
- Recibe `useQueryClient()`.
- Tras `await createMetric.mutateAsync(...)`, que ya incluye la recarga, lee de la caché `bodyMetricsKeys.list` y calcula `later = laterWeightMetric(metrics, todayIsoDate())`.
- **Si hay `later`:**
  - Lee `profileKeys.detail` de la caché y, con `answersFromProfile`, obtiene `weight` y `weightUnit` reales.
  - `next = { ...values, weight, weightUnit }`; `setSaved(next)` y `form.reset(next)`, así que el formulario queda sin cambios pendientes (AC-009.4).
  - Guarda en el estado nuevo `laterDate` la fecha de `later` y **no** pone `justSaved` (AC-009.2).
- **Si no hay `later`:** el flujo de siempre ("Cambios guardados", AC-009.3).
- El aviso se muestra con `role="status"` y el texto exacto de la spec, con `formatDate(laterDate)`. Se oculta cuando el usuario edita cualquier campo (en `update()`, igual que `justSaved`) y no desaparece solo a los 3 segundos: es un aviso que hay que leer.

### 3.4 Interfaz de usuario

**`BodyMetricsPage`:**
- Subtítulo: "Tu progreso a partir de las mediciones que registras aquí o en tu perfil.".
- Debajo, un único `Button` "Registrar medición", visible cuando la lista ha cargado sin error, tanto con mediciones como en el estado vacío (AC-001.1, AC-001.2 y AC-010.2). Hay un solo botón con ese nombre en la página para que `getByRole` no sea ambiguo.
- Estado vacío: "Registra tu peso y, si lo conoces, tu composición corporal aquí o desde tu perfil. Aquí verás cómo evolucionan.", y se conserva el enlace "Ir a mi perfil".
- Estado `registering: boolean`. Con `true` se monta `<RegisterMetricDialog metrics={metrics ?? []} weightUnit={weightUnit} onClose={() => setRegistering(false)} />`. Como el diálogo se monta en cada apertura, el formulario arranca limpio (AC-001.5).

**`RegisterMetricDialog`.** Sigue el patrón de `DeleteMetricDialog`.
- **Estructura:**
  - `Dialog open` con `onOpenChange` que cierra salvo mientras guarda.
  - `DialogTitle` "Registrar medición": da el nombre accesible del diálogo (AC-N002.1).
  - `DialogDescription` con "Si la fecha es anterior a tu última medición de peso, el peso de tu perfil no cambia." (AC-001.6). Evita además el aviso de Radix por falta de descripción.
- **Campos**, cada uno con `Label htmlFor` y su `id`:
  - "Fecha": `Input type="date"`, `min = shiftIsoDate(today, -365)`, `max = today` (AC-002.7) y valor inicial `todayIsoDate()`.
  - "Peso ({weightUnit})", "% Grasa corporal" y "% Masa muscular": `NumberField`, vacíos al abrir.
- **Validación:**
  - Errores síncronos con `fieldMessages<MetricRegistrationErrorKey>(schema, draft)`, el patrón de `PhysicalDataForm`.
  - Cada mensaje va como `<p>` debajo de su campo, con `aria-describedby` en el input. "Registra al menos un valor" va debajo de los campos.
  - "Guardar" está deshabilitado si hay algún mensaje o si `mutation.isPending`.
- **Aviso de REQ-004:** si `metrics.some(m => m.recorded_at === draft.date)`, se muestra "Ya tienes una medición del {formatDate(date)}. Los valores que escribas sustituirán a los de ese día; los campos vacíos se conservan." con `role="status"`. No bloquea el guardado (AC-004.3).
- **Guardar:**
  - `handleSubmit` comprueba `if (mutation.isPending) return` y luego llama a `mutateAsync(registrationPayload(values, weightUnit))`.
  - Si va bien, llama a `onClose()`. Si falla, el diálogo sigue abierto con los valores y muestra `<p role="alert">` "No se pudo guardar la medición. Inténtalo de nuevo." (AC-003.6 y AC-N002.2).
  - El botón dice "Guardando…" mientras guarda (AC-003.5).
- **Cancelar:** `type="button"` y llama a `onClose` sin enviar nada.
- El historial ya ordena por fecha (`MetricsHistory`). Los indicadores, el gráfico, la racha y el contexto del análisis se recalculan desde la lista recargada con `buildInsights` y `buildAnalysisRequest`, sin cambios (REQ-007).

**`PhysicalDataForm`:** el aviso de REQ-009 sustituye a "Cambios guardados" en la misma zona, junto a los botones.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `BodyMetricsPage.tsx` (botón y estado `registering`) y `RegisterMetricDialog.tsx` (título, campos, ayuda y botones; unidad por defecto `kg` sin perfil) |
| REQ-002 | `makeMetricRegistrationSchema` y `shiftIsoDate`; `min` y `max` del input de fecha y "Guardar" deshabilitado en `RegisterMetricDialog` |
| REQ-003 | `registrationPayload` y `RegisterMetricDialog` (envío, "Guardando…", error y cierre); en el servidor, `save_metric` sin cambios (201/200 y combinación); historial ordenado por `MetricsHistory` |
| REQ-004 | `RegisterMetricDialog` (comparación de `draft.date` con `metrics`) |
| REQ-005 | `_parse_recorded_at` con `PAST_LIMIT_DAYS` y `TOO_OLD_DATE_MESSAGE` en `body_metric_service.py` |
| REQ-006 | `_sync_profile_weight` y `get_latest_with_weight` existentes (sin cambios; tests de regresión) |
| REQ-007 | `useCreateBodyMetric` (recarga) y la lógica existente de `buildInsights`, `formatInsights`, `buildAnalysisRequest` y `TrendChart` |
| REQ-008 | `useCreateBodyMetric` → `invalidateMetricsAndProfile` (perfil, Métricas, home y Macros) |
| REQ-009 | `laterWeightMetric` y `PhysicalDataForm` (aviso, peso del perfil y `saved` reajustado); en el servidor, la sincronización existente (AC-009.5) |
| REQ-010 | Textos de `BodyMetricsPage.tsx` |
| NFR-001 | `@require_auth` y `g.decoded_token["id"]` en `body_metric_routes.create` (sin cambios; tests de regresión) |
| NFR-002 | `RegisterMetricDialog`: `Dialog` de Radix con `DialogTitle`, `Label htmlFor` por campo y `role="alert"` o `role="status"` en mensajes y avisos |

## 5. Estrategia de pruebas

Marcadores con número de spec: `# SDD: 016 REQ-005 AC-005.2` y `// SDD: 016 REQ-001 AC-001.3` (Art. P1 general 1).

### backend

Servicios: Postgres de test (`docker compose up -d postgres redis`, puerto 5433) para las rutas; los unitarios no usan base de datos.

**Unitarios** (`backend/tests/test_services/test_body_metric_service.py`). Usan los fakes existentes, sin dobles nuevos: `FakeBodyMetricRepository`, `FakeLockingUserRepository`, `FakeUserProfileRepository`, `FakeUnitOfWork` y `FakeClock(datetime(2026, 10, 12, …))`, reutilizando `make_env` y `make_metric` del archivo. Ni `unittest.mock` ni `monkeypatch`. Cubren:
- AC-005.1: `"2025-10-11"` se acepta.
- AC-005.2: `"2025-10-10"` → `ValidationError(TOO_OLD_DATE_MESSAGE)`, sin `create`, sin `commit` y con el perfil intacto.
- AC-005.3: `"2026-10-14"` sigue con `FUTURE_DATE_MESSAGE`.
- AC-003.7 y AC-003.8: crear el 2026-10-05 y combinar con la medición de esa fecha.
- AC-006.1 a AC-006.4 con perfiles en kg y en lb, y AC-006.6 sin perfil.
- AC-009.5: medición del 2026-10-13 con 80 y registro del 2026-10-12 con 79; el perfil sigue en 80.

**Integración** (`backend/tests/test_routes/test_body_metric_routes.py`, fixture `client`). El reloj del servidor es el real, así que las fechas son relativas con el helper existente `day(offset)`, como el resto del archivo. Así se resuelve el punto del backlog sobre fechas fijas: no caducan. No se inyecta el reloj en la app (ver DECISIONS). Cubren:
- AC-005.1: `day(-366)` → 201.
- AC-005.2: `day(-367)` → 400 con el mensaje, y `GET` y `GET /api/profile` sin cambios.
- AC-005.3: `day(2)` → 400 "futura".
- AC-005.4 y AC-005.5: medición insertada directamente con `db.session` hace 600 días; `PUT` → 200, `DELETE` → 204 y `GET` la devuelve igual, con el patrón de `test_get_returns_an_old_metric_out_of_the_new_ranges_unchanged`.
- AC-006.5: `onboarding_completed_at`, `date_of_birth` y los demás campos iguales tras un POST pasado.
- AC-N001.1: 401 sin token o con token inválido y `day(-5)`.
- AC-N001.2: `user_id` de B en el cuerpo → 201 para A y B intacto, con el helper `create_user`.

**Rojo esperado.** En el backend solo el test de AC-005.2 (fecha de hace 367 días) falla antes de implementar. Los de AC-003.7, AC-003.8, AC-005.1, AC-005.3, AC-005.4, AC-005.5, REQ-006, AC-009.5 y NFR-001 cubren comportamiento que ya existe desde la spec 008: son **tests de regresión que pasarán en verde** desde el principio. El `verifier` debe tratarlos como tales, no como rojo ilegítimo: la spec exige que ese comportamiento se conserve con las fechas pasadas.

### frontend

Vitest con `globals: false`, `it("…")` en español y red simulada con `vi.mock("@/features/body-metrics/api", …)`, `vi.mock("@/features/profile/api", …)` y `vi.mock("@/features/auth/api", …)`, como en `BodyMetricsPage.test.tsx`. "Hoy" se fija con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 12, 12, 0))`. No hacen falta dobles nuevos; se reutiliza `makeProfileResponse` de `src/test/profileFixtures.ts`.

| Archivo | Tipo | AC |
|---|---|---|
| `src/lib/dates.test.ts` | unitario | `shiftIsoDate` (apoya AC-002.2, AC-002.3 y AC-002.7; incluye un cruce de año y un 29 de febrero) |
| `src/features/body-metrics/schemas.test.ts` | unitario | AC-002.1 a AC-002.6 sobre `makeMetricRegistrationSchema` (con `fieldMessages`); AC-003.1 a AC-003.3 sobre `registrationPayload` (claves ausentes con `not.toHaveProperty`) |
| `src/features/body-metrics/laterWeight.test.ts` | unitario | Apoyo de AC-009.1 y AC-009.3: posterior con peso, posterior sin peso (se ignora), igual a hoy (no cuenta), varias posteriores (la de fecha mayor) |
| `src/features/body-metrics/components/RegisterMetricDialog.test.tsx` | componente | AC-001.3 a AC-001.7, AC-002.1 a AC-002.7 (mensajes en pantalla, `min` y `max`, "Guardar" deshabilitado), AC-003.1 a AC-003.3 (argumentos de `createBodyMetric`), AC-003.5 (promesa pendiente: "Guardando…", deshabilitado y un solo envío), AC-003.6, AC-004.1 a AC-004.3, AC-N002.1 y AC-N002.2. Se renderiza con `QueryClientProvider` y props directas |
| `src/features/body-metrics/pages/BodyMetricsPage.register.test.tsx` | página (rutas `/body-metrics`, `/profile` y `/home` como en `BodyMetricsPage.test.tsx`) | AC-001.1, AC-001.2, AC-003.4, AC-003.9, AC-007.1, AC-007.3 a AC-007.7, AC-008.1, AC-008.2, AC-008.4, AC-010.1 y AC-010.2. `listBodyMetrics` y `getProfile` devuelven con `mockResolvedValueOnce` el estado antes y después del registro. En AC-007.7 se sustituye `TrendChart` por un stub que pinta las fechas recibidas, o bien se comprueba en `TrendChart.test.tsx` con la lista recargada: el `test-author` elige, siempre sin red real |
| `src/features/body-metrics/pages/BodyMetricsPage.analysis.test.tsx` | página | AC-007.2: tras los dos registros, el cuerpo de `analyzeBodyMetrics` lleva `rate` y `rate_kg_per_week` no nulos, calculados con las tres mediciones |
| `src/features/profile/pages/ProfilePage.test.tsx` | página | AC-008.3 (`getProfile` y `listBodyMetrics` se vuelven a llamar tras registrar un cambio de peso), AC-009.1 a AC-009.4 (la segunda respuesta de `listBodyMetrics` incluye la medición del 2026-10-13 y la segunda de `getProfile` tiene peso 80) |

**Tests existentes.** No se debilitan (Art. B5.3).
- `ProfilePage.test.tsx` AC-011.7 (spec 006) sigue contando una sola lectura del perfil, porque cambiar la meta no registra medición.
- Los tests de la spec 008 y la 015 que registran mediciones con `getProfileMock.mockResolvedValue(...)` reciben la misma respuesta en la relectura y `listMetricsMock` sin mediciones posteriores a hoy, así que siguen viendo "Cambios guardados".
- No hay tests que comprueben los textos antiguos de Métricas.

**Rojo esperado.** Todo lo de UI, los esquemas y los hooks falla antes de implementar, porque los símbolos son esqueletos o el botón no existe. AC-007.x falla porque no se puede registrar desde Métricas.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Relectura del perfil tras registrar desde el perfil: el guard de onboarding o el formulario podrían parpadear o reiniciarse | Baja | Medio | `invalidateQueries` mantiene los datos mientras recarga (`isPending` no vuelve a `true`); `PhysicalDataForm` toma `initial` solo al montarse y no se remonta. Lo cubren los tests de la spec 015 que ya registran mediciones |
| Diferencia de zona horaria entre el "hoy" del dispositivo y el UTC del servidor en los límites (365 frente a 366 días; +1 día futuro) | Media | Bajo | El servidor tiene un día de margen en cada extremo (spec 008 y REQ-005); la app valida con la fecha local |
| Tests de integración con reloj real cerca de medianoche UTC (`day(-366)` calculado en el test y en el servidor en días distintos) | Muy baja | Bajo | El margen de un día del límite absorbe el cambio de día en AC-005.1; los valores exactos del 2026-10-12 están en los unitarios con `FakeClock` |
| Aviso de REQ-009 calculado con la caché si la relectura de mediciones o del perfil falla | Baja | Bajo | Si falla la relectura, `mutateAsync` sigue resolviéndose (las invalidaciones no relanzan errores de las queries) y se usa la última caché: como mucho no se ve el aviso. Queda en el backlog |
| `getByRole("button", { name: "Registrar medición" })` ambiguo si hubiera dos botones (subtítulo y estado vacío) | Media | Bajo | Un solo botón bajo el subtítulo, visible también con el estado vacío |

## 7. Cumplimiento de la constitución

- **B1:** feature con spec aprobada; no cambia el alcance (no se edita la fecha de mediciones existentes, el perfil sigue registrando "hoy" y no se tocan los cálculos de indicadores).
- **B4 y P1 general:** cada AC tiene un test asignado en §5 con el marcador `SDD: 016 …`.
- **B5:** TDD; esqueletos con `not implemented` para `shiftIsoDate`, `makeMetricRegistrationSchema`, `registrationPayload`, `laterWeightMetric` y `RegisterMetricDialog`. Los tests de regresión en verde están justificados en §5. No se debilita ningún test.
- **B5.4 y P1 backend 3-4:** sin servicios externos; fakes a mano y Postgres de test; sin `unittest.mock` ni `monkeypatch`.
- **P1 frontend:** tests junto al archivo, `vi.mock` de la capa `api.ts`, nombres en español y sin red real.
- **P2 backend:** el cambio vive en el servicio; la ruta no cambia; `ValidationError` lo traduce `error_handlers` a `{"error": …}`; sin cambios de modelo, así que sin migración (P2.4 y P4).
- **P2 frontend:** organización por feature (`components/`, `schemas.ts`, `hooks.ts`); HTTP solo por `apiFetch` (a través de `createBodyMetric`); TanStack Query con claves en `hooks.ts`; react-hook-form y zod en el formulario nuevo; `Dialog`, `Input`, `Label` y `Button` de `src/components/ui/`.
- **P2 general:** textos de la spec en español correcto, con tildes y sin voseo.
- **P3:** el endpoint ya usa `@require_auth` y filtra por el `user_id` del token; la entrada se valida en el servicio (`ValidationError`) y con zod en el cliente; sin SQL a mano; sin variables nuevas.
- **P4:** sin migración ni pasos manuales en producción (el despliegue es el CD normal).
- No se incumple ningún "DEBERÍA".

## 8. ADRs

Ninguna. El límite de antigüedad es una regla de validación de la spec. La relectura del perfil tras registrar extiende el patrón que ya usan la corrección y el borrado (`invalidateMetricsAndProfile`, spec 008). La sincronización por fecha más reciente ya está en ADR-0020.
