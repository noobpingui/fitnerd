# Plan 010 — Análisis de progreso con IA con contexto del perfil y sugerencia de calorías

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-13)

## 1. Resumen de la solución

`POST /api/body-metrics/analysis` pasa a recibir un cuerpo JSON con el **contexto que ya calcula el frontend**: los indicadores de Métricas ya formateados (los mismos textos de la pantalla, producidos por la misma función pura), el código del estado del ritmo, el ritmo bruto en kg/sem, el peso de la última medición y las calorías de Macros. El servidor (ADR-0021):

1. rechaza con 409 a quien no tiene perfil, antes de cualquier otra comprobación;
2. lee de la base el perfil (sexo, altura, actividad, meta, unidades) y la edad desde `users.date_of_birth`, filtrando por el `user_id` del token;
3. valida el cuerpo, calcula la sugerencia de calorías con una regla fija en `services/calorie_suggestion.py` y arma el mensaje al modelo con unas reglas nuevas (sin voseo y con permiso para explicar la sugerencia);
4. devuelve `{analysis, calorie_suggestion}`. El frontend pinta el bloque "Ajuste de calorías sugerido" a partir de `calorie_suggestion`.

No hay cambios de modelo ni migración.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios de esquema. |
| backend · repositories | — | — | Se reutilizan `UserRepository.get_by_id` (de `BaseRepository`), `UserProfileRepository.get_by_user_id`, `BodyMetricRepository.list_by_user` y `ProgressAnalysisRepository`. |
| backend · services | `backend/services/calorie_suggestion.py`, `backend/services/progress_analysis_context.py` | `backend/services/progress_analysis_service.py` | Regla del ajuste (REQ-004 a REQ-006); validación del cuerpo, textos y armado del mensaje (REQ-001 a REQ-003, REQ-008, NFR-001); orden de comprobaciones, 409 y resultado con sugerencia (REQ-009, REQ-010). |
| backend · routes | — | `backend/routes/body_metric_routes.py` | `_build_progress_analysis_service()` inyecta `UserRepository` y `UserProfileRepository`; `analyze()` pasa el cuerpo y serializa `calorie_suggestion`. |
| backend · tests | `backend/tests/test_services/test_calorie_suggestion.py`, `backend/tests/test_routes/test_progress_analysis_routes.py` | `backend/tests/test_services/test_progress_analysis_service.py`, `backend/tests/fakes.py` | Ver sección 5. |
| frontend · features/body-metrics | `insightsView.ts`, `analysisRequest.ts`, `components/CalorieSuggestionBlock.tsx` (+ tests) | `api.ts`, `hooks.ts`, `types.ts`, `schemas.ts`, `components/ProgressAnalysis.tsx`, `pages/BodyMetricsPage.tsx` | Extraer cálculo y formato de indicadores a funciones puras; construir el cuerpo; mostrar el bloque y el 409. |
| docs | `docs/sdd/decisions/ADR-0021-contexto-del-analisis-desde-el-cliente.md` | `docs/sdd/decisions/README.md` | Decisión de arquitectura del contrato. |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

No aplica. No se guarda ni la sugerencia ni el texto del análisis. `progress_analyses` sigue registrando solo los intentos que cuentan contra el límite.

### 3.2 Contratos de API

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| POST | `/api/body-metrics/analysis` | `@require_auth` (sin cambios) | `AnalysisRequest` (abajo). Se ignora si el usuario no tiene perfil o no tiene mediciones en 12 meses. | 200 `{"analysis": str, "calorie_suggestion": CalorieSuggestion \| null}` | 401 sin sesión; **409** `{"error": "Completa tu perfil para poder generar un análisis."}`; **400** `{"error": "Los datos del análisis no son válidos."}` si el cuerpo no es válido; 429 límite (mensaje actual); 503 fallo del proveedor (mensaje actual) |

Sin mediciones en 12 meses (con perfil) la respuesta sigue siendo 200 con `analysis` = "Todavía no hay registros de métricas en los últimos 12 meses. Registra al menos uno para poder generar un análisis." y `calorie_suggestion: null`.

**`AnalysisRequest`** (JSON; todos los textos son exactamente los de la pantalla, `null` si la pantalla muestra "—"):

