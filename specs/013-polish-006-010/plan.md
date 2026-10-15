# Plan 013 — Pulido del código y la documentación de las features 006 a 010

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-15)

## 1. Resumen de la solución

Pasada de limpieza sin cambios de modelo ni de API, con dos arreglos pequeños:

- **Backend.** El 500 con enteros enormes lo provoca `math.isfinite(valor)`: lanza `OverflowError` porque el entero no cabe en un float. Se crea un helper `is_number` compartido que devuelve `False` en ese caso. Así, la validación existente responde con el mensaje de rango de cada campo o con el mensaje del análisis. Además, "Usuario no encontrado" y `PACE_STATUSES_WITH_RATE` pasan a tener una sola definición.
- **Frontend.** El aviso de borrado fallido se ata a la lista de mediciones con la que falló. Se aplican los siete arreglos de limpieza (reexportaciones, casts, tipo del suelo, altura, función sin uso, comentario y comprobación redundante). Los dos avisos de la salida de los tests se filtran con `test.onConsoleLog` de Vitest, sin tocar la app.
- **Tests y documentación.** Hay marcadores nuevos, docstrings con tildes, un `renderLoaded` sin cuenta fija de microtareas y tests que recorren el código fuente para los AC estáticos. La fila de `CLAUDE.md` la divide el doc-keeper en la etapa docs.
- No hay migración.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios de modelo (no hay migración) |
| backend · repositories | — | — | — |
| backend · services | `backend/services/number_validation.py` | `backend/services/profile_service.py`, `backend/services/body_metric_service.py`, `backend/services/progress_analysis_context.py`, `backend/services/progress_analysis_service.py` | REQ-001 a REQ-003 (helper `is_number` sin `OverflowError`), NFR-002 (AC-N002.9), NFR-003 (AC-N003.2) |
| backend · routes | — | — | El JSON se sigue leyendo con `request.get_json(silent=True)` |
| backend · tests | `backend/tests/test_services/test_source_cleanup_013.py` | `test_routes/test_profile_routes.py`, `test_routes/test_body_metric_routes.py`, `test_routes/test_progress_analysis_routes.py`, `test_services/test_profile_service.py`, `test_services/test_body_metric_service.py`, `test_services/test_progress_analysis_service.py` | REQ-001 a REQ-004, NFR-002, NFR-003 y NFR-004 |
| frontend · features/body-metrics | — | `dateUtils.ts`, `insightsView.ts`, `analysisRequest.ts`, `api.ts`, `components/MetricsHistory.tsx`, `components/TrendChart.tsx`, `components/ProgressAnalysis.tsx`, `pages/BodyMetricsPage.tsx` | REQ-005, NFR-002 y NFR-003 |
| frontend · features/macros | — | `calculations.ts` | AC-N002.2 y AC-N002.4 |
| frontend · lib y configuración de tests | `frontend/src/lib/testConsoleNoise.ts` | `frontend/vite.config.ts` | NFR-005 (filtro de la salida de Vitest) |
| frontend · tests | `src/lib/dates.test.ts`, `src/lib/testConsoleNoise.test.ts`, `src/features/auth/components/GoogleSignInButton.test.tsx`, `src/app/sourceCleanup013.test.ts` | `features/body-metrics/dateUtils.test.ts`, `insights.test.ts`, `insightsView.test.ts`, `components/MetricsHistory.test.tsx`, `pages/BodyMetricsPage.test.tsx`, `features/macros/calculations.test.ts` | REQ-005, NFR-002, NFR-003 y NFR-005 |
| documentación | — | `CLAUDE.md` (sección **Proyecto**, solo el doc-keeper en la etapa docs) | NFR-006 |

## 3. Diseño

### 3.1 Modelo de datos y migraciones

No aplica. No cambia ninguna tabla ni columna, así que no hace falta migración Alembic.

### 3.2 Contratos de API

