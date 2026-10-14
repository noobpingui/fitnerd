# Plan 011 — Ritmo poco realista por una medición errónea sin bloquear el análisis con IA

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-14)

## 1. Resumen de la solución

Se añade un séptimo código de estado del ritmo, **`unrealistic`**, que conoce tanto el frontend como el servidor y extiende el contrato de la spec 010 (ADR-0021) sin cambiarlo de forma:

- **Frontend.** `buildInsights` marca el ritmo como `unrealistic` cuando |ritmo| > 2 % del peso de la última medición por semana. Además elige la **medición sospechosa** (la más alejada de la mediana dentro de la ventana de 28 días; en empate, la más reciente). Con eso:
  - `formatInsights` pinta "Revisa tus mediciones" en la tarjeta "Ritmo" y genera el texto del aviso;
  - `ProgressAnalysis` muestra el aviso;
  - `MetricsHistory` marca la fila con "Revisa este peso";
  - `buildAnalysisRequest` envía `pace_status: "unrealistic"` junto con el ritmo y el peso.
- **Backend.** `parse_analysis_request` acepta `unrealistic` con cualquier ritmo numérico y finito. Si recibe un estado frente a la meta con un ritmo de más del 2 % (y hasta 10 kg/sem), lo **normaliza** a `unrealistic`. `suggest_calories` ya devuelve `None` para cualquier estado sin ritmo válido, y el mensaje al modelo lleva el estado "Revisa tus mediciones" y el texto fijo de REQ-004. El mensaje del 400 cambia.

No hay cambios de modelo ni migración.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios de esquema. |
| backend · repositories | — | — | Sin cambios. |
| backend · services | — | `backend/services/calorie_suggestion.py`, `backend/services/progress_analysis_context.py`, `backend/services/progress_analysis_service.py` | Umbral del 2 % (`is_unrealistic_rate`); validación y normalización de `unrealistic`, etiqueta y texto del bloque de ajuste, nuevo mensaje del 400; nuevas reglas del system prompt. |
| backend · routes | — | — | `body_metric_routes.analyze()` no cambia: ya serializa `calorie_suggestion: null`. |
| backend · tests | — | `backend/tests/test_services/test_calorie_suggestion.py`, `backend/tests/test_services/test_progress_analysis_service.py`, `backend/tests/test_routes/test_progress_analysis_routes.py` | Casos nuevos (sección 5); la constante `INVALID_MESSAGE` de los dos últimos pasa al mensaje nuevo, que es lo que exige REQ-007. |
| frontend · features/body-metrics | — | `insights.ts`, `insightsView.ts`, `analysisRequest.ts` (sin cambios de lógica, ver 3.4), `types.ts`, `schemas.ts`, `components/ProgressAnalysis.tsx`, `components/MetricsHistory.tsx`, `pages/BodyMetricsPage.tsx` (+ sus tests) | Detección, mediana y medición sospechosa; estado y aviso; marca en el Historial; enum zod. |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

No aplica. No se guarda nada nuevo y los datos existentes no se tocan. Las reglas se aplican al calcular.

### 3.2 Contratos de API

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `/api/body-metrics/analysis` | `@require_auth` (sin cambios) | `AnalysisRequest` de la spec 010, con `indicators.pace_status` ampliado a `unrealistic` (abajo) | 200 `{"analysis": str, "calorie_suggestion": CalorieSuggestion \| null}` (con `unrealistic`, siempre `null`) | 401; 409 sin perfil (va antes que el 400, sin cambios); **400** `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}`; 429 y 503 sin cambios |

**Cómo marca el cliente un ritmo poco realista:** `indicators.pace_status = "unrealistic"`. `rate` lleva el texto de la tarjeta (por ejemplo, "+12,6 kg/sem") y se envían `rate_kg_per_week` y `latest_weight_kg` como con cualquier otro estado con ritmo.

Reglas de validación que cambian (el resto, las de la spec 010, se mantienen; el primer error gana):