```json
{
  "today": "2026-10-12",
  "indicators": {
    "weight": "79,4 kg",
    "weight_change_30d": "-0,6 kg",
    "body_fat": "20 %",
    "body_fat_change_30d": "+0,5 pts",
    "rate": "-0,2 kg/sem",
    "pace_status": "too_slow",
    "fat_mass": "15,7 kg",
    "lean_mass": "62,8 kg",
    "bmi": "24,2",
    "ffmi": "19,4",
    "streak_weeks": 3,
    "records_last_30_days": 3,
    "total_records": 3,
    "last_record_date": "2026-10-12"
  },
  "rate_kg_per_week": -0.2,
  "latest_weight_kg": 79.4,
  "calories": { "maintenance_kcal": 2750, "target_kcal": 2200 }
}
```

Reglas de validación (servidor, `ValidationError` con el mensaje de 400; primer error gana):
- cuerpo, `indicators` y `calories` son objetos;
- `today`: `^\d{4}-\d{2}-\d{2}$`, fecha válida y a ±1 día de la fecha UTC del reloj inyectado;
- textos de indicadores: `null` o `str` de 1 a 32 caracteres que casan con `^[0-9A-Za-z.,+\-−  %/]+$` (impide saltos de línea e instrucciones largas);
- `pace_status` ∈ `on_track`, `too_slow`, `too_fast`, `off_range`, `insufficient`, `stale`;
- si `pace_status` es uno de los cuatro primeros: `rate_kg_per_week` número finito (no bool) en [-10, 10] y `latest_weight_kg` en [20, 400]; en `insufficient`/`stale` ambos deben ser `null`;
- contadores (`streak_weeks`, `records_last_30_days`, `total_records`): enteros (no bool) de 0 a 100000; `last_record_date`: `null` o fecha ISO válida;
- `maintenance_kcal` y `target_kcal`: enteros (no bool) de 1 a 10000.

**`CalorieSuggestion`** (`null` si no hay ritmo: `insufficient` o `stale`):

```json
{ "kind": "adjust", "target_kcal": 2200, "suggested_kcal": 1750, "adjustment_kcal": -450, "floor_kcal": 1500 }
```

| `kind` | Caso | `suggested_kcal` | `adjustment_kcal` |
|---|---|---|---|
| `adjust` | ajuste ≠ 0 sin tocar el suelo | objetivo + ajuste | ajuste |
| `floor_limited` | primer caso de REQ-005 | suelo | suelo − objetivo |
| `at_floor` | segundo caso de REQ-005 | objetivo | 0 |
| `on_track` | "En ritmo" o ajuste redondeado 0 (REQ-006) | objetivo | 0 |

### 3.3 Lógica de negocio

**`backend/services/calorie_suggestion.py`** (funciones puras, sin dependencias):
- Constantes: `GOAL_RATE_MIDPOINT_PCT = {"lose": -0.75, "lose_slow": -0.375, "maintain": 0.0, "gain_slow": 0.175, "gain": 0.375}`, `KCAL_PER_KG = 7700`, `ROUND_STEP_KCAL = 50`, `MAX_ADJUSTMENT_KCAL = 500`, `FLOOR_KCAL = {"male": 1500, "female": 1200}`, `PACE_STATUSES_WITH_RATE = ("on_track", "too_slow", "too_fast", "off_range")`.
- `@dataclass(frozen=True) CalorieSuggestion(kind, target_kcal, suggested_kcal, adjustment_kcal, floor_kcal)`.
- `round_adjustment(raw: float) -> int`: `m = abs(raw) / 50`; `n = floor(m) + 1` si `m − floor(m) > 0.5 + 1e-9`, si no `floor(m)` (empates hacia el menor valor absoluto); valor = `min(n * 50, 500)` con el signo de `raw`; `0` si el valor es 0.
- `suggest_calories(pace_status, rate_kg_per_week, latest_weight_kg, goal, gender, target_kcal) -> CalorieSuggestion | None`:
  1. `pace_status` fuera de `PACE_STATUSES_WITH_RATE` → `None`.
  2. `on_track` → `kind="on_track"`.
  3. `target_rate = GOAL_RATE_MIDPOINT_PCT[goal] * latest_weight_kg / 100`; `raw = (target_rate − rate_kg_per_week) * 7700 / 7`; `adj = round_adjustment(raw)`; `adj == 0` → `on_track`.
  4. `adj < 0` y `target_kcal <= floor` → `at_floor`.
  5. `target + adj < floor` → `floor_limited` (`suggested = floor`, `adjustment = floor − target`).
  6. Si no, `adjust`.