No hay endpoints, campos ni mensajes nuevos. Solo cambia el código de respuesta con enteros enormes (tabla de la sección 6 de la spec):

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| PUT | `/api/profile` | `@require_auth` | Igual que hoy | Igual que hoy | `height_cm` o `weight` con entero enorme: **400** con el mensaje de rango del campo (antes 500). Cuerpo que no se puede parsear (entero de más de 4300 dígitos): 400 `"Los datos del perfil no son válidos"`, como hoy |
| POST | `/api/body-metrics` | `@require_auth` | Igual que hoy | Igual que hoy | `weight`, `body_fat_percentage` o `muscle_mass_percentage` enormes: **400** con el mensaje del campo. Cuerpo que no se puede parsear: 400 `"Los datos de la medición no son válidos"`, como hoy |
| PUT | `/api/body-metrics/{id}` | `@require_auth` | Igual que hoy | Igual que hoy | Lo mismo que POST. Se conserva el orden: 404 antes de validar |
| POST | `/api/body-metrics/analysis` | `@require_auth` | Igual que hoy | Igual que hoy | `rate_kg_per_week` o `latest_weight_kg` enormes: **400** `"No se pudo preparar el análisis. Recarga la página e inténtalo de nuevo."`, antes de comprobar el límite y sin registrar ninguna fila. Se mantiene el orden: 409 sin perfil, después "sin datos" y después la validación |

**Nota sobre el entero de 5000 dígitos (AC-001.5 y AC-002.5).** Python 3.13 limita a 4300 los dígitos al convertir un texto en entero (`sys.int_max_str_digits`). `json.loads` lanza `ValueError` y `request.get_json(silent=True)` devuelve `None`, así que la ruta ya responde hoy con el 400 del cuerpo no válido. El plan no lo cambia: esos dos AC describen un comportamiento que ya existe y que se conserva (§5.4).

### 3.3 Lógica de negocio

**Nuevo `backend/services/number_validation.py`** (funciones puras, sin dependencias):

```python
def is_number(value) -> bool:
    """int o float finito que cabe en un float; nunca bool."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        # Un entero enorme (por ejemplo, de 400 dígitos) no cabe en un float.
        return False


def is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)
```

- **`profile_service.py`** borra `_is_number` y `_is_int` e importa `is_number` e `is_int`. La validación de rangos no cambia: con un entero enorme, `is_number` devuelve `False` y se lanza el mensaje de rango del campo (`HEIGHT_CM_MESSAGE` o `WEIGHT_RANGES[unit]`). `USER_NOT_FOUND_MESSAGE` sigue definido aquí y es la **única** definición.
- **`body_metric_service.py`** importa `is_number` de `number_validation` y `USER_NOT_FOUND_MESSAGE` de `profile_service`, y borra su constante duplicada. `WEIGHT_RANGES`, `_round1` y `utc_now` se siguen importando de `profile_service` como hoy. `update_metric` conserva el orden: bloqueo, 404 y después `_validate_values`.
- **`progress_analysis_context.py`** borra `_is_number`, `_is_int` y su `PACE_STATUSES_WITH_RATE`. Importa `is_number` e `is_int` de `number_validation` y `PACE_STATUSES_WITH_RATE` de `calorie_suggestion`, que ya importa `CalorieSuggestion` e `is_unrealistic_rate`. La única definición de la lista queda en `calorie_suggestion.py`. Con `pace_status` "unrealistic" y un ritmo enorme, `is_number(rate)` es `False`, así que también responde 400. Esto cumple REQ-003 sin añadir rango al ritmo marcado (010 F1 queda fuera).
- **`progress_analysis_service.py`** no cambia de lógica: `parse_analysis_request` ya se llama antes de `_check_rate_limit` y de `create()`. Solo cambia el comentario de la línea 149 ("prolijo"), que pasa a decir, por ejemplo: `# Un fallo de Anthropic se traduce en un 503 con un mensaje claro en lugar de un 500.` (AC-N003.2). El mensaje visible "No se pudo generar el analisis…" **no** se toca (Q9).
- **Dependencias inyectadas:** no cambian. Los servicios siguen recibiendo repositorios, `UnitOfWork`, `LLMClient` y `clock` por constructor desde `_build_*_service()`.

### 3.4 Frontend

No hay claves de query, hooks, schemas zod ni endpoints nuevos.

**REQ-005 — `components/MetricsHistory.tsx`**
- `deleteFailed: boolean` se sustituye por `failedFor: BodyMetric[] | null`, que guarda **la lista con la que falló el borrado**.
- `onFailed` hace `setDeleting(null)` y `setFailedFor(metrics)`.
- El aviso se pinta si `failedFor !== null && failedFor === metrics`. Si la lista cambia de referencia, el aviso deja de verse sin efectos ni `setState` durante el render (AC-005.2).
- "Corregir medición del …" hace `setFailedFor(null)` y `setEditingId(metric.id)` (AC-005.1). "Borrar medición del …" hace `setFailedFor(null)` y `setDeleting(metric)`, como hoy (AC-005.3). "Mostrar más" no toca `failedFor` (AC-005.4).
- Por qué funciona con la referencia: `BodyMetricsPage` pasa `data` de `useBodyMetrics()` sin transformarlo. TanStack Query aplica *structural sharing*, así que un refetch con los mismos datos devuelve la misma referencia y el aviso no desaparece por un refetch sin cambios. Un borrado fallido no invalida la query, porque `useDeleteBodyMetric` solo invalida en `onSuccess`.

