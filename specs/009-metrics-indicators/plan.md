# Plan 009 — Indicadores de progreso de Métricas especificados y con tests

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-13)

## 1. Resumen de la solución

Solo cambia el frontend, y se queda en `src/features/body-metrics/`. Las reglas de los indicadores siguen en `insights.ts` como **funciones puras**. Ninguna lee el reloj: reciben `today` (ISO `YYYY-MM-DD`) como parámetro. Los cambios son estos:

- Las diferencias en días se calculan con números de día enteros, sin horas ni cambios de horario.
- Se añaden funciones nuevas para el ritmo con su estado ("reciente", "faltan registros" y "Sin registros recientes"), para el estado de meta a partir del % semanal (con "Fuera del rango de tu meta") y para los datos del gráfico (la tendencia también usa las mediciones anteriores al periodo).
- `composition` pasa a aceptar una altura ausente.

`BodyMetricsPage.tsx` y `TrendChart.tsx` solo traducen esos resultados a textos. No hay backend, ni migración, ni contratos nuevos.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | No aplica (spec §6: sin cambios de contrato ni de datos) |
| backend · repositories | — | — | No aplica |
| backend · services | — | — | No aplica |
| backend · routes | — | — | No aplica |
| frontend · features/body-metrics | `insights.test.ts`, `components/TrendChart.test.tsx` | `insights.ts`, `dateUtils.ts`, `pages/BodyMetricsPage.tsx`, `components/TrendChart.tsx`, `pages/BodyMetricsPage.test.tsx` (solo se añaden tests y se congela la fecha, §5.4) | Reglas de los indicadores (REQ-001 a REQ-010), sus textos y sus tests |
| frontend · features/onboarding | — | `units.ts` | Helper `heightCmFromAnswers`, que devuelve la altura en cm o `null` si no es válida (REQ-007, REQ-010) |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

No aplica. Los indicadores parten de `GET /api/body-metrics` y `GET /api/profile`, sin cambios.

### 3.2 Contratos de API

Sin endpoints nuevos ni modificados.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/body-metrics` (sin cambios) | `@require_auth` | — | `200` con la lista de `BodyMetric` | `401` |
| GET | `/api/profile` (sin cambios) | `@require_auth` | — | `200` con `ProfileResponse` | `401` |

### 3.3 Lógica de negocio

Toda la lógica está en `frontend/src/features/body-metrics/insights.ts` (funciones puras). No hay servicios de backend ni dependencias inyectadas: las "dependencias" son parámetros (`today`, `heightCm`, `goal`, `toDisplayWeight`).

**Utilidades de fecha (privadas o exportadas en `insights.ts`):**

```ts
// Número de día entero de una fecha ISO, calculado con Date.UTC(y, m - 1, d) / DAY_MS.
// Es inmune al huso horario y a los cambios de horario de verano.
export function dayNumber(isoDate: string): number
export function daysBetween(a: string, b: string): number   // dayNumber(b) - dayNumber(a), entero
```

Todas las comparaciones de ventanas (30 días, 28 días, 7 días, semanas y últimos 30 días) usan `daysBetween`. Hoy usan `getTime()` sobre fechas locales, que da días no enteros cuando hay cambio de horario.

**REQ-001 y REQ-002, cambio "en 30 días".** `latestWithDelta(series, days = 30)` mantiene su firma y su regla: la referencia es la medición más reciente con `daysBetween(p.date, latest.date) >= 30` y, si no hay ninguna, `series[0]`. Si la referencia es la propia última medición, `delta = null`. Solo cambia el cálculo de días. Recibe la serie de `seriesOf(metrics, "weight")` o de `seriesOf(metrics, "body_fat_percentage")`, que ya filtran las mediciones sin ese valor (AC-001.6, AC-002.4). El cambio se calcula en kg, y la página lo convierte con `toDisplayWeight` (AC-001.5).

**REQ-003, ritmo** (función nueva):

```ts
export type RateIndicator =
  | { kind: "stale" }                       // "Sin registros recientes"
  | { kind: "insufficient" }                // "Faltan registros para calcularlo"
  | { kind: "ok"; kgPerWeek: number; latestKg: number }