| `pace_status` | `rate_kg_per_week` | `latest_weight_kg` | Resultado |
|---|---|---|---|
| `unrealistic` | número finito (no bool), **sin rango** | número finito en [20, 400] | Se acepta y el estado queda `unrealistic`. |
| `on_track`, `too_slow`, `too_fast`, `off_range` | número finito en [-10, 10] | número finito en [20, 400] | Se acepta. Si `is_unrealistic_rate(rate, latest)`, el estado se **normaliza** a `unrealistic` (REQ-006, segundo párrafo). |
| ídem | fuera de [-10, 10], o no es un número | — | 400 (REQ-007) |
| `insufficient`, `stale` | `null` | `null` | Sin cambios. |
| otro valor | — | — | 400 |

`NaN` e `Infinity` (que `json.loads` acepta) no son números finitos, así que también dan 400.

### 3.3 Lógica de negocio

**`backend/services/calorie_suggestion.py`**

- `UNREALISTIC_RATE_PCT = 2.0` y `RATE_EPS = 1e-9`.
- `is_unrealistic_rate(rate_kg_per_week: float, latest_weight_kg: float) -> bool`: `abs(rate / latest * 100) > UNREALISTIC_RATE_PCT + RATE_EPS`. Con la tolerancia, exactamente el 2 % (1,6 con 80 kg, AC-006.3) **no** es poco realista, aunque haya errores de coma flotante.
- `suggest_calories` **no cambia**. `unrealistic` no está en `PACE_STATUSES_WITH_RATE`, así que devuelve `None`.

**`backend/services/progress_analysis_context.py`**

- `INVALID_ANALYSIS_REQUEST_MESSAGE = "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."`
- `UNREALISTIC = "unrealistic"`. `PACE_STATUSES` incluye `unrealistic`; `PACE_STATUSES_WITH_RATE` **no** lo incluye, porque esa tupla significa "estado frente a la meta" y se sigue usando así en la validación.
- `PACE_LABELS["unrealistic"] = "Revisa tus mediciones"`.
- `UNREALISTIC_SUGGESTION_TEXT = "No se sugiere un ajuste de calorías: el ritmo no es realista y probablemente alguna medición de peso es errónea."`
- `parse_analysis_request`: la rama de ritmo pasa a ser:
  1. si `pace_status == UNREALISTIC`: `_is_number(rate)` y `_is_number(latest)` con `20 <= latest <= 400`; si no, 400;
  2. si no, si está en `PACE_STATUSES_WITH_RATE`: las comprobaciones de rango actuales (400 si fallan); después, si `is_unrealistic_rate(rate, latest)`, `pace_status = UNREALISTIC`;
  3. si no, `rate` y `latest` deben ser `null`, como hoy.

  El `AnalysisRequest` devuelto lleva el `pace_status` ya normalizado, así que el resto del servicio no distingue entre "marcado por el cliente" y "normalizado por el servidor".
- `build_user_message`:
  - la línea del ritmo escribe el texto de `rate` cuando el estado es de meta **o** `unrealistic`: "Ritmo semanal: +12,6 kg/sem (Revisa tus mediciones)";
  - `_suggestion_block(suggestion, pace_status)` devuelve `UNREALISTIC_SUGGESTION_TEXT` cuando `pace_status == UNREALISTIC`; los demás casos no cambian. Con `unrealistic`, la sugerencia siempre es `None`, así que no aparece "Ajuste:", "Calorías sugeridas" ni "mantener … kcal".

**`backend/services/progress_analysis_service.py`**

- Al `PROGRESS_ANALYSIS_SYSTEM_PROMPT` se añaden, en "Reglas de contenido", estas tres frases literales, en las que se apoyan los tests (AC-005.1):
  - "Si el estado del ritmo es \"Revisa tus mediciones\", no interpretes ese ritmo ni el cambio de peso asociado como un progreso real."
  - "En ese caso, explica que alguna medición de peso parece errónea y recomienda revisarla en el Historial para corregirla o borrarla."
  - "En ese caso, no propongas ninguna cifra de calorías."

  Se conservan sin cambios las frases de la spec 010: sin dietas, alimentos ni rutinas, y español neutro sin voseo (AC-005.2).