**NFR-002**
- **AC-N002.1 — `dateUtils.ts`:** se borran la línea `export { parseLocalDate, todayIsoDate }` y su comentario. Se mantiene `import { parseLocalDate } from "@/lib/dates"`, que usan `formatDate` y `formatShortDate`. `TrendChart.tsx` y `pages/BodyMetricsPage.tsx` importan `todayIsoDate` de `@/lib/dates`.
- **AC-N002.5 — `dateUtils.ts`:** se borra `isWithinLastMonths` con su comentario. El import de `todayIsoDate` desaparece de este archivo.
- **AC-N002.2 — `macros/calculations.ts`:** `const MIN_TARGET_KCAL: Record<Gender, number> = { male: 1500, female: 1200 }`, con `Gender` importado como tipo de `@/features/onboarding/types`.
- **AC-N002.4 — `macros/calculations.ts`:** `const cm = heightCmFromAnswers(a) ?? 0`, importado de `@/features/onboarding/units`, y se quita el import de `CM_PER_IN`. Con alturas válidas el resultado es idéntico, porque la fórmula es la misma. `calculateMacros` solo se llama con perfiles guardados (validados en el servidor entre 100 y 250 cm). El `?? 0` coincide con el resultado actual para una altura vacía (`Number("")` es 0).
- **AC-N002.6 — `TrendChart.tsx`:** el comentario "La tendencia solo tiene sentido en el peso…" pasa a estar justo antes de `const isWeight = field === "weight"`, que decide si se dibuja la línea de tendencia. Ya no queda delante de `const from = periodStart(…)`.
- **AC-N002.7 — `insightsView.ts`:** `formatInsights(insights: Insights, weightUnit: WeightUnit)`. Se borran el tipo `InsightsInput`, su comentario y `const insights = input as Insights`. Los dos llamadores de producción (`BodyMetricsPage`, `analysisRequest`) ya pasan un `Insights`.
- **AC-N002.8 — `analysisRequest.ts`:** la comprobación `rate.kind === "ok"` aparece una sola vez. Hay dos opciones, y el implementer elige la que acepte `tsc -b`:
  - estrechar con la condición guardada: `hasRate ? rate.kgPerWeek : null`, con `rate` constante;
  - `const rateOk = rate.kind === "ok" && insights.paceStatus !== null ? rate : null` y después `rateOk?.kgPerWeek ?? null` y `rateOk?.latestKg ?? null`.

**NFR-003 (comentarios)**
- `components/ProgressAnalysis.tsx`, línea 55: "errores tecnicos" pasa a "errores técnicos". La línea completa queda en español correcto (AC-N003.3).
- `api.ts`, línea 41: "se envia" pasa a "se envía". El resto de la línea queda en español correcto.

**NFR-005 — salida de los tests**
- **Nuevo `frontend/src/lib/testConsoleNoise.ts`** (solo lo usa la configuración de Vitest; la app no lo importa): `export function isTestConsoleNoise(log: string): boolean`. Devuelve `true` **solo** en dos casos:
  - el texto incluye `"VITE_GOOGLE_CLIENT_ID no esta configurado"`;
  - el texto encaja con `/The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/` (aviso de Recharts).
  
  Con cualquier otro texto devuelve `false` (Q6).
- **`frontend/vite.config.ts`:** en `test` se añade `onConsoleLog(log, type) { if (type === 'stderr' && isTestConsoleNoise(log)) return false }`, con `import { isTestConsoleNoise } from './src/lib/testConsoleNoise.ts'`. `tsconfig.node.json` usa `module: nodenext` y `allowImportingTsExtensions`, así que el import lleva la extensión.
  - Al no envolver `console.warn`, un `vi.spyOn(console, "warn")` sigue viendo la llamada.
  - `GoogleSignInButton.tsx` **no se modifica**, así que la app sigue avisando en la consola del navegador (AC-N005.3).