export function rateIndicator(weightSeries: SeriesPoint[], today: string): RateIndicator
```

Orden de evaluación:
1. Serie vacía: `insufficient`.
2. `daysBetween(last.date, today) > 28`: `stale`. Esta comprobación va antes que el mínimo de registros (AC-003.13). Como la serie es solo de peso, las mediciones sin peso no la evitan (AC-003.14).
3. Ventana: las mediciones con `daysBetween(p.date, last.date) <= 28`. Si son menos de 3, o si `daysBetween(first, last) < 10`, el resultado es `insufficient`.
4. Pendiente por mínimos cuadrados × 7: reutiliza el cálculo actual de `weeklyRate`, que se mantiene como helper con la x en días enteros. Si el denominador es 0, el resultado es `insufficient`, aunque no puede ocurrir con 10 días de amplitud. `latestKg = last.value`.

**REQ-004, estado frente a la meta:**

```ts
export type PaceStatus = "on_track" | "too_slow" | "too_fast" | "off_range"
export function ratePercent(kgPerWeek: number, weightKg: number): number   // (kgPerWeek / weightKg) * 100
export function paceStatusFromPercent(pctPerWeek: number, goal: Goal): PaceStatus
```

- `EXPECTED_RATE` mantiene los valores de la spec §6 y se quita el comentario de "provisionales".
- Los límites se incluyen con una tolerancia `EPS = 1e-9` (`pct >= low - EPS && pct <= high + EPS`), para que un -0,2 que en coma flotante sale como -0,20000000000000004 cuente como límite (AC-004.9).
- Con `maintain`, fuera del rango, el resultado es `off_range` (AC-004.4 y AC-004.12).
- Con `lose` y `lose_slow`, `pct > high` es `too_slow` (incluye ir en la dirección contraria, AC-004.7) y `pct < low` es `too_fast`.
- Con `gain` y `gain_slow`, es al revés.
- `paceStatus(rate, weight, goal)` se elimina, o pasa a delegar en las dos funciones anteriores; solo la usa la página.

**REQ-005, tendencia y datos del gráfico:**

```ts
// dateUtils.ts: inicio del periodo, "la misma fecha de hace N meses". Si ese día no
// existe (31 de marzo menos 1 mes), se usa el último día de ese mes.
export function periodStart(today: string, months: number): string
// insights.ts
export type ChartPoint = { date: string; value: number; trend?: number }
export function trendChartData(
  metrics: BodyMetric[], field: NumericField, fromIso: string,
  toDisplayWeight: (kg: number) => number
): ChartPoint[]
```

- `trendChartData` toma la serie completa del campo.
- Si es peso, calcula para cada medición el promedio en kg de las mediciones con `0 <= daysBetween(p.date, point.date) < 7`, **sobre la serie completa**, incluidas las anteriores a `fromIso` (Q1).
- Después se queda con los puntos con `date >= fromIso`.
- Al final convierte: `value = toDisplayWeight(kg)` y `trend = round1(toDisplayWeight(avgKg))`. Así se calcula en kg y se convierte al final (AC-005.3 y AC-005.4).
- Con grasa o músculo no hay `trend`.
- `movingAverage` desaparece o queda como helper interno que no redondea.
- `isWithinLastMonths` se reimplementa como `isoDate >= periodStart(todayIsoDate(), months)`. Sus tests actuales siguen valiendo, y corrige que hoy una medición de justo "hace 1 mes" quede fuera porque el corte lleva la hora actual.

**REQ-006 y REQ-007, composición e IMC:**
- `composition(metrics, heightCm: number | null)` mantiene su forma de retorno.
- Si `heightCm` es `null`, no es finito o es `<= 0`, `bmi` y `ffmi` valen `null`. `fatKg`, `leanKg` y `date` se calculan igual, a partir de la última medición con peso **y** grasa (AC-006.2 y AC-006.6).
- `bmi` usa la última medición de peso (AC-007.2) y es `null` sin mediciones de peso (AC-007.4).
- La comparación `latestWeight ? …` pasa a `latestWeight !== undefined`, para no tratar un 0 como ausente.

**REQ-008 y REQ-009, constancia.** `streak(metrics, today)` mantiene su firma y su retorno `{ weeks, last30, total, lastDate }`. `weekStart` se reescribe con `dayNumber`: el lunes es `dayNumber(iso) - ((díaSemanaUTC + 6) % 7)`. `last30` cuenta las mediciones con `0 <= daysBetween(m.recorded_at, today) <= 30`. Cuentan todas las mediciones, tengan el valor que tengan.

**REQ-010, perfil no disponible.** `heightCmFromAnswers(a: OnboardingAnswers): number | null` (en `onboarding/units.ts`) devuelve:
- con `cm`, `Number(heightCm)`;
- con `ft`, `(ft * 12 + in) * CM_PER_IN`;
- `null` si el resultado no es finito o es `<= 0`.

La lógica actual de `macros/calculations.ts` no se toca, para no ampliar el alcance.

### 3.4 Frontend

**`pages/BodyMetricsPage.tsx`:**
- `const today = todayIsoDate()` se calcula una vez por render y se pasa a `rateIndicator` y a `streak`.
- `heightCm = profile ? heightCmFromAnswers(profile) : null`. Desaparece el `0` por defecto (Q5, AC-010.1).
- `insights` se calcula con `useMemo` sobre `[metrics, profile, heightCm, today]`. Cuando llega el perfil, `useProfile` actualiza `profile` y todo se recalcula sin recargar (AC-010.3). No hay claves de query nuevas: se reutilizan `bodyMetricsKeys.list` y `profileKeys.detail`.
- Tarjeta "Ritmo". El valor es `signed.format(toDisplayWeight(kgPerWeek)) + " {unidad}/sem"` si `kind === "ok"` y "—" en otro caso. El estado se elige en este orden:
  1. `stale`: `{ label: "Sin registros recientes", tone: "muted" }`.
  2. `insufficient`: `{ label: "Faltan registros para calcularlo", tone: "muted" }`.
  3. `ok` con `profile?.goal`: `PACE_COPY[paceStatusFromPercent(ratePercent(kgPerWeek, latestKg), goal)]`.
  4. `ok` sin perfil o sin meta: ningún estado (AC-004.11 y AC-010.2).
- `PACE_COPY` añade `off_range: { label: "Fuera del rango de tu meta", tone: "warn" }`, con el mismo tono y el mismo icono `CircleAlert` que `too_fast` y `too_slow` (AC-004.4).
- `KpiTile` pone `data-tone={status.tone}` en el elemento del estado. Así el test puede comprobar que el aviso visual es el mismo sin depender de clases de Tailwind.
- "Últimos 30 días" muestra `last30 === 1 ? "1 registro" : \`${last30} registros\`` (AC-009.2).
- El resto de textos no cambia: "—", "en 30 días", "pts", "Según tu medición del {fecha}.", la ayuda de "FFMI" y "Semanas seguidas con al menos un registro".