- `analyze()` **no cambia de orden**: perfil (409) → mediciones (200 sin datos) → `parse_analysis_request` (400, no cuenta) → límite (429) → fila y `commit` → modelo. Un ritmo `unrealistic` válido cuenta contra el límite como cualquier otro (AC-004.3).
- Dependencias inyectadas: las mismas de la spec 010 (`body_metric_repository`, `progress_analysis_repository`, `user_repository`, `user_profile_repository`, `unit_of_work`, `llm_client`, `clock`). No hay nuevas.

### 3.4 Frontend

**`features/body-metrics/insights.ts`** (puro):

- `export const UNREALISTIC_RATE_PCT = 2`.
- `export function rateWindow(weightSeries: SeriesPoint[]): SeriesPoint[]` devuelve los puntos a ≤ 28 días de la última medición de peso, incluida esta. Se extrae de `rateIndicator`, que pasa a usarla sin cambiar su comportamiento.
- `export function isUnrealisticRate(kgPerWeek: number, latestKg: number): boolean` calcula `Math.abs(ratePercent(kgPerWeek, latestKg)) > UNREALISTIC_RATE_PCT + EPS` (reutiliza `EPS = 1e-9`).
- `export function median(values: number[]): number`: con un número par de valores, la media de los dos centrales.
- `export function suspiciousPoint(window: SeriesPoint[]): SeriesPoint | null`:
  - `null` si la ventana está vacía;
  - si no, calcula `m = median(...)` y `maxDev = max(|v - m|)` y devuelve el **último** punto (la ventana va en orden cronológico) con `|v - m| >= maxDev - EPS`. Así, en un empate gana el más reciente.

**`features/body-metrics/types.ts`**: `PaceStatusCode` añade `"unrealistic"`.

**`features/body-metrics/insightsView.ts`**:

- `buildInsights`: con `rate.kind === "ok"`, si `isUnrealisticRate(rate.kgPerWeek, rate.latestKg)`, entonces `paceStatus = "unrealistic"`. La comprobación va **antes** de la de la meta, así que no depende del perfil, y después de `stale`/`insufficient`, por el orden de REQ-001.
  - Devuelve el campo nuevo `suspiciousDate: string | null`: `suspiciousPoint(rateWindow(weight))?.date` si el estado es `unrealistic`, y `null` en cualquier otro caso.
- `formatInsights`:
  - `UNREALISTIC_COPY = { label: "Revisa tus mediciones", tone: "warn" }`. Con `status === "unrealistic"`, `statusLabel` y `tone` salen de ahí. `rate` sigue siendo el texto con signo de siempre (REQ-002).
  - Campo nuevo `paceWarning: string | null`: si el estado es `unrealistic` y hay `suspiciousDate`, vale `` `Tu ritmo de las últimas 4 semanas (${rate}) no es realista: puede que la medición del ${formatDate(suspiciousDate)} esté mal. Revísala en el Historial y corrígela o bórrala para recibir una sugerencia de calorías.` ``. En cualquier otro caso, `null`.
  - `formatDate` se importa de `dateUtils.ts`, la misma función que usa el Historial (Q8).
  - `InsightsInput` admite objetos parciales: `suspiciousDate` se lee con `?? null`.

**`features/body-metrics/analysisRequest.ts`**: no necesita cambios de lógica. `pace_status` toma `insights.paceStatus`, que ya puede ser `"unrealistic"`. `hasRate` sigue siendo cierto con `rate.kind === "ok"`, así que se envían `rate_kg_per_week` y `latest_weight_kg`. El tipo se amplía por `types.ts`.