- **Andamiaje (ADR-0012):** en modo scaffold, `isTestConsoleNoise` lanza `Error("not implemented")`, con el parámetro como `_log`. El hook `onConsoleLog` todavía **no** se conecta en el andamiaje, para no romper la suite con ese error. Se conecta en la etapa implement.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `number_validation.is_number` (sin `OverflowError`) usado por `profile_service._validate`. Los mensajes de rango ya existentes dan el 400. El servicio valida antes de tocar nada (AC-001.4). AC-001.5 lo resuelve el parseo actual de `get_json(silent=True)` (§3.2) |
| REQ-002 | `is_number` en `body_metric_service._validate_values`, compartido por `save_metric` y `update_metric`. `update_metric` valida antes de modificar la medición y de sincronizar el peso del perfil (AC-002.4). AC-002.5 se resuelve con el parseo actual |
| REQ-003 | `is_number` en `progress_analysis_context.parse_analysis_request`. El orden de `ProgressAnalysisService.analyze` (validación antes de `_check_rate_limit`, `create()` y `llm_client.generate`) garantiza que no se llama a la IA ni se cuenta el intento |
| REQ-004 | Sin cambio de código: comportamiento actual de `parse_analysis_request` y de la ruta. Solo se cambian los marcadores de los 7 tests (NFR-004) |
| REQ-005 | `MetricsHistory.tsx`: estado `failedFor` atado a la referencia de `metrics` y limpiado en "Corregir" y "Borrar" (§3.4) |
| NFR-001 | Sin cambios fuera de lo descrito. La suite completa, lint, tsc, build y ruff los ejecuta el verifier. Sin `skip`, `only` ni `todo`. Solo se borran los tests de `isWithinLastMonths` (Q3), y el de límite inferior se sustituye (§5.3) |
| NFR-002 | AC-N002.1/5 `dateUtils.ts`, `TrendChart.tsx`, `BodyMetricsPage.tsx` · AC-N002.2/4 `macros/calculations.ts` · AC-N002.3 `calculations.test.ts` · AC-N002.6 `TrendChart.tsx` · AC-N002.7 `insightsView.ts` y su test · AC-N002.8 `analysisRequest.ts` · AC-N002.9 `body_metric_service.py`, `progress_analysis_context.py` · AC-N002.10 `BodyMetricsPage.test.tsx` |
| NFR-003 | AC-N003.1: docstrings de `test_body_metric_routes.py` (test-author). AC-N003.2: `progress_analysis_service.py` (l. 149), `ProgressAnalysis.tsx` (l. 55) y `api.ts` (l. 41) (implementer). AC-N003.3: cada línea de comentario o docstring tocada queda con tildes (reviewer, sobre el diff) |
| NFR-004 | Marcadores `SDD: 013 REQ-004 AC-004.x` en `test_progress_analysis_service.py` (6 tests) y `test_progress_analysis_routes.py` (1 test) |
| NFR-005 | `src/lib/testConsoleNoise.ts` y `test.onConsoleLog` en `vite.config.ts`. `GoogleSignInButton.tsx` intacto (AC-N005.3) |
| NFR-006 | `CLAUDE.md`, sección **Proyecto**: fila corta de como máximo 300 caracteres y la lista "Métricas corporales, en detalle" justo después de la tabla. La escribe el doc-keeper en la etapa docs. Las demás secciones no cambian |

## 5. Estrategia de pruebas

Todos los marcadores llevan el número de la spec: `# SDD: 013 REQ-001 AC-001.1` y `// SDD: 013 NFR-002 AC-N002.1` (ADR-0022). No se usan `unittest.mock` ni `monkeypatch`. Los fakes existentes de `backend/tests/fakes.py` bastan (`FakeUserRepository`, `FakeLockingUserRepository`, `FakeUserProfileRepository`, `FakeBodyMetricRepository`, `FakeUnitOfWork`, `FakeClock`, `FakeLLMClient`) y no hacen falta fakes nuevos.

**Cómo enviar enteros enormes en los tests de rutas:**
- 10^400 (401 dígitos) se puede pasar con `json=` del cliente de Flask, porque `json.dumps` lo serializa (está por debajo del límite de 4300 dígitos).
- El entero de 5000 dígitos **no**: `json.dumps` falla al convertirlo en texto. Hay que enviar el cuerpo como texto, con `data=...` y `content_type="application/json"`. El número se construye como cadena (`"1" + "0" * 4999`) y se pega en el JSON a mano, nunca con `str(10**4999)`.

### 5.1 Backend · unitarios de servicio (con fakes)