**`components/TrendChart.tsx`:**
- `const from = periodStart(todayIsoDate(), Number(range))` y `data = trendChartData(metrics, field, from, toDisplayWeight)`.
- La línea `trend` y la leyenda "Tendencia (7 días)" se muestran solo con peso, como ahora (AC-005.6). No cambia el diseño, ni los selectores, ni el periodo por defecto ("3"), ni el mensaje "Sin registros de … en este periodo.".

**Sin schemas zod nuevos.** No hay entrada de usuario nueva, y las respuestas del servidor ya están tipadas en `types.ts`.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `insights.ts` (`seriesOf`, `latestWithDelta` con `daysBetween` entero) y `BodyMetricsPage.tsx` (tarjeta "Peso", `toDisplayWeight` y textos "{cambio} {unidad} en 30 días" y "—") |
| REQ-002 | `insights.ts` (`latestWithDelta` sobre `body_fat_percentage`) y `BodyMetricsPage.tsx` (tarjeta "% Grasa", "{valor} %" y "{cambio} pts en 30 días", sin conversión de unidad) |
| REQ-003 | `insights.ts` (`rateIndicator` nueva: `stale`, `insufficient` y `ok`; regresión del helper `weeklyRate`) y `BodyMetricsPage.tsx` (valor "{ritmo} {unidad}/sem" o "—", y estados "Sin registros recientes" y "Faltan registros para calcularlo") |
| REQ-004 | `insights.ts` (`ratePercent`, `paceStatusFromPercent` con `off_range`, `EXPECTED_RATE` y tolerancia de límites) y `BodyMetricsPage.tsx` (`PACE_COPY` con "Fuera del rango de tu meta" y tono `warn`, `data-tone`, sin estado si `stale` o `insufficient` o sin meta) |
| REQ-005 | `dateUtils.ts` (`periodStart`, `isWithinLastMonths` reimplementada), `insights.ts` (`trendChartData`: promedio de 7 días sobre la serie completa, recorte al periodo y conversión con redondeo final) y `TrendChart.tsx` (uso de `trendChartData`, leyenda solo con peso) |
| REQ-006 | `insights.ts` (`composition`: última medición con peso y grasa, masa grasa, masa magra y FFMI) y `BodyMetricsPage.tsx` (sección "Composición corporal" y sus dos descripciones) |
| REQ-007 | `insights.ts` (`composition.bmi` con la última medición de peso), `onboarding/units.ts` (`heightCmFromAnswers`, cm y ft/in) y `BodyMetricsPage.tsx` ("IMC") |
| REQ-008 | `insights.ts` (`streak.weeks` con `weekStart` por `dayNumber` y la semana actual sin mediciones como tolerancia) y `BodyMetricsPage.tsx` ("1 semana" / "{n} semanas") |
| REQ-009 | `insights.ts` (`streak.last30`, `total` y `lastDate`) y `BodyMetricsPage.tsx` ("1 registro" / "{n} registros", "{total} en total" y `formatDate(lastDate)`) |
| REQ-010 | `BodyMetricsPage.tsx` (`heightCm = null` sin perfil, unidad "kg" por defecto, estado de meta solo con `profile?.goal` y recálculo en `useMemo` al llegar el perfil) e `insights.ts` (`composition` con `bmi` y `ffmi` a `null` si la altura no es válida) |
| NFR | La spec no define ninguno (§5) |