**`features/body-metrics/schemas.ts`**: el `z.enum` de `pace_status` en `analysisRequestSchema` añade `"unrealistic"`. Sin esto, `analyzeBodyMetrics` lanzaría un `ZodError` antes de llamar a la red.

**`features/body-metrics/components/ProgressAnalysis.tsx`**:

- Nueva prop opcional `warning?: string | null`.
- Si no es `null`, pinta **encima del botón**, siempre (antes, durante y después del análisis), un `<p data-tone="warn" className="… text-amber-500">` con `CircleAlert` (`aria-hidden`) y el texto.
- El botón no se deshabilita (AC-003.1). Las ramas de error no cambian: el 400 se pinta como hoy, con el mensaje que manda el servidor.

**`features/body-metrics/components/MetricsHistory.tsx`**:

- Nueva prop opcional `suspiciousDate?: string | null`.
- En la fila (no en la de edición) con `metric.recorded_at === suspiciousDate && metric.weight !== null`, junto al peso y dentro de la misma celda, va `<span data-tone="warn" className="… text-amber-500">` con `CircleAlert` (`aria-hidden`) y "Revisa este peso".
- Los botones "Corregir medición del …" y "Borrar medición del …" no cambian.
- La elección se hace por fecha, que es única por usuario y día (ADR-0020), y no depende de la unidad.
- No se toca `visibleCount` (no se despliega "Mostrar más").

**`features/body-metrics/pages/BodyMetricsPage.tsx`**:

- `<ProgressAnalysis request={analysisRequest} warning={view.paceWarning} />`.
- `<MetricsHistory … suspiciousDate={insights.suspiciousDate} />`.
- `KpiTile` ya pinta `tone: "warn"` con icono y `data-tone`, así que no cambia.
- La recuperación (REQ-008) es automática: corregir o borrar invalida la query `bodyMetrics` (spec 008), `useMemo` recalcula `insights` y desaparecen el estado, el aviso y la marca.

**Hooks y claves de query:** sin cambios (`useBodyMetrics`, `useAnalyzeBodyMetrics` y las invalidaciones de la spec 008).

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `insights.isUnrealisticRate` + `buildInsights` (orden: `stale`/`insufficient` → `unrealistic` → meta); `UNREALISTIC_RATE_PCT` con `EPS` (el 2 % exacto no cuenta) |
| REQ-002 | `formatInsights` (`UNREALISTIC_COPY`, `rate` sin cambios) + `KpiTile` con `tone: "warn"` |
| REQ-003 | `formatInsights.paceWarning` (texto con `rate` y `formatDate(suspiciousDate)`) + `ProgressAnalysis` prop `warning`, pintada fuera de las ramas de `data`/`isError` |
| REQ-004 | Frontend: `buildAnalysisRequest` envía `pace_status: "unrealistic"`; el enum zod lo acepta; `ProgressAnalysis` no pinta el bloque si `calorie_suggestion` es `null`. Backend: `parse_analysis_request` acepta `unrealistic`; `suggest_calories` → `None`; `build_user_message` (etiqueta "Revisa tus mediciones" y `UNREALISTIC_SUGGESTION_TEXT`); el orden de `analyze()` hace que el intento cuente |
| REQ-005 | `PROGRESS_ANALYSIS_SYSTEM_PROMPT`: tres frases nuevas (3.3) sin quitar las de la spec 010 |
| REQ-006 | `parse_analysis_request`: rama `unrealistic` sin rango de ritmo; normalización a `unrealistic` con `calorie_suggestion.is_unrealistic_rate` para los estados de meta |
| REQ-007 | `INVALID_ANALYSIS_REQUEST_MESSAGE` nuevo; `_is_number` en las dos ramas; rango [-10, 10] solo para estados de meta; la validación va después del 409 y antes del límite; `ProgressAnalysis` muestra el mensaje del servidor |
| REQ-008 | Invalidación de `bodyMetrics` (spec 008) → `useMemo` recalcula `buildInsights`/`formatInsights`/`buildAnalysisRequest`; el servidor calcula la sugerencia con el estado normal |
| REQ-009 | `insights.rateWindow` + `median` + `suspiciousPoint` → `buildInsights.suspiciousDate` (solo con `unrealistic`) → `MetricsHistory` prop `suspiciousDate` (marca "Revisa este peso", `data-tone="warn"`) |
| NFR-001 (spec 010) | Sin cambios: el mensaje solo añade la etiqueta y el texto fijo; no entra ningún dato personal nuevo. Los textos del cliente siguen pasando por la lista blanca y el tope de 32 caracteres |
| NFR-002 (spec 010) | Sin cambios: perfil, usuario e historial se leen con el `user_id` del token |