- `test_profile_service.py`:
  - **AC-001.1, AC-001.2 y AC-001.3**: `save_profile` lanza `ValidationError` con el mensaje exacto de cada AC.
  - **AC-001.4**: con un perfil previo en `FakeUserProfileRepository`, el perfil no cambia, y `FakeUnitOfWork` no registra commit.
- `test_body_metric_service.py`:
  - **AC-002.1, AC-002.2 y AC-002.3** con `save_metric`: mensaje exacto y el repositorio fake no crea nada.
  - **AC-002.4** con `update_metric`: la medición sigue en 80 kg, el peso del perfil fake no cambia y no hay commit.
- `test_progress_analysis_service.py`:
  - **AC-003.1, AC-003.2 y AC-003.3**: se reutiliza `assert_invalid()` con `make_body(...)`, `goal_status_body("on_track", 10**400, 79.4, ...)`, `goal_status_body("on_track", -0.2, 10**400, ...)` y `unrealistic_body(12.6, -10**400)`. `assert_invalid` ya comprueba el mensaje, que `llm.calls == []` y que `analyses.created == []`.
  - Para el "no se cuenta contra el límite" de REQ-003, conviene un caso con `count_since_value=1` que siga dando el 400 sin crear filas.
  - **NFR-004:** se cambian solo los marcadores de los 6 tests de "Validación del cuerpo":
    - `test_a_missing_body_is_rejected`: AC-004.1;
    - `..._more_than_a_day_away_...`: AC-004.2;
    - `..._one_day_away_..._is_accepted`: AC-004.3;
    - `..._line_break_...`: AC-004.4;
    - `test_an_unknown_pace_status_is_rejected`: AC-004.5;
    - `test_non_integer_calories_are_rejected`: AC-004.6.
    
    Ninguno puede seguir citando `REQ-002 AC-002.1`, `REQ-004 AC-004.1` ni `NFR-001 AC-N001.1`. Sus aserciones no se tocan.

### 5.2 Backend · integración de rutas (necesitan Postgres)

- `test_profile_routes.py`:
  - **AC-001.1, AC-001.2 y AC-001.3**: 400 y `{"error": …}` exactos.
  - **AC-001.4**: se guarda el perfil, se hace el PUT con `weight` igual a 10^400 y el `GET /api/profile` devuelve lo mismo que antes.
  - **AC-001.5**: cuerpo en texto con 5000 dígitos; respuesta 400 `"Los datos del perfil no son válidos"`.
- `test_body_metric_routes.py`:
  - **AC-002.1**: POST con `weight` igual a 10^400; 400 y el listado no cambia.
  - **AC-002.2 y AC-002.3**: los mensajes de grasa y de músculo.
  - **AC-002.4**: perfil en kg con 80, medición de 80, PUT con 10^400, 400. Después, el listado conserva 80 y `GET /api/profile` mantiene el peso.
  - **AC-002.5**: cuerpo en texto con 5000 dígitos y 400 `"Los datos de la medición no son válidos"`.
  - **AC-N003.1**: el test-author pone tildes a **todos los docstrings** del archivo (módulo y tests: "INTEGRACIÓN", "así", "están", "medición", "única", "restricción", "inválido", "válido", etc.). Los comentarios `# ----` de sección no son docstrings y quedan fuera, salvo que se toquen por otro motivo (Q7).
- `test_progress_analysis_routes.py`:
  - **AC-003.1**: perfil, medición y cuerpo `pace_body("on_track", 10**400, 80, "-0,2 kg/sem")`; 400 con `INVALID_MESSAGE`.
  - **Medida de seguridad:** se siembran 2 análisis antes (`seed_analyses(app, 2)`) y se comprueba que `analysis_rows(app) == 2`. Si el arreglo fallara y el cuerpo se aceptara, la ruta respondería 429 y **nunca** llamaría a Anthropic de verdad. La validación va antes del límite, así que el 400 tiene prioridad.
  - **NFR-004:** el marcador de `test_an_invalid_body_returns_bad_request_and_creates_no_row` pasa de `# SDD: NFR-001 AC-N001.1` a `# SDD: 013 REQ-004 AC-004.7`.

### 5.3 Frontend · RTL y unitarios