**`backend/services/progress_analysis_context.py`** (funciones puras):
- `INVALID_ANALYSIS_REQUEST_MESSAGE = "Los datos del análisis no son válidos."`.
- `parse_analysis_request(data, server_today: date) -> AnalysisRequest` (dataclass con los campos de 3.2; lanza `ValidationError`).
- Tablas de textos: `GENDER_LABELS = {"male": "hombre", "female": "mujer"}`; `ACTIVITY_LABELS` ("Bajo", "Moderado", "Alto", "Muy alto", "Atleta"); `GOAL_LABELS` ("Perder peso", "Perder peso lentamente", "Mantener peso", "Aumentar peso lentamente", "Aumentar peso"); `PACE_LABELS` (`on_track` "En ritmo con tu meta", `too_slow` "Más lento que tu meta", `too_fast` "Más rápido que tu meta", `off_range` "Fuera del rango de tu meta", `insufficient` "Faltan registros para calcularlo", `stale` "Sin registros recientes").
- `format_decimal(value)`: hasta un decimal con coma, sin ",0" (79.4 → "79,4", 180.0 → "180"). `to_display_weight(kg, unit)`: en lb, `floor(kg / 0.45359237 * 10 + 0.5) / 10` (igual que `Math.round` del frontend); en kg, sin cambios.
- `format_height(profile)`: "180 cm" o "5 ft 11 in".
- `build_user_message(profile, age, request, history, suggestion, months) -> str` con cuatro bloques en este orden:
  1. **Perfil del usuario**: "Sexo: hombre", "Edad: 30 años", "Altura: 180 cm", "Nivel de actividad: Alto", "Meta: Perder peso". Si `date_of_birth` es `None`, "Edad: no disponible".
  2. **Indicadores de progreso (tal como los ve el usuario en Métricas)**:
     - "Peso actual: 79,4 kg (cambio en 30 días: -0,6 kg)";
     - "% de grasa: …";
     - si hay ritmo, "Ritmo semanal: -0,2 kg/sem (Más lento que tu meta)"; si no, "Ritmo semanal: no disponible (Faltan registros para calcularlo)";
     - "Masa grasa", "Masa magra", "IMC", "FFMI";
     - "Racha: 3 semanas" ("1 semana" en singular), "Registros en los últimos 30 días: 3 registros" ("1 registro"), "Total de registros: 3 en total", "Último registro: 2026-10-12".

     Todo valor `null` se escribe "no disponible", sin número.
  3. **Calorías (Macros)**: "Mantenimiento: 2750 kcal", "Objetivo diario: 2200 kcal".
  4. **Ajuste de calorías sugerido (calculado por la app)**, según `kind`:
     - `adjust`: "Ajuste: -450 kcal al día. Calorías sugeridas: 1750 kcal al día.";
     - `floor_limited`: lo anterior más "Limitado por el mínimo recomendado de 1500 kcal.";
     - `at_floor`: "El objetivo diario ya está en el mínimo recomendado de 1200 kcal; no se sugiere bajarlo.";
     - `on_track`: "El ritmo encaja con la meta: mantener 2189 kcal al día.";
     - `None`: "No hay datos recientes suficientes para sugerir un ajuste de calorías."

     Los ajustes llevan signo explícito ("+450", "-450").

  Después va el historial cronológico de 12 meses (como hoy), con los pesos en la unidad del perfil y el formato de `format_decimal` ("2026-09-20: peso 80 kg, grasa corporal 20 %, notas: \"…\""). **Nunca** incluye nombre, correo, `date_of_birth` ni `user_id` (NFR-001).

**`PROGRESS_ANALYSIS_SYSTEM_PROMPT`** se reescribe en español neutro, con tildes y sin voseo (el actual usa "Sos", "Basate", "decilo"). Debe contener literalmente estas frases, en las que se apoyarán los tests:
- "Usa solo las cifras de calorías que recibes y no propongas otras cifras de calorías." (AC-008.1)
- "No recetes dietas, alimentos concretos ni rutinas de ejercicio." (AC-008.2)
- "Responde en español neutro, sin voseo ni regionalismos, en un par de párrafos como mucho." (AC-008.3)
- "Si no recibes un ajuste de calorías porque no hay ritmo, di que faltan datos recientes para ajustar las calorías." (REQ-008)
- "Sé coherente con el estado del ritmo que recibes." (REQ-008)

También conserva las reglas actuales de no inventar datos y de avisar cuando los datos son escasos, y permite comentar el perfil, la meta, los indicadores y las calorías recibidos. No puede contener formas de voseo: "Sos ", "Basate", "decilo", "tenés", "podés".