## 5. Estrategia de pruebas

Fixtures comunes (las de la spec): "salto arriba", "salto abajo", "límite", "justo encima" y "empate", con hoy = 2026-10-12. En el frontend, las fechas esperadas del aviso se calculan con `formatDate("2026-10-11")`, sin escribir el texto a mano, porque `toLocaleDateString("es-CR")` puede variar entre entornos.

**Fakes:** no hacen falta fakes nuevos. Se reutilizan `FakeBodyMetricRepository`, `FakeUserProfileRepository`, `FakeUserRepository`, `FakeUnitOfWork`, `FakeLLMClient`, `FakeClock` y el `FakeProgressAnalysisRepository` local, con el helper `make_body(...)` existente. Sin `unittest.mock` ni `monkeypatch`.

**Ajuste obligado de tests existentes:** en `test_progress_analysis_service.py` y `test_progress_analysis_routes.py`, la constante `INVALID_MESSAGE` pasa a "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo.". No es debilitar los tests: es el cambio que exige REQ-007 (Q4). Las aserciones se mantienen.

**Backend unitario: `test_calorie_suggestion.py`** (funciones puras)

- `is_unrealistic_rate`:
  - (12.6, 98) → `True`;
  - (-12.6, 80) → `True`;
  - (2.0, 100) → `False`;
  - (2.1, 100.2) → `True`;
  - (1.6, 80) → `False`;
  - (-0.5, 79.4) → `False`.

  Cubre la parte de servidor de AC-001.x y AC-006.3.
- `suggest_calories("unrealistic", 12.6, 98, "lose", "male", 2200) is None`.

**Backend unitario: `test_progress_analysis_service.py`** (con fakes; se lee el mensaje de `FakeLLMClient.calls[0]`)

- AC-004.1 / AC-004.2 / AC-006.4: cuerpo `unrealistic`, `rate` "+12,6 kg/sem", 12.6, 98.
  - `result.calorie_suggestion is None`.
  - El mensaje contiene "Ritmo semanal: +12,6 kg/sem (Revisa tus mediciones)" y `UNREALISTIC_SUGGESTION_TEXT`.
  - No contiene "Ajuste:", "Calorías sugeridas" ni "mantener".
- AC-004.3: el mismo caso deja `created` con longitud 1 y `uow` con un commit. Con `count_since_value=2` → `RateLimitError`.
- AC-004.4: `unrealistic` con -12.6 y 80 → `None` y "Revisa tus mediciones".
- AC-005.1: el system prompt contiene las tres frases nuevas literales.
- AC-005.2: sigue conteniendo "No recetes dietas, alimentos concretos ni rutinas de ejercicio." y "Responde en español neutro, sin voseo ni regionalismos" y ninguna forma de voseo.
- AC-006.1: `too_fast`, +5, 80 → `None`; el mensaje lleva "Revisa tus mediciones" y no lleva "Ajuste:" ni "Más rápido que tu meta".
- AC-006.2: `on_track`, +5, 80 → `None`; sin "mantener".
- AC-006.3: `too_fast`, +1.6, 80 → `calorie_suggestion` no es `None` (igual que en la spec 010) y el mensaje no lleva "Revisa tus mediciones".
- AC-006.5: `unrealistic`, -45, 80 → `None`, sin excepción.
- AC-006.6: `unrealistic`, -0.5, 80 → `None` y "Revisa tus mediciones" (se respeta la marca).
- AC-007.1: `too_fast` con +12.6 → `ValidationError` con el mensaje nuevo; `llm.calls == []` y `created == []`.
- AC-007.2: `rate_kg_per_week = "rápido"` con `too_slow` → `ValidationError` con el mensaje nuevo.
- AC-007.3: `unrealistic` con `rate_kg_per_week` `"x"` (y otro caso con `None`) → `ValidationError`, sin llamada.
- AC-007.4: sin perfil y cuerpo `{"indicators": 1}` → `ConflictError` con el mensaje de perfil.
- AC-008.3: mediciones corregidas (80, 80 y 79,5 kg) con cuerpo `too_slow`, -0.35, 79.5 → `calorie_suggestion` no es `None`.
- Extra (Art. 7.3): `unrealistic` con `latest_weight_kg` fuera de [20, 400] → `ValidationError`.