- **REQ-005 — `MetricsHistory.test.tsx`**. Se reutilizan `renderHistory`, `openDialog`, `deleteMock.mockRejectedValue`, `editName`, `deleteName` y `manyMetrics`:
  - **AC-005.1:** tras el fallo, "Corregir medición del …" de **otra** fila hace que el aviso desaparezca.
  - **AC-005.2:** se renderiza `MetricsHistory` dentro de `QueryClientProvider`, porque `DeleteMetricDialog` usa `useDeleteBodyMetric`. Tras el fallo, `rerender` con una lista nueva hace que el aviso desaparezca. Conviene cubrir dos casos: una medición más, y la lista sin la medición que no se pudo borrar.
  - **AC-005.3:** "Borrar" en otra fila; el aviso desaparece y el diálogo se abre.
  - **AC-005.4:** con `manyMetrics(15)`, "Mostrar más" con la misma lista; el aviso sigue.
- **AC-N002.5 — sustituto del test de límite inferior (Q3).** En `insights.test.ts`, o en `dateUtils.test.ts` dentro del bloque de `periodStart`, se añade un test con `// SDD: REQ-005 AC-005.1` (marcador de la spec 009, sin número, como pide AC-N002.5) y `// SDD: 013 NFR-002 AC-N002.5`. Hace lo mismo que `TrendChart` en su línea 56:
  - reloj falso a las 15:00 del 12 de octubre de 2026;
  - `trendChartData([m("2026-09-11", 80), m("2026-09-12", 79)], "weight", periodStart(todayIsoDate(), 1), id)`;
  - el resultado contiene `2026-09-12` y no `2026-09-11`.
  
  Se borran los 3 tests de `isWithinLastMonths` y su import.
- **AC-N002.1:** los tests de `parseLocalDate` y `todayIsoDate` se **mueven** a `src/lib/dates.test.ts` (Art. 5.5, junto al archivo que prueban), con las mismas aserciones e importando de `@/lib/dates`. `dateUtils.test.ts` conserva los de `formatDate` y `periodStart`.
- **AC-N002.3:** en `calculations.test.ts`, los tres `makeAnswers({...profileFor(X), …} as Record<string, string>)` se sustituyen por un objeto `OnboardingAnswers` sin cast, por ejemplo `{ ...profileFor(H30), dateOfBirth: "1996-10-12" }`. Los valores esperados no cambian.
- **AC-N002.7:** en `insightsView.test.ts`, `view()` y `view011()` usan `buildInsights(...)` y `formatInsights(insights, unit)` sin `as unknown as` ni `as never`. Los tipos `Formatted`, `Extra` y `ExtraText` sobran si ya no se usan.
- **AC-N002.10:** en `BodyMetricsPage.test.tsx`, el stub de `ProgressAnalysis` pasa a pintar algo que depende del perfil, por ejemplo `({ request }) => <div>{request ? "Análisis con contexto" : "Análisis"}</div>`. `request` solo es no nulo con perfil y mediciones.
  - `renderLoaded` espera con `await screen.findByText("Análisis con contexto")`, sin bucles ni `Promise.resolve()`.
  - Los 3 tests de "perfil no disponible" (`getProfile` rechaza) no tienen nada visible que dependa del perfil. Usan un helper aparte, por ejemplo `renderWithoutProfile`, que espera el heading "Constancia" y, dentro de `act`, la promesa rechazada real: `getProfileMock.mock.results[0].value.catch(() => {})`. Tampoco tiene una cuenta fija de microtareas.
  - Ninguna aserción cambia.
- **NFR-005:**
  - `src/lib/testConsoleNoise.test.ts`:
    - **AC-N005.1:** `isTestConsoleNoise` es `true` con el texto completo del aviso de Google.
    - **AC-N005.2:** es `true` con el aviso de Recharts `width(0)`/`height(0)`, y `false` con otro aviso cualquiera (por ejemplo, "Warning: algo distinto").
    
    El verifier lo completa ejecutando `npm test` y buscando los dos textos en la salida.
  - **AC-N005.3** en `GoogleSignInButton.test.tsx`: `vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "")`, `vi.resetModules()` e `import()` dinámico del componente (la constante se lee al importar el módulo). Se renderiza con `QueryClientProvider` y, si `useGoogleLogin` lo pide, `MemoryRouter`. El contenedor queda vacío y `vi.spyOn(console, "warn").mockImplementation(() => {})` recibe el texto del aviso.