**`ProgressAnalysisService`**
- Constructor: `(body_metric_repository, progress_analysis_repository, user_repository, user_profile_repository, unit_of_work, llm_client, clock=utc_now)`. `utc_now` y `age_on` se reutilizan de `services/profile_service.py`.
- `analyze(user_id, data) -> AnalysisResult` (dataclass `analysis: str`, `calorie_suggestion: CalorieSuggestion | None`). El orden importa:
  1. `profile = user_profile_repository.get_by_user_id(user_id)`. Si es `None`, `ConflictError("Completa tu perfil para poder generar un análisis.")` (REQ-009: antes de datos y límite; no crea fila ni llama al modelo).
  2. Mediciones de 12 meses con `_months_ago` basado en `clock().date()` (en lugar de `date.today()`). Si no hay, devuelve `AnalysisResult(NO_DATA_MESSAGE, None)` con el texto corregido (REQ-010).
  3. `request = parse_analysis_request(data, clock().date())` (400; no cuenta contra el límite).
  4. `_check_rate_limit` (429, sin cambios).
  5. `user = user_repository.get_by_id(user_id)`; `age = age_on(user.date_of_birth, date.fromisoformat(request.today))`.
  6. `suggestion = suggest_calories(request.pace_status, request.rate_kg_per_week, request.latest_weight_kg, profile.goal, profile.gender, request.calories.target_kcal)`.
  7. Crear la fila `ProgressAnalysis`, `commit` y llamar a `llm_client.generate(PROGRESS_ANALYSIS_SYSTEM_PROMPT, [{"role": "user", "content": build_user_message(...)}])`. Un fallo se convierte en `ServiceUnavailableError` con el mensaje actual (sin cambios); si la respuesta es `None`, se conserva el texto actual.
  8. Devuelve `AnalysisResult(answer, suggestion)`.

**Ruta** `analyze()`: `data = request.get_json(silent=True)` y `result = service.analyze(user_id, data)`. Devuelve `jsonify(analysis=result.analysis, calorie_suggestion=_serialize_suggestion(result.calorie_suggestion))`, que da `None` o un dict con los cinco campos. El 409 lo traduce `error_handlers.py`, porque `ConflictError` es un `AppError`.

### 3.4 Frontend

- **`features/body-metrics/insightsView.ts`** (nuevo, puro). Recibe el cuerpo del `useMemo` de `BodyMetricsPage` y los formateadores `one`, `signed` y `PACE_COPY`:
  - `buildInsights(metrics, profile: OnboardingAnswers | null, today)` devuelve los indicadores en crudo, más `paceStatus: PaceStatusCode | null` (`"insufficient"`, `"stale"` o el `PaceStatus`).
  - `formatInsights(insights, weightUnit)` devuelve los textos de cada tarjeta, con `null` donde hoy se pinta "—": `weight`, `weightChange30d` (sin el sufijo " en 30 días"), `rate`, `bodyFat`, `bodyFatChange30d` (sin el sufijo), `fatMass`, `leanMass`, `bmi`, `ffmi`, más `statusLabel` y `tone`.
  - `BodyMetricsPage` pasa a pintar desde `formatInsights` y conserva sus textos exactos ("… en 30 días", "1 semana", etc.). Los tests actuales de la página hacen de red de regresión.
- **`features/body-metrics/analysisRequest.ts`** (nuevo, puro): `buildAnalysisRequest(metrics, profile: OnboardingAnswers, today): AnalysisRequest`.
  - Usa `buildInsights` y `formatInsights` para los textos y `calculateMacros(profile, parseLocalDate(today))` para `maintenance_kcal` y `target_kcal`.
  - `rate_kg_per_week` y `latest_weight_kg` salen de `rate.kgPerWeek` y `rate.latestKg` sin redondear, o `null` si no hay ritmo.
  - Los contadores salen de `streak`.