**Backend integración: `test_progress_analysis_routes.py`** (Postgres; ningún caso llega al modelo)

- AC-006.4 / AC-007.6: con perfil, una medición, **dos análisis sembrados** y un cuerpo `unrealistic` (+12,6, 98) → **429**, no 400. Prueba que el servidor lo acepta sin llamar a Anthropic.
- AC-006.5: lo mismo con -45 → 429.
- AC-007.1: `too_fast` con +12,6 → 400 con `{"error": "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."}` y `analysis_rows == 0`.
- AC-007.2: ritmo `"x"` con `too_slow` → 400 con ese mensaje.
- AC-007.3: `unrealistic` con ritmo `"x"` → 400 y ninguna fila.
- AC-007.4: sin perfil y cuerpo mal formado → 409 con el mensaje de perfil.
- El test existente del 400 por estado desconocido se mantiene con el mensaje nuevo.

**Frontend unitario: `insights.test.ts`** (puros)

- AC-001.1 / AC-001.2 / AC-001.4: `isUnrealisticRate` es `true` con "salto arriba", "salto abajo" y "justo encima" (calculado con `rateIndicator` sobre la serie).
- AC-001.3: es `false` con "límite".
- AC-001.6: es `false` con "en ritmo".
- `median([80, 80, 98, 98]) === 89` y `median([80, 80, 98]) === 80`.
- AC-009.1 / AC-009.2 / AC-009.3: `suspiciousPoint` devuelve 2026-10-11, 2026-10-01 y 2026-10-11 (empate).
- AC-009.4: `rateWindow` excluye el punto del 2026-09-01.
- La regresión de `rateIndicator` la cubren los tests existentes, sin cambios.

**Frontend unitario: `insightsView.test.ts` y `analysisRequest.test.ts`**

- AC-001.1, AC-001.2 y AC-001.4: `buildInsights(...).paceStatus === "unrealistic"`.
- AC-001.3: "límite" → `too_slow`.
- AC-001.5: "Sin registros recientes" → `stale` y `suspiciousDate === null`.
- AC-001.6: `on_track`.
- AC-002.1: `formatInsights` → `rate` "+12,6 kg/sem", `statusLabel` "Revisa tus mediciones" y `tone` "warn".
- AC-002.2: en lb → "-27,8 lb/sem".
- AC-003.1: `paceWarning` contiene "(+12,6 kg/sem)" y `formatDate("2026-10-11")`.
- AC-003.2: en lb, "(-27,8 lb/sem)" y `formatDate("2026-10-01")`.
- AC-003.4: con "límite", `paceWarning === null`.
- AC-003.5: con "empate", la fecha del 2026-10-11.
- AC-003.6: con el 120 kg del 2026-09-01, la fecha del 2026-10-11.
- AC-004.2 (cliente): `buildAnalysisRequest` con "salto arriba" → `pace_status` `"unrealistic"`, `rate` "+12,6 kg/sem", `rate_kg_per_week` ≈ 12,6 y `latest_weight_kg` 98. El cuerpo pasa `analysisRequestSchema.parse` (`schemas.test.ts`).