- **Tests que recorren el código fuente (AC estáticos).** Siguen el patrón de `src/app/noRetiredSections.test.ts`, con `import.meta.glob(…, { query: "?raw", import: "default", eager: true })`. Van en el nuevo `src/app/sourceCleanup013.test.ts`, que se excluye a sí mismo o construye las cadenas buscadas por partes para no encontrarse:
  - **AC-N002.1:** `dateUtils.ts` no contiene `export {` con `parseLocalDate` ni `todayIsoDate`. Ningún archivo de `src` importa `parseLocalDate` ni `todayIsoDate` de `features/body-metrics/dateUtils`.
  - **AC-N002.2:** `calculations.ts` contiene `MIN_TARGET_KCAL: Record<`.
  - **AC-N002.3:** `calculations.test.ts` no contiene `as Record<string, string>`.
  - **AC-N002.4:** `calculations.ts` usa `heightCmFromAnswers` y no contiene `CM_PER_IN` ni `* 12`.
  - **AC-N002.5:** ningún archivo de `src` (incluidos los tests) contiene `isWithinLastMonths`, y siguen existiendo marcadores `SDD: REQ-005 AC-005.1` en `dateUtils.test.ts` o `insights.test.ts`.
  - **AC-N002.6:** en `TrendChart.tsx`, la línea siguiente al comentario de la tendencia contiene `const isWeight`, y el comentario no precede a `const from`.
  - **AC-N002.7:** ni `insightsView.ts` ni `insightsView.test.ts` contienen `as Insights` ni `as unknown as`.
  - **AC-N002.8:** `analysisRequest.ts` contiene `rate.kind === "ok"` exactamente una vez.
  - **AC-N002.10:** el cuerpo de `renderLoaded` no contiene `Promise.resolve()` ni `for (`.
  - **AC-N003.2 (parte frontend):** `ProgressAnalysis.tsx` y `api.ts` no contienen "tecnicos" ni "se envia".

### 5.4 Backend · test que recorre el código fuente

`backend/tests/test_services/test_source_cleanup_013.py` sigue el patrón de `test_no_catalog_leftovers.py`:
- **AC-N002.9:** en los `.py` de `backend/` que no son tests, el literal `"Usuario no encontrado"` aparece una sola vez, y también aparecen una sola vez `PACE_STATUSES_WITH_RATE =` y la tupla `("on_track", "too_slow", "too_fast", "off_range")`.
- **AC-N003.1:** extrae con `ast` los docstrings de `test_body_metric_routes.py` (módulo y funciones) y busca con `\b` y sin distinguir mayúsculas `unicas`, `restriccion`, `medicion`, `invalido` y `valido`. **No** busca "mediciones", que se escribe sin tilde.
- **AC-N003.2 (parte backend):** `progress_analysis_service.py` no contiene "prolijo".

### 5.5 Comprobaciones con comandos (sin test)

- **AC-N001.1, AC-N001.2 y AC-N001.4:** el verifier ejecuta `pytest`, `npm test`, `npm run lint`, `npx tsc -b`, `npm run build` y `node .claude/sdd/scripts/ruff-new.mjs`. La trazabilidad queda en `verify-report.md`.
- **AC-N001.3:** el reviewer compara el diff de los tests con `main`: no se quitan ni debilitan aserciones (salvo las de `isWithinLastMonths`) y no hay `skip`, `only` ni `todo`.
- **AC-N003.3:** el reviewer revisa sobre el diff las líneas de comentario y docstring tocadas.
- **NFR-006 (AC-N006.1, AC-N006.2 y AC-N006.3):** lo escribe el doc-keeper en la etapa docs, que va **después** de verify. Un test de pytest o Vitest sobre `CLAUDE.md` estaría en rojo durante verify, así que estos AC se comprueban en la etapa docs (longitud de la fila, presencia de cada dato y título de la lista) y el reviewer los confirma en close.

### 5.6 Rojo esperado y propuesta de excepción del red check

**Darán rojo legítimo:**
- AC-001.1 a AC-001.4, AC-002.1 a AC-002.4 y AC-003.1 a AC-003.3 (hoy 500 en rutas o `OverflowError` en unitarios);
- AC-005.1 y AC-005.2;
- AC-N002.1, AC-N002.2, AC-N002.4, AC-N002.5 (barrido), AC-N002.6, AC-N002.7, AC-N002.8 y AC-N002.9;
- AC-N003.2;
- AC-N005.1 y AC-N005.2 (andamiaje que lanza `not implemented`).

**Estarán en verde en el red check, porque describen un comportamiento que se conserva o son cambios solo de tests:**
- AC-001.5 y AC-002.5;
- REQ-004 (AC-004.1 a AC-004.7);
- AC-005.3 y AC-005.4;
- AC-N002.3 y AC-N002.10 (el test-author los arregla en su propia etapa);
- el sustituto de límite inferior de AC-N002.5;
- AC-N003.1 (docstrings de un archivo de test);
- AC-N004.1;
- AC-N005.3.