## 5. Estrategia de pruebas

No hay tests de backend: el ámbito es solo el frontend. No hay tests de integración de rutas ni hacen falta fakes de Python. En el frontend, la red se simula con `vi.mock` de `@/features/body-metrics/api` y de `@/features/profile/api`, como en los tests actuales (Art. 5.5). La fecha se fija con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 12, 12))`, el mismo patrón de `HomePage.test.tsx` y `MacrosPage.test.tsx`, con `vi.useRealTimers()` en `afterEach`. Así `userEvent` y `waitFor` siguen funcionando.

### 5.1 Tests unitarios puros: `frontend/src/features/body-metrics/insights.test.ts` (nuevo)

No usan React ni red. Reciben `today` como argumento, sin falsear el reloj.

| Función | AC que cubre |
|---|---|
| `latestWithDelta(seriesOf(…, "weight"))` | AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.8, AC-001.9 (refuerzo del cálculo) |
| `latestWithDelta(seriesOf(…, "body_fat_percentage"))` | AC-002.1, AC-002.2, AC-002.3 (refuerzo) |
| `rateIndicator(series, "2026-10-12")` | AC-003.1, AC-003.3 a AC-003.8, AC-003.10 a AC-003.13: comprueba `kind` y `kgPerWeek` redondeado a 1 decimal |
| `paceStatusFromPercent(pct, goal)` y `ratePercent` | AC-004.1, AC-004.2, AC-004.3, AC-004.4 (con -0,5/78,5), AC-004.5, AC-004.6, AC-004.7, AC-004.8, AC-004.9 (cada límite de la tabla, en las 5 metas), AC-004.12 |
| `trendChartData(metrics, "weight", from, toDisplayWeight)` | AC-005.1 (`from = "2026-09-12"`), AC-005.2, AC-005.3, AC-005.4 (`toDisplayWeight` en lb), AC-005.5; `field = "body_fat_percentage"`: sin `trend` (refuerzo de AC-005.6) |
| `periodStart` | Refuerzo de REQ-005: `periodStart("2026-10-12", 1) === "2026-09-12"`, con 3 y 12 meses, y el ajuste a fin de mes |
| `composition(metrics, heightCm)` | AC-006.1, AC-006.2, AC-006.4 (`heightCm = 175,26`), AC-006.5, AC-006.6, AC-007.1, AC-007.2, AC-007.3, AC-007.4; `heightCm = null` da `bmi` y `ffmi` a `null` (refuerzo de AC-010.1) |
| `streak(metrics, today)` | AC-008.1 a AC-008.6 (AC-008.5 con `today = "2026-10-18"`), AC-009.1, AC-009.3, AC-009.4 (`last30` y `lastDate`) |

Puede añadirse `heightCmFromAnswers` en un `units.test.ts` junto a `onboarding/units.ts`, como refuerzo de AC-006.4 y AC-007.3: ft/in da 175,26, y un valor vacío da `null`.

### 5.2 RTL de página: `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx` (se amplía)

- Va en un `describe("BodyMetricsPage - indicadores (spec 009)")` nuevo.
- Reutiliza `renderPage`, `metric(...)`, `kpi(label)` y `makeProfileResponse`. El gráfico sigue sustituido por el stub.
- Para "Composición corporal" y "Constancia" conviene un helper `stat(label)` análogo a `kpi`, que acote al contenedor del `Stat`.
- Para AC-008.5, `vi.setSystemTime(new Date(2026, 9, 18, 12))`.

| Escenario | AC |
|---|---|
| Textos de la tarjeta "Peso" | AC-001.1, AC-001.4, AC-001.5 (lb: "173,1 lb" y "-3,3 lb en 30 días"), AC-001.6, AC-001.7, AC-001.8, AC-001.9 |
| Textos de la tarjeta "% Grasa" | AC-002.1, AC-002.3, AC-002.4, AC-002.5 (lb) |
| Tarjeta "Ritmo" | AC-003.1, AC-003.2 (lb), AC-003.4, AC-003.5, AC-003.9 (medición del 2026-10-12 solo con grasa), AC-003.10, AC-003.13, AC-003.14 |
| Estado de meta | AC-004.1, AC-004.2, AC-004.3, AC-004.4: "Fuera del rango de tu meta" con `data-tone="warn"`, el mismo valor que el estado de AC-004.2, y sin "Más rápido…" ni "Más lento…" |
| Estado de meta (continuación) | AC-004.5, AC-004.10, AC-004.13 |
| Composición | AC-006.1 (con `formatDate("2026-10-05")`), AC-006.2, AC-006.3 (lb), AC-006.4 (perfil `height_unit: "ft", height_ft: 5, height_in: 9`), AC-006.5, AC-006.6 |
| IMC | AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5 |
| Constancia | AC-008.1 a AC-008.6, AC-009.1 a AC-009.5: "1 registro" y que no aparece "1 registros" |
| Perfil no disponible | AC-010.1 (`getProfile` rechaza con `ApiError`: kg, "—" en IMC y FFMI y ningún "∞", "NaN" ni "0" en esos `Stat`), AC-010.2, AC-004.11 (ni estado de meta ni "Faltan registros…"), AC-010.3 (`getProfile` devuelve una promesa que se resuelve a mano después del primer render: antes kg y "—", después lb y el IMC con valor) |

### 5.3 RTL del gráfico: `frontend/src/features/body-metrics/components/TrendChart.test.tsx` (nuevo)

- **AC-005.6.** Renderiza `TrendChart` con mediciones de peso y grasa recientes. Con "Peso" seleccionado aparecen "Registro" y "Tendencia (7 días)". Tras pulsar "% Grasa" (`UnitToggle`), "Tendencia (7 días)" ya no aparece.
- Recharts necesita `ResizeObserver`, que jsdom no tiene. Se define en el propio test un stub escrito a mano (`class { observe() {} unobserve() {} disconnect() {} }` asignado a `globalThis.ResizeObserver`), sin librerías de mocks.
- Los valores de los puntos no se comprueban en el DOM del SVG. Se cubren con `trendChartData` (§5.1).

### 5.4 Tests existentes

En `BodyMetricsPage.test.tsx`, los tests con marcador `REQ-012 AC-012.3` (spec 006) usan mediciones hasta el 2026-10-11 y el reloj real. Con Q6, a partir del 2026-11-09 mostrarían "Sin registros recientes" y fallarían. El test-author debe añadir en el `describe` raíz, o en un `beforeEach` de nivel de archivo, el reloj fijo al 2026-10-12 12:00 con `toFake: ["Date"]`. No es debilitar ningún test: es hacerlos deterministas. No se borra ni se cambia ninguna aserción. `dateUtils.test.ts` sigue igual y debe seguir en verde con la nueva `isWithinLastMonths`.

### 5.5 Fakes nuevos

Ninguno compartido. Solo el stub de `ResizeObserver` local de `TrendChart.test.tsx` y las mediciones construidas con el helper `metric()` de cada archivo.

### 5.6 Andamiaje (ADR-0012) y red check

Las funciones nuevas que lanzan `Error("not implemented")` en el scaffold son `rateIndicator`, `ratePercent`, `paceStatusFromPercent`, `trendChartData`, `periodStart` y `heightCmFromAnswers`. Los tipos `RateIndicator` y `ChartPoint` y el valor `"off_range"` de `PaceStatus` se añaden ya en el scaffold. La página y el gráfico **no** se cambian en el scaffold, así que los tests existentes siguen en verde.

Varios AC describen comportamiento que ya existe: por ejemplo AC-001.1, AC-002.1, AC-006.1, AC-008.1 y AC-009.1 en la página. Sus tests RTL pasarán desde el principio (caracterización). Fallarán por comportamiento ausente:
- los unitarios de las funciones nuevas;
- en la página, AC-003.10, AC-003.13, AC-003.14, AC-004.4, AC-004.13, AC-009.2, AC-009.5, AC-010.1 y AC-010.3;
- en el gráfico, AC-005.1 (vía `trendChartData`).

El usuario tendrá que aceptar el FAIL parcial del red check por los tests de caracterización (`docs/sdd/GUIA-DE-USO.md`, limitación de los refactors).

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Los tests que dependen del reloj real (los REQ-012 existentes y los nuevos de "hoy") empiezan a fallar con el paso del tiempo por Q6 y la ventana de 30 días | Alta sin mitigación | Medio: CI en rojo en noviembre | Reloj fijo con `vi.useFakeTimers({ toFake: ["Date"] })` en todo `BodyMetricsPage.test.tsx` (§5.4). Las funciones puras reciben `today` |
| Red check en FAIL parcial porque muchos AC ya se cumplen (caracterización) | Alta | Bajo: fricción en el gate de tests | Se avisa en §5.6. Las reglas se prueban sobre todo con las funciones nuevas del scaffold, que sí dan rojo legítimo. El usuario acepta el FAIL de la parte de caracterización |
| Comparaciones en coma flotante en los límites del ritmo (AC-004.9) y días no enteros con cambio de horario o husos distintos | Media | Medio: un límite que da "fuera" o una ventana con un día de más o de menos | Tolerancia `EPS = 1e-9` en `paceStatusFromPercent` y días como enteros con `Date.UTC` (`dayNumber`) en todas las ventanas |
| `periodStart` con fin de mes (31 menos 1 mes) y el límite inferior inclusivo cambian levemente qué puntos se dibujan frente al comportamiento actual | Baja | Bajo | Se ajusta al último día del mes y se compara por fecha ISO, de acuerdo con REQ-005 ("desde la misma fecha"). Se cubre con un test de `periodStart` |
| Recharts en jsdom (`ResizeObserver`, tamaño 0) hace frágil el test de la leyenda | Media | Bajo | Stub local de `ResizeObserver`. Solo se comprueba la leyenda (DOM fuera del SVG); los valores se prueban en la función pura |

## 7. Cumplimiento de la constitución

- **Art. 1:** el cambio de comportamiento (Q4, Q5, Q6 y la tendencia) pasa por spec aprobada. El plan no amplía el alcance: no toca `macros/calculations.ts`, el análisis del coach, el % de masa muscular, el diseño del gráfico ni el periodo por defecto.
- **Art. 4:** los 10 REQ están mapeados en §4, y cada AC tiene un test previsto en §5 con el marcador `// SDD: REQ-0NN AC-0NN.M`. Los marcadores `REQ-012` existentes son de la spec 006 y no se cambian (nota de la spec §1).
- **Art. 5:** TDD con scaffold (§5.6). Tests junto al archivo que prueban, `globals: false` con imports de `vitest`, red simulada en `api.ts` con `vi.mock`, nombres `it("…")` en español y ningún test existente debilitado (§5.4). El stub de `ResizeObserver` es un fake escrito a mano.
- **Art. 6.6 a 6.10:** organización por feature (`body-metrics`). Sin llamadas HTTP nuevas. Se reutilizan las queries `bodyMetricsKeys.list` y `profileKeys.detail`. No hay formularios ni componentes de UI reutilizables nuevos. Deben pasar `npm run lint`, `npx tsc -b` y `npm run build`.
- **Art. 6.1 a 6.5:** no aplican (no se toca el backend).
- **Art. 6.11:** el texto nuevo, "Fuera del rango de tu meta", y la corrección de "1 registro" están en español correcto y sin voseo.
- **Art. 7:** no hay endpoints, secretos ni entrada externa nuevos. Los datos del servidor ya están tipados.
- **"DEBERÍA" no cumplidos:** ninguno.

## 8. ADRs

Ninguna. Los indicadores siguen calculándose en el frontend, que es la situación actual y la spec deja fuera de alcance moverlos al servidor. No se introduce ninguna decisión de arquitectura nueva.