- **`types.ts`**: `PaceStatusCode`, `AnalysisRequest`, `CalorieSuggestion` (`kind: "adjust" | "floor_limited" | "at_floor" | "on_track"`) y `AnalysisResponse`.
- **`schemas.ts`**: `analysisRequestSchema` y `analysisResponseSchema` (zod), con el mismo patrón que `profile/api.ts` y `coach/api.ts`.
- **`api.ts`**: `analyzeBodyMetrics(request: AnalysisRequest | null)` valida el cuerpo con `analysisRequestSchema.parse` (sin cuerpo si es `null`), llama a `apiFetch<unknown>` con `POST` y devuelve `analysisResponseSchema.parse(...)`.
- **`hooks.ts`**: `useAnalyzeBodyMetrics()` sigue siendo una mutación sin clave de query, con `mutationFn: (request: AnalysisRequest | null) => analyzeBodyMetrics(request)`. Cada `mutate` reinicia `data`, así que el bloque desaparece o se sustituye con cada análisis (REQ-007).
- **`components/ProgressAnalysis.tsx`**:
  - recibe la prop `request: AnalysisRequest | null` y hace `onClick={() => mutate(request)}`;
  - el 409, igual que el 429, se muestra en tono neutro y sin el prefijo "Error (…):";
  - si `data.calorie_suggestion` no es `null`, pinta `<CalorieSuggestionBlock suggestion={…} />` junto a la tarjeta del texto (debajo).
- **`components/CalorieSuggestionBlock.tsx`** (nuevo):
  - título "Ajuste de calorías sugerido";
  - `adjust` y `floor_limited`: "{target} kcal → {suggested} kcal al día" y "({±ajuste} kcal)", con el signo puesto a mano (`+` o `-` ASCII) y los números con `Intl.NumberFormat("es-ES")`, como Macros; `floor_limited` añade "No se sugiere bajar de {floor} kcal.";
  - `at_floor`: "Tu objetivo ya está en el mínimo recomendado de {floor} kcal, así que no se sugiere bajarlo.", sin flecha;
  - `on_track`: "Tu ritmo encaja con tu meta: mantén {target} kcal al día.";
  - siempre termina con "Es una estimación basada en tu ritmo de las últimas 4 semanas y supone que sigues tu objetivo diario actual.".
- **`pages/BodyMetricsPage.tsx`**: `analysisRequest = useMemo(() => profileResponse?.profile ? buildAnalysisRequest(metrics, profile, today) : null)` se pasa a `<ProgressAnalysis request={analysisRequest} />`. Sin perfil se envía `null` y el servidor responde 409.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `ProgressAnalysisService.analyze` (pasos 1 y 5) + `progress_analysis_context.build_user_message` (bloque Perfil, `GENDER_LABELS`, `ACTIVITY_LABELS`, `GOAL_LABELS`, `format_height`, `age_on` con `request.today`); historial en la unidad del perfil con `to_display_weight` |
| REQ-002 | Frontend: `insightsView.buildInsights`/`formatInsights` (los mismos textos que la página) + `analysisRequest.buildAnalysisRequest`. Backend: `parse_analysis_request`, `PACE_LABELS` y el bloque Indicadores de `build_user_message` ("no disponible" para `null`) |
| REQ-003 | `buildAnalysisRequest` con `calculateMacros` (mismos valores que Macros) → `calories` → bloque Calorías de `build_user_message` |
| REQ-004 | `calorie_suggestion.suggest_calories` + `round_adjustment`; bloque Ajuste del mensaje; `calorie_suggestion` en la respuesta |
| REQ-005 | `suggest_calories` pasos 4 y 5 (`at_floor`, `floor_limited`, `FLOOR_KCAL` por `profile.gender`) |
| REQ-006 | `suggest_calories` pasos 1 a 3 (`None` sin ritmo; `on_track`) + textos del bloque Ajuste |
| REQ-007 | `CalorieSuggestionBlock` + `ProgressAnalysis` (pinta solo con `data.calorie_suggestion`; la mutación reinicia `data`) |
| REQ-008 | `PROGRESS_ANALYSIS_SYSTEM_PROMPT` reescrito (frases fijas de 3.3) + texto "No hay datos recientes suficientes…" en el mensaje |
| REQ-009 | `analyze` paso 1 (`ConflictError` 409 antes de datos, validación y límite; sin fila ni llamada) + `ProgressAnalysis` (409 en tono neutro, sin bloque) |
| REQ-010 | `analyze` pasos 2, 4 y 7 sin cambios de comportamiento; `NO_DATA_MESSAGE` corregido; `@require_auth` sigue en la ruta |
| NFR-001 | `build_user_message` solo usa las columnas de perfil listadas, la edad calculada y el historial; nunca `first_name`, `last_name`, `email`, `date_of_birth` ni ids. Los textos del cliente pasan por la lista blanca |
| NFR-002 | Perfil, usuario e historial se leen con el `user_id` del token (`g.decoded_token["id"]`); el cuerpo no lleva ningún identificador |

## 5. Estrategia de pruebas