Se propone registrarlos en `red_check_exception` de `state.json`, como en la spec 012. Lo decide el usuario en el gate del plan. El verifier debe rechazar cualquier verde fuera de esa lista.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Un test de ruta con un cuerpo válido por error llega a Anthropic de verdad | Baja | Alto (coste y test no determinista) | Los tests de REQ-003 en rutas siembran 2 análisis (cuota agotada), así que una regresión da 429 y no llama a la IA. Los casos que llegan al modelo solo están en unitarios con `FakeLLMClient` |
| El test-author intenta serializar el entero de 5000 dígitos con `json=` y el test falla por `ValueError` del propio test, no por el comportamiento | Media | Medio (rojo ilegítimo) | §5 explica que debe enviarse como texto con `data=` y la cifra construida como cadena |
| El aviso de borrado desaparece por un refetch sin cambios o no desaparece cuando la lista sí cambia | Baja | Bajo | Se compara por referencia sobre los datos de TanStack Query (*structural sharing*) y `BodyMetricsPage` pasa `data` sin transformar. AC-005.2 y AC-005.4 cubren ambos sentidos |
| El texto real del aviso de Recharts no encaja con el patrón y sigue apareciendo en la salida | Media | Bajo | El patrón busca la parte estable ("of chart should be greater than 0"). El implementer comprueba la salida real de `npm test`, y el verifier busca ambos textos en la salida (AC-N005.1/2) |
| `vite.config.ts` no compila con `tsc -b` al importar `src/lib/testConsoleNoise.ts` (`module: nodenext`) | Baja | Medio | El import lleva la extensión `.ts` (`allowImportingTsExtensions` está activo) y el módulo es una función pura sin tipos del DOM. El verifier ejecuta `tsc -b` y `build` |
| `renderLoaded` sin la espera actual vuelve inestables los tests de indicadores | Media | Medio | Espera a un elemento que solo aparece cuando el perfil ha cargado (stub de `ProgressAnalysis` con `request`). El caso de perfil rechazado usa un helper aparte que espera la promesa real dentro de `act` |

## 7. Cumplimiento de la constitución

- **Art. 1:** el cambio tiene spec aprobada. La fila de `CLAUDE.md` va por la etapa docs (ADR-0013).
- **Art. 2:**
  - El implementer solo toca producción: `backend/services`, `frontend/src` (sin tests) y `frontend/vite.config.ts`.
  - El test-author toca los tests, incluidos los marcadores, los docstrings de `test_body_metric_routes.py`, `renderLoaded` y los casts de tests.
  - El doc-keeper toca `CLAUDE.md`.
- **Art. 4:**
  - Todos los REQ y NFR están en §4.
  - Cada AC tiene un test con `SDD: 013` (§5), salvo los AC que se comprueban con comandos (AC-N001.1, AC-N001.2 y AC-N001.4), los que revisa el reviewer sobre el diff (AC-N001.3 y AC-N003.3) y NFR-006, que se escribe después de verify (§5.5). El último punto se señala al usuario.
  - El sustituto de AC-N002.5 conserva además el marcador antiguo de la spec 009, como pide la spec.
- **Art. 5:**
  - Hay TDD con rojo legítimo para todo lo que cambia (§5.6).
  - Solo se borran los tests de `isWithinLastMonths`, que autoriza la spec (Q3), y su caso de límite se sustituye.
  - No hay `skip`, `only` ni `todo`.
  - No se usan `unittest.mock` ni `monkeypatch`.
  - En frontend, `vi.spyOn(console, "warn")` (AC-N005.3) observa una llamada; no simula la red.
- **Art. 6:**
  - Se respetan las capas: la validación sigue en `services/`, y las rutas no cambian.
  - Los errores siguen siendo `ValidationError` traducidos por `error_handlers.py`.
  - No hay cambios de modelo, así que no hace falta migración.
  - El módulo nuevo `number_validation.py` debe pasar ruff sin violaciones nuevas.
  - En frontend se mantiene la organización por feature.
  - `testConsoleNoise.ts` vive en `src/lib/` porque lo consume la configuración de Vitest. Ningún código de la app lo importa, así que no entra en el bundle.
- **Art. 7:** no hay endpoints nuevos. Se refuerza Art. 7.3: un input externo enorme da 400 en lugar de 500.
- **"DEBERÍA" no cumplidos:** ninguno.

## 8. ADRs

Ninguna. Los helpers compartidos y el filtro de la salida de Vitest son decisiones locales que no cambian la arquitectura.