**Frontend RTL: `ProgressAnalysis.test.tsx`** (`analyzeBodyMetrics` mockeado en `api.ts`)

- AC-003.1: con `warning` se ve el aviso y el botón está habilitado.
- AC-003.3: tras resolver el análisis, el aviso sigue visible junto al texto.
- AC-004.1: respuesta con `calorie_suggestion: null` → texto visible, sin "Ajuste de calorías sugerido" y sin texto de error.
- AC-007.5: rechazo `ApiError(400, "No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo.")` → el mensaje visible (búsqueda por subcadena, porque lleva el prefijo "Error (400):") y "Los datos del análisis no son válidos." ausente.

  **Aviso para el verifier:** este AC lo garantiza el servidor. Este test es una guarda de regresión y puede pasar desde el principio. El rojo legítimo de REQ-007 está en los tests del backend.
- Sin `warning`, no se pinta ningún `data-tone="warn"`.

**Frontend RTL: `MetricsHistory.test.tsx`**

- AC-009.1: la fila del 2026-10-11 contiene "Revisa este peso" con `data-tone="warn"`; las otras no.
- AC-009.5: la fila sin peso del 2026-10-09 no la lleva aunque `suspiciousDate` apunte a otra.
- AC-009.8: con `weightUnit` "lb", la fila del 2026-10-11 la lleva.
- AC-009.9: la fila marcada conserva "Corregir medición del …" y "Borrar medición del …".
- Con `suspiciousDate` `null`, ninguna marca.

**Frontend de página: `BodyMetricsPage.test.tsx`** (con `ProgressAnalysis` sustituido por un stub)

- AC-002.1: `kpi("Ritmo")` muestra "+12,6 kg/sem" y "Revisa tus mediciones" con `data-tone="warn"`, sin ninguno de los cuatro estados de meta.
- AC-002.2: en lb, "-27,8 lb/sem".
- AC-002.3: con "límite", "+2 kg/sem" y "Más lento que tu meta".
- AC-009.1 a AC-009.7 a nivel de página: la marca en la fila correcta (y en ninguna con "límite" o con "Sin registros recientes").
- AC-008.1: corregir la del 2026-10-11 a 79,5 (`updateMock` resuelve; `listMock` devuelve después las mediciones corregidas) → sin "Revisa tus mediciones" ni "Revisa este peso".
- AC-008.2: borrarla → "—", "Faltan registros para calcularlo" y ninguna marca.

**Frontend de página: `BodyMetricsPage.analysis.test.tsx`** (sin stub de `ProgressAnalysis`)

- AC-003.1: con "salto arriba", el aviso es visible con "(+12,6 kg/sem)" y `formatDate("2026-10-11")`, y el botón está habilitado.
- AC-003.2: en lb, "(-27,8 lb/sem)" y `formatDate("2026-10-01")`.
- AC-003.4: con "límite", sin aviso.
- AC-003.5: con "empate", la fecha del 2026-10-11.
- AC-003.6: con el 120 kg del 2026-09-01, la fecha del 2026-10-11.
- AC-004.1 / AC-004.4 / AC-007.6 (cliente): el clic llama a `analyzeBodyMetrics` con `pace_status: "unrealistic"`. Como el mock resuelve con `calorie_suggestion: null`, se ve el texto y no se ven "Ajuste de calorías sugerido" ni el error.
- AC-008.1 (aviso): tras corregir, el aviso desaparece.
- AC-008.3 (cliente): tras corregir, el clic envía `pace_status: "too_slow"`. Si el mock devuelve una sugerencia, se ve "Ajuste de calorías sugerido".