**Fakes nuevos (`backend/tests/fakes.py`):**
- `FakeUserRepository(users: dict)` con `get_by_id(user_id)`, que devuelve `SimpleNamespace` con `id`, `first_name`, `last_name`, `email` y `date_of_birth` (o `None`).

Se reutilizan:
- `FakeUserProfileRepository`, `FakeBodyMetricRepository` (filtra por `user_id`, clave para NFR-002), `FakeUnitOfWork`, `FakeLLMClient` (`calls` guarda el system prompt y los mensajes) y `FakeClock` (con `datetime(2026, 10, 12, 12, 0)`);
- `FakeProgressAnalysisRepository`, que sigue siendo local del archivo de test.

Hay que adaptar a la nueva firma el helper `make_service` y los cuatro tests existentes de `test_progress_analysis_service.py`, sin debilitarlos: tendrán perfil, cuerpo válido y la aserción de texto ya acepta las dos ortografías. Sin `unittest.mock` ni `monkeypatch`.

**Backend unitario: `test_calorie_suggestion.py`** (funciones puras, sin fakes)
- AC-004.1 (`too_slow`, -0,2, 79,4 kg, `lose`, male, 2200): -450 / 1750.
- AC-004.2 (`too_fast`, -1, 77, 2170): +450 / 2620.
- AC-004.3 (`off_range`, +0,3, 80,9, `maintain`, 2773): -350 / 2423.
- AC-004.4 (`too_slow`, -0,5, 78,5, `gain`, 3283): +500 / 3783.
- AC-004.5: `round_adjustment(-325) == -300` y `round_adjustment(-330) == -350`.
- AC-004.6: con un ajuste bruto de +20, `kind == "on_track"`. Se construye con `latest_weight_kg`/`rate` que den +20, o se prueba `round_adjustment(20) == 0` junto con un caso de `suggest_calories` que dé 0.
- AC-005.1: `low`, 1703 → `floor_limited` 1500 / -203.
- AC-005.2: female, 1200, -0,1, 60,2 → `at_floor`.
- AC-005.3: = AC-004.2, sin suelo.
- AC-006.1: `on_track` 2189.
- AC-006.2 y AC-006.3: `insufficient` y `stale` → `None`.

**Backend unitario: `test_progress_analysis_service.py`** (con fakes; se lee el mensaje de `FakeLLMClient.calls[0]`)
- **Perfil (AC-001):**
  - AC-001.1: "hombre", "30 años", "180 cm", "Alto", "Perder peso".
  - AC-001.2: dob 1996-10-13 con `today` 2026-10-12 → "29 años".
  - AC-001.3: perfil `ft`/`lb` → "5 ft 11 in", y el historial en lb ("175 lb" para 79,4 kg).
  - AC-001.4: "Aumentar peso lentamente", "Atleta".
- **Indicadores (AC-002):** los textos recibidos en el cuerpo aparecen en el mensaje junto con el `PACE_LABELS` correspondiente.
  - AC-002.1 y AC-002.7: "79,4 kg"/"175 lb", "-0,6 kg", "-0,2 kg/sem"/"-0,4 lb/sem", "Más lento que tu meta".
  - AC-002.2: "En ritmo con tu meta", "20 %", "15,7 kg", "62,8 kg", "24,2", "19,4".
  - AC-002.3: "Faltan registros para calcularlo" y ningún texto de estado de meta.
  - AC-002.4: "Sin registros recientes".
  - AC-002.5: "no disponible" para % de grasa, masa grasa, masa magra y FFMI.
  - AC-002.6: "3 semanas", "3 registros", "3 en total", "2026-10-12".
- **Calorías (AC-003):** AC-003.1 "2750 kcal" y "2200 kcal"; AC-003.2 "1200 kcal".
- **Ajuste en el mensaje y en el resultado:** AC-004.7 "-450 kcal" y "1750 kcal" en el mensaje y en `result.calorie_suggestion`; AC-005.2 "mínimo recomendado de 1200 kcal"; AC-006.1 "mantener 2189 kcal"; AC-006.2 sin "Ajuste:" ni "Calorías sugeridas" y `calorie_suggestion is None`.
- **Instrucciones al modelo (AC-008):**
  - AC-008.1 a AC-008.3: el system prompt contiene las frases fijas de 3.3 y ninguna forma de voseo.
  - AC-008.4: el mensaje contiene "No hay datos recientes suficientes para sugerir un ajuste de calorías".