**Regresión:** siguen pasando sin cambios `insights.test.ts`, `insightsView.test.ts`, `analysisRequest.test.ts`, `CalorieSuggestionBlock.test.tsx`, el resto de `BodyMetricsPage*.test.tsx`, `test_calorie_suggestion.py` y el resto de los tests del servicio. Todos sus ritmos están por debajo del 2 % semanal.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El cliente y el servidor discrepan en el borde del 2 % por la coma flotante (p. ej. 1,6/80 da 2,0000000000000004) | Media | Medio: el servidor quitaría una sugerencia que el cliente muestra como normal | El mismo umbral y la misma tolerancia (`EPS = 1e-9` sobre el porcentaje) en `isUnrealisticRate` y `is_unrealistic_rate`, con tests explícitos de 2 % exacto (AC-001.3, AC-006.3). |
| Una pestaña abierta antes del despliegue envía `too_fast` con +12,6 | Baja | Bajo | Recibe el 400 con el mensaje nuevo, que dice que recargue (REQ-007, Q4). Al recargar, envía `unrealistic`. |
| Los tests de página no encuentran la fecha por diferencias de `toLocaleDateString` entre entornos | Media | Bajo | La fecha esperada se calcula con `formatDate` en el test, no se escribe a mano. |
| `unrealistic` sin límite de ritmo abre la puerta a inyectar números enormes | Baja | Bajo | Solo se aceptan números finitos; el texto `rate` sigue limitado por la lista blanca y los 32 caracteres; el valor numérico no llega al modelo (solo el texto) ni se usa en ningún cálculo, porque la sugerencia es `None`. El límite de 2 análisis cada 24 horas sigue vigente. |
| La marca del Historial apunta a una fila oculta tras "Mostrar más" | Baja (la ventana es de 28 días y se ven 10 filas) | Bajo | Aceptado por la spec (fuera de alcance). El aviso del coach incluye la fecha. |

## 7. Cumplimiento de la constitución

- **Art. 4:** cada AC tiene un test asignado en la sección 5, que llevará el marcador `SDD:`.
- **Art. 5:**
  - TDD.
  - Backend con fakes escritos a mano e inyectados por constructor, sin `unittest.mock` ni `monkeypatch`.
  - En el frontend, la red se simula en `api.ts` con `vi.mock`, como hoy.
  - Ningún test de rutas llega a Anthropic (los casos `unrealistic` válidos se prueban con la cuota agotada → 429).
  - El cambio de `INVALID_MESSAGE` en dos tests existentes lo exige la spec (REQ-007) y no debilita ninguna aserción.
- **Art. 6.1-6.3:** la ruta no cambia; la lógica está en `services/`; los errores son `ValidationError`, `ConflictError` y `RateLimitError`; solo `UnitOfWork` hace commit.
- **Art. 6.4:** sin cambios de modelo, así que no hace falta migración.
- **Art. 6.5:** el código nuevo no debe añadir violaciones de ruff.
- **Art. 6.6-6.10:**
  - los módulos puros siguen en la feature `body-metrics`;
  - las llamadas pasan solo por `apiFetch`;
  - el cuerpo se valida con zod (enum ampliado);
  - no hay hooks ni claves nuevas;
  - se usan las clases de tono ya existentes (`text-amber-500` y `data-tone`).
- **Art. 6.11:** todos los textos nuevos están en español correcto y sin voseo.
- **Art. 7.2:** sin cambios: `@require_auth` y `user_id` del token.
- **Art. 7.3:** validación en el servicio (`ValidationError`) y con zod en el cliente.
- **Art. 7.4:** se conservan el rate limiting y el 503.
- **"DEBERÍA" no cumplidos:** ninguno.

## 8. ADRs

Ninguna. El valor `unrealistic` en `pace_status` y la normalización en el servidor amplían el contrato de [ADR-0021](../../docs/sdd/decisions/ADR-0021-contexto-del-analisis-desde-el-cliente.md) dentro de su propia decisión: el cliente calcula y formatea los indicadores, y el servidor decide la sugerencia de calorías y se protege de datos manipulados. No introducen una decisión de arquitectura nueva.