- **Sin perfil (AC-009):**
  - AC-009.1 a AC-009.3: sin perfil, `ConflictError` con el mensaje exacto en los tres escenarios (con mediciones, sin mediciones y con `count_since_value=2`); `llm_client.calls == []` y `created == []`.
  - AC-009.5: primero el 409; después se añade el perfil al fake y la llamada genera el análisis con `created` de longitud 1.
- **Comportamiento que se conserva (AC-010):**
  - AC-010.1: con perfil y cuota agotada → `RateLimitError` con el mensaje exacto y sin llamadas.
  - AC-010.2: con perfil y sin datos → el texto corregido exacto, `calorie_suggestion is None`, sin llamada y sin fila.
  - AC-010.3: fallo del proveedor → `ServiceUnavailableError` con el mensaje exacto y `created` de longitud 1.
- **Privacidad y aislamiento (NFR):**
  - AC-N001.1: el system prompt y el mensaje no contienen el nombre, el correo, "1996-10-12" ni `str(user_id)`, y sí "30 años".
  - AC-N002.1: dos usuarios en `FakeBodyMetricRepository` y `FakeUserProfileRepository`, con notas y alturas distintivas; el mensaje del primero no contiene las del segundo.
- **Validación** (sin AC propio, protege el Art. 7.3): cuerpo `None`, `today` a más de un día, texto con salto de línea, `pace_status` desconocido y kcal no enteras → `ValidationError`, sin llamada y sin fila.

**Backend integración: `test_progress_analysis_routes.py`** (Postgres; no hay ningún caso que llegue al modelo, para no llamar a Anthropic)
- AC-010.4: sin token → 401.
- AC-009.1: con mediciones y sin perfil → 409 con el mensaje; ninguna fila en `progress_analyses`.
- AC-009.2: sin mediciones ni perfil → 409.
- AC-009.3: sin perfil y con dos filas de `ProgressAnalysis` sembradas con `db_session` → 409, no 429.
- AC-010.2: con perfil (vía `PUT /api/profile`) y sin mediciones → 200 con el texto corregido y `calorie_suggestion: null`.
- AC-010.1: con perfil, mediciones, dos filas sembradas y un cuerpo válido (`today` = fecha UTC actual) → 429 con el mensaje.
- Extra: cuerpo inválido → 400 con "Los datos del análisis no son válidos." y sin fila nueva.

**Frontend unitario: `insightsView.test.ts` y `analysisRequest.test.ts`** (Vitest, puros, con `today` fijo "2026-10-12" y perfil base vía `makeProfileResponse`/`answersFromProfile`)
- AC-002.1: `weight` "79,4 kg", `weight_change_30d` "-0,6 kg", `rate` "-0,2 kg/sem", `pace_status` "too_slow", `rate_kg_per_week` ≈ -0,2 y `latest_weight_kg` 79,4.
- AC-002.2: "on_track", "20 %", "15,7 kg", "62,8 kg", "24,2", "19,4".
- AC-002.3: `rate` `null`, "insufficient", `rate_kg_per_week` `null`.
- AC-002.4: "stale".
- AC-002.5: `body_fat`, `fat_mass`, `lean_mass` y `ffmi` a `null`.
- AC-002.6: 3, 3, 3, "2026-10-12".
- AC-002.7: "175 lb", "-0,4 lb/sem".
- AC-003.1: 2750 y 2200.
- AC-003.2: `target_kcal` 1200.
- AC-007.8 (parte de datos): con el perfil en lb, `target_kcal` sigue siendo 2200.
- El cuerpo pasa `analysisRequestSchema`.

**Frontend RTL: `CalorieSuggestionBlock.test.tsx` y `ProgressAnalysis.test.tsx`** (`analyzeBodyMetrics` mockeado en `@/features/body-metrics/api`, como en `BodyMetricsPage.test.tsx`)
- AC-007.1: `adjust` 2200/1750/-450 → "Ajuste de calorías sugerido", "2200 kcal → 1750 kcal al día", "(-450 kcal)" y el texto de estimación.
- AC-007.2: "(+450 kcal)".
- AC-007.3: `floor_limited` → "1703 kcal → 1500 kcal al día", "(-203 kcal)" y "No se sugiere bajar de 1500 kcal.".
- AC-007.4: `at_floor` → la frase y ningún "→".
- AC-007.5: `on_track` → "Tu ritmo encaja con tu meta: mantén 2189 kcal al día.".
- AC-007.6: `calorie_suggestion: null` → el texto del análisis, sin el título.
- AC-007.7: rechazos `ApiError(503)` y `ApiError(429)` → el mensaje y ningún bloque. Además, tras un éxito, un segundo clic que falla hace desaparecer el bloque.
- AC-007.8: el bloque en kcal con el perfil en lb.
- AC-009.4: `ApiError(409, "Completa tu perfil…")` → el mensaje visible y ningún bloque.
- `mutate` se llama con la prop `request`.

**Frontend de página: `BodyMetricsPage.analysis.test.tsx`** (archivo nuevo, sin el stub de `ProgressAnalysis`)
- Con el perfil base y las mediciones "más lento", el clic llama a `analyzeBodyMetrics` con un cuerpo que lleva "79,4 kg", "too_slow" y `target_kcal` 2200. Cubre el cableado de AC-002.1 y AC-003.1.
- Con el perfil vacío (`profile: null`) se llama con `null`.

**Regresión:** `BodyMetricsPage.test.tsx`, `insights.test.ts` y `calculations.test.ts` siguen pasando sin cambios. Son la garantía de que la extracción a `insightsView.ts` no cambia lo que se ve.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El texto que se envía al modelo diverge del de la pantalla (redondeos JS frente a Python) | Media si se formatea en el servidor | Alto (REQ-002) | El servidor no reformatea indicadores: recibe los textos producidos por `formatInsights`, la misma función que pinta la página (ADR-0021). Solo formatea en el servidor el perfil y el historial, con `Math.round` imitado en `to_display_weight`. |
| Un cliente manipulado envía indicadores o calorías falsos, o intenta una inyección de instrucciones | Baja | Bajo (solo afecta a su propio análisis) | Lista blanca de caracteres y 32 caracteres como máximo por texto, rangos numéricos, `today` a ±1 día y el límite de 2 análisis cada 24 horas en el servidor. Perfil, edad e historial salen siempre de la base. |
| Al extraer `insightsView.ts` cambia algún texto de Métricas | Media | Medio | Los tests actuales de `BodyMetricsPage` deben seguir verdes sin tocarlos; `formatInsights` conserva `Intl.NumberFormat("es-ES")` y `PACE_COPY` tal cual. |
| Los empates de redondeo flotante (p. ej. -324,999…) no caen como dice la spec | Baja | Bajo | Tolerancia de 1e-9 en `round_adjustment` y tests explícitos de -325 y -330. |
| Los tests de rutas llaman sin querer a Anthropic | Baja | Medio (coste y fragilidad) | Ningún caso de integración llega al paso 7; los casos 200 con análisis y 503 se prueban solo a nivel de servicio con `FakeLLMClient`. |

## 7. Cumplimiento de la constitución

- **Art. 4 (trazabilidad):** cada AC tiene un test asignado en la sección 5, con marcador `SDD:`.
- **Art. 5:** TDD; fakes escritos a mano e inyectados por constructor (nuevo `FakeUserRepository`); sin `unittest.mock`/`monkeypatch` en el backend. En el frontend, la red se simula en `api.ts` con `vi.mock`, como hoy. Ningún test llama a servicios externos.
- **Art. 6.1-6.3:** la ruta solo parsea, llama y serializa; la lógica está en `services/`; los errores se lanzan como `ConflictError`, `ValidationError`, `RateLimitError` y `ServiceUnavailableError`; solo `UnitOfWork` hace commit.
- **Art. 6.4:** sin cambios de modelo, así que no hace falta migración.
- **Art. 6.5:** el código nuevo no debe añadir violaciones de ruff.
- **Art. 6.6-6.10:** la organización por feature se mantiene (`insightsView.ts` y `analysisRequest.ts` son módulos puros de la feature, como `insights.ts`); las llamadas pasan solo por `apiFetch`; el cuerpo y la respuesta se validan con zod; la mutación sigue en `hooks.ts`.
- **Art. 6.11:** todos los textos nuevos están en español correcto. El system prompt se corrige para quitar el voseo.
- **Art. 7.2:** el endpoint ya usa `@require_auth` y filtra por el `user_id` del token.
- **Art. 7.3:** el cuerpo se valida en el servicio (`ValidationError`) y con zod en el cliente.
- **Art. 7.4:** se conservan el rate limiting y el 503.
- **"DEBERÍA" no cumplidos:** ninguno.

## 8. ADRs

- [ADR-0021](../../docs/sdd/decisions/ADR-0021-contexto-del-analisis-desde-el-cliente.md): contexto del análisis calculado y formateado en el cliente, perfil y edad leídos en el servidor, y sugerencia de calorías calculada en el servidor y devuelta en la respuesta (Propuesta).
