# Plan 020 — Seguimiento de métricas corporales y configuración de producción

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-18)
- **Ámbitos:** `backend`, `frontend`

## 1. Resumen de la solución

- **Frontend (bloque A):** el alta de una medición se separa de su relectura. `useCreateBodyMetric` devuelve
  `{ metric, refreshed }`: la mutación solo falla si falla el `POST`; la relectura (`invalidateQueries` con
  `throwOnError`) se informa en `refreshed`. Métricas y «Datos físicos» muestran un aviso común (`RefreshFailedNotice`,
  rol `alert`, botón «Reintentar») que reintenta solo la relectura. Las pantallas distinguen el error de la carga inicial
  (`isLoadingError`, como hoy) del de una relectura (se conservan los datos). El Historial recibe una petición de
  «revelar fecha» y se despliega de 10 en 10 con una función pura.
- **Backend (bloque B):** reloj por app (`utils/clock.py`): `AdjustableClock` solo con `TESTING`, `utc_now` real en el
  resto; las rutas lo pasan por constructor a los servicios (Art. P2.2). `create_app` acepta `config_overrides` (solo
  código) y valida `FRONTEND_BASE_URL` en producción antes de inicializar extensiones. REQ-007 se cubre con tests de
  integración que arrancan la app con `MAIL_BACKEND=resend` y sustituyen solo la función de red del transporte por el
  `FakeOpener` existente.
- Sin migraciones, sin dependencias nuevas, sin cambios de contrato HTTP.

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | utils | `backend/utils/clock.py` | — | Reloj por app fijable solo en pruebas (REQ-005, NFR-001) |
| backend | app / config | — | `backend/app.py`, `backend/config.py` | `config_overrides`, `install_clock`, validación de `FRONTEND_BASE_URL` (REQ-006) |
| backend | services | — | `backend/services/profile_service.py`, `backend/services/password_reset_service.py` | `utc_now` pasa a importarse de `utils/clock.py` (se conserva el nombre en ambos módulos; Art. P2.5) |
| backend | routes | — | `backend/routes/body_metric_routes.py`, `backend/routes/auth_routes.py`, `backend/routes/profile_routes.py` | `_build_*_service()` pasan `clock=current_clock()` (REQ-005) |
| backend | tests | `backend/tests/test_services/test_clock.py`, `backend/tests/test_services/test_production_config.py`, `backend/tests/test_routes/test_fixed_clock_routes.py`, `backend/tests/test_routes/test_resend_email_routes.py` | `backend/tests/conftest.py`, `backend/tests/test_routes/test_body_metric_routes.py`, `backend/tests/test_routes/test_auth_routes.py` | Fixtures `app_clock`/`make_app`; tests nuevos; conversión de tests de límites de fecha a fechas absolutas (Q5) |
| frontend | body-metrics / hooks | — | `frontend/src/features/body-metrics/hooks.ts` | `refreshMetricsAndProfile`, `useCreateBodyMetric` con `refreshed`, `useRefreshMetricsAndProfile` (REQ-001, REQ-002) |
| frontend | body-metrics / lógica | `frontend/src/features/body-metrics/historyReveal.ts` | — | Cálculo puro de filas visibles para revelar una fecha (REQ-003) |
| frontend | body-metrics / componentes | `frontend/src/features/body-metrics/components/RefreshFailedNotice.tsx` | `frontend/src/features/body-metrics/components/RegisterMetricDialog.tsx`, `frontend/src/features/body-metrics/components/MetricsHistory.tsx` | Aviso común; `onSaved`; despliegue del Historial |
| frontend | body-metrics / página | — | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx` | Aviso bajo «Registrar medición», `isLoadingError`, petición de revelar (REQ-001, REQ-003) |
| frontend | profile | — | `frontend/src/features/profile/components/PhysicalDataForm.tsx`, `frontend/src/features/profile/pages/ProfilePage.tsx` | Aviso y reintento (REQ-002); `ProfileLoadError` solo en la carga inicial |
| frontend | tests | `frontend/src/test/fakeMetricsServer.ts`, `frontend/src/features/body-metrics/historyReveal.test.ts`, `frontend/src/features/body-metrics/components/RefreshFailedNotice.test.tsx`, `frontend/src/features/body-metrics/pages/BodyMetricsPage.refresh.test.tsx`, `frontend/src/features/body-metrics/pages/BodyMetricsPage.sync.test.tsx`, `frontend/src/features/profile/components/PhysicalDataForm.refresh.test.tsx` | `frontend/src/features/body-metrics/components/MetricsHistory.test.tsx` (añadir) | REQ-001 a REQ-004 |
| docs | ADR | `docs/sdd/decisions/ADR-0028-reloj-de-la-app-y-configuracion-de-produccion.md` | `docs/sdd/decisions/README.md` | Decisión nueva (sección 8) |

## 3. Diseño

### 3.1 Datos y migraciones

No aplica: no cambia ningún modelo, tabla ni dato. Paso manual en producción (lo documenta el `doc-keeper` en
`docs/deploy-runbook.md` y en `CLAUDE.md`, Art. P4): antes del merge, comprobar que el `backend/.env` de EC2 tiene
`FRONTEND_BASE_URL=https://fitnerd.betofallas.dev`; si no, el contenedor no arranca y falla la comprobación de
`/api/health` del CD. `backend/.env.example` mantiene `FRONTEND_BASE_URL=http://localhost:5173` (desarrollo) con un
comentario de que en producción es obligatoria y con `https://`.

### 3.2 Contratos e interfaces

**HTTP:** ningún endpoint cambia (spec §6).

**Backend — `backend/utils/clock.py` (nuevo; los tests lo importan):**

```python
from collections.abc import Callable
from datetime import datetime
from flask import Flask

CLOCK_EXTENSION_KEY = "fitnerd.clock"

def utc_now() -> datetime:
    """Instante actual en UTC, sin zona (naive), como los servicios actuales."""

class AdjustableClock:
    """Reloj de la configuración de pruebas: sin instante fijado delega en `real_clock`."""
    def __init__(self, real_clock: Callable[[], datetime] = utc_now) -> None: ...
    def __call__(self) -> datetime: ...
    def set(self, instant: datetime) -> None: ...   # aware -> se pasa a UTC y se quita tzinfo; naive = UTC
    def reset(self) -> None: ...

def install_clock(app: Flask) -> None:
    """app.extensions[CLOCK_EXTENSION_KEY] = AdjustableClock() si app.config["TESTING"]; si no, utc_now."""

def get_app_clock(app: Flask) -> Callable[[], datetime]: ...
def current_clock() -> Callable[[], datetime]:
    """get_app_clock(current_app)."""
```

Esqueleto (Art. P1 backend 5): cuerpos con `raise NotImplementedError("not implemented")`; `AdjustableClock.__init__`
guarda `real_clock` y deja `self.instant = None` sin lanzar.

**Backend — `backend/config.py` (símbolos nuevos que los tests importan):**

```python
DEFAULT_FRONTEND_BASE_URL = "http://localhost:5173"
FRONTEND_BASE_URL_REQUIRED_MESSAGE = (
    "FRONTEND_BASE_URL es obligatoria en producción y debe empezar por https://"
)

def resolve_frontend_base_url(value: str | None, *, required: bool) -> str: ...
```

- `Config.FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")` (sin valor por defecto: `None` si falta) y
  `Config.FRONTEND_BASE_URL_REQUIRED = False`; `ProductionConfig.FRONTEND_BASE_URL_REQUIRED = True`;
  `TestingConfig.FRONTEND_BASE_URL = "http://localhost:5173"` (sin cambios).
- Esqueleto: `resolve_frontend_base_url` lanza `NotImplementedError("not implemented")`; las constantes llevan su valor.

**Backend — `backend/app.py` (firma cambiada):**

```python
def create_app(config_name: str | None = None,
               config_overrides: Mapping[str, Any] | None = None) -> Flask: ...
```

Orden: `from_object(config_by_name[...])` → `app.config.update(config_overrides or {})` →
`app.config["FRONTEND_BASE_URL"] = resolve_frontend_base_url(app.config.get("FRONTEND_BASE_URL"),
required=app.config.get("FRONTEND_BASE_URL_REQUIRED", False))` → `install_clock(app)` → ProxyFix y extensiones (sin
cambios). En el paso de esqueleto, el `implementer` añade el parámetro `config_overrides` y su `app.config.update(...)`
(fontanería que necesitan los fixtures, no comportamiento de ningún AC); la validación y el reloj llegan en `implement`.

**Errores de arranque:** `ValueError(FRONTEND_BASE_URL_REQUIRED_MESSAGE)` (mismo tipo que «MAIL_BACKEND desconocido:
…», que no cambia). No pasan por `error_handlers` porque no hay petición.

**Frontend — `frontend/src/features/body-metrics/hooks.ts`:**

```ts
export type CreateMetricResult = { metric: BodyMetric; refreshed: boolean }

/** Relee mediciones y perfil activos; true si ambas lecturas terminan bien. Nunca rechaza. */
export function refreshMetricsAndProfile(queryClient: QueryClient): Promise<boolean>

export function useCreateBodyMetric(): UseMutationResult<CreateMetricResult, Error, CreateBodyMetricPayload>
export function useRefreshMetricsAndProfile(): UseMutationResult<boolean, Error, void>
```

**Frontend — `frontend/src/features/body-metrics/historyReveal.ts` (nuevo):**

```ts
export const HISTORY_PAGE_SIZE = 10
export type RevealRequest = { date: string; seq: number }

/** Filas visibles necesarias para que `date` lo sea, creciendo en bloques de `pageSize`; nunca menos que `visibleCount`. */
export function visibleCountToReveal(
  sortedDates: readonly string[],  // fechas ISO del Historial, de la más reciente a la más antigua
  date: string,
  visibleCount: number,
  pageSize?: number                // por defecto HISTORY_PAGE_SIZE
): number
```

**Frontend — `frontend/src/features/body-metrics/components/RefreshFailedNotice.tsx` (nuevo):**

```tsx
export const METRICS_REFRESH_FAILED_MESSAGE =
  "Guardamos tu medición, pero no pudimos actualizar los datos de la pantalla."
export const PROFILE_REFRESH_FAILED_MESSAGE =
  "Guardamos tus cambios, pero no pudimos actualizar los datos de la pantalla."

export function RefreshFailedNotice(props: {
  message: string
  onRetry: () => void
  retrying: boolean
}): ReactElement
```

**Frontend — props cambiadas:**

- `RegisterMetricDialog`: nueva prop opcional
  `onSaved?: (result: MetricRegistrationResult) => void`, con
  `export type MetricRegistrationResult = { recordedAt: string; refreshed: boolean }` exportado desde
  `RegisterMetricDialog.tsx`. Se llama tras un registro con éxito, antes de `onClose` (que se sigue llamando al cancelar
  y al guardar, como hoy).
- `MetricsHistory`: nueva prop opcional `reveal?: RevealRequest | null`.

Esqueletos frontend (Art. P1 frontend 5): `throw new Error("not implemented");` con parámetros prefijados con `_` en
`refreshMetricsAndProfile`, `visibleCountToReveal` y `RefreshFailedNotice`; las constantes llevan su valor; las props
nuevas se declaran en los tipos sin usarse. `useCreateBodyMetric` y `useRefreshMetricsAndProfile` no se tocan en el
esqueleto más allá de declarar `useRefreshMetricsAndProfile` (que lanza).

### 3.3 Lógica

**Backend**

- `AdjustableClock.__call__`: `self.instant` si está fijado; si no, `self.real_clock()`. `set` normaliza: si
  `instant.tzinfo` no es `None`, `instant.astimezone(timezone.utc).replace(tzinfo=None)`. El instante no avanza solo
  (AC-005.9). `reset` vuelve al reloj real (AC-005.6).
- `install_clock` decide **solo** por `app.config.get("TESTING")` (constante de `TestingConfig`, no leída del entorno) →
  NFR-001. En desarrollo y producción el reloj es la función `utc_now`, que no tiene `set`.
- `utc_now` se define en `utils/clock.py`; `services/profile_service.py` y `services/password_reset_service.py` lo
  importan de ahí (los módulos que hoy hacen `from services.profile_service import utc_now` siguen funcionando).
- Rutas: `_build_body_metric_service`, `_build_progress_analysis_service`, `_build_auth_service`,
  `_build_password_reset_service` y `_build_profile_service` pasan `clock=current_clock()`. Cubre: fecha por defecto y
  límites de mediciones (`BodyMetricService`), «hoy» del análisis (`ProgressAnalysisService`), edad en el registro
  (`AuthService`), edad del perfil y `onboarding_completed_at` (`ProfileService`), cooldown, ventana por IP y caducidad
  del enlace (`PasswordResetService`). No cambia ninguna regla.
- Fuera del reloj fijado (sin cambios, ADR-0028): caducidad del JWT (`utils/jwt_utils.py`), `created_at` puesto por la
  base y la ventana de límite del análisis (`progress_analysis_repository`, `func.now()`).
- `resolve_frontend_base_url(value, required)`:
  - `required=False`: `DEFAULT_FRONTEND_BASE_URL` si `value is None`; si no, `value` tal cual (desarrollo sin cambios,
    AC-006.5).
  - `required=True`: `v = (value or "").strip()`; si `v` está vacío o no empieza por `https://` →
    `ValueError(FRONTEND_BASE_URL_REQUIRED_MESSAGE)`; si no, devuelve `v` (AC-006.1 a AC-006.4).
- REQ-007 reutiliza sin cambios `EmailSender`, `ResendTransport` (cabeceras, cuerpo, User-Agent, recorte del log) y
  `PasswordResetService` (503 y sin fila con token si el envío falla). Solo se añaden tests.

**Frontend**

- `refreshMetricsAndProfile`: `Promise.all` de `queryClient.invalidateQueries({ queryKey: bodyMetricsKeys.list },
  { throwOnError: true })` y lo mismo con `profileKeys.detail`; `true` si se resuelve, `false` si rechaza. Las consultas
  inactivas solo se marcan obsoletas (no fallan).
- `useCreateBodyMetric`: `mutationFn = async (payload) => { const metric = await createBodyMetric(payload); const
  refreshed = await refreshMetricsAndProfile(queryClient); return { metric, refreshed } }`. La mutación sigue pendiente
  hasta acabar la relectura (como hoy) y solo pasa a error si falla el `POST`. `useUpdateBodyMetric` y
  `useDeleteBodyMetric` no cambian (Q1).
- `useRefreshMetricsAndProfile`: `useMutation({ mutationFn: () => refreshMetricsAndProfile(queryClient) })`.
- `visibleCountToReveal`: `i = sortedDates.indexOf(date)`; si `i < 0` o `i < visibleCount` → `visibleCount`; si no →
  `visibleCount + Math.ceil((i + 1 - visibleCount) / pageSize) * pageSize`. Nunca devuelve menos que `visibleCount`
  (AC-003.4).

### 3.4 Interfaz de usuario

**`RefreshFailedNotice`:** contenedor `role="alert"` con el mensaje y un `Button` «Reintentar» (`type="button"`,
`variant="outline"`, `size="sm"`), deshabilitado mientras `retrying`; el nombre accesible es siempre «Reintentar». Sin
temporizador: no desaparece solo (AC-001.8, AC-002.10).

**Métricas (`BodyMetricsPage`):**
- Estado nuevo: `refreshFailed: boolean` y `reveal: RevealRequest | null` (con `seq` creciente).
- `RegisterMetricDialog onSaved={({ recordedAt, refreshed }) => { setRefreshFailed(!refreshed); setReveal({ date:
  recordedAt, seq: prev + 1 }) }}`; `recordedAt` es la fecha enviada en el formulario (`values.date`).
- El aviso (`METRICS_REFRESH_FAILED_MESSAGE`) se pinta justo después del botón «Registrar medición» y antes de
  cualquier otro bloque (AC-001.9). «Reintentar» → `refresh.mutateAsync()`; si devuelve `true`, `setRefreshFailed(false)`.
- Las condiciones que hoy usan `isError` de `useBodyMetrics` (botón, mensaje de error, estado vacío) pasan a
  `isLoadingError`: el error de la carga inicial se ve igual que hoy; tras un error de relectura se conservan los datos
  anteriores y el botón (AC-001.2, AC-001.4).
- `MetricsHistory reveal={reveal}`.

**`MetricsHistory`:** `PAGE_SIZE` pasa a importarse como `HISTORY_PAGE_SIZE`. Guarda el `seq` de la última petición
atendida; mientras haya una petición pendiente y su fecha esté en la lista ordenada, ajusta
`visibleCount = visibleCountToReveal(...)` y la marca como atendida (patrón de ajuste de estado durante el render con el
valor previo, o efecto, sin warnings nuevos de oxlint). Si la fecha aún no está (relectura fallida), la petición queda
pendiente y se atiende cuando llegue la lista nueva tras «Reintentar».

**«Datos físicos» (`PhysicalDataForm`):**
- Estado nuevo: `refreshFailed: boolean` y `pendingFinish: { values: PhysicalDataFormValues; hadProfile: boolean } | null`.
- El paso 3 actual (cálculo de `later`, `next`, `setSaved`, `form.reset`, «Cambios guardados» o aviso de la medición
  posterior) se extrae a una función local `finishSave(values, hadProfile)` sin cambios de comportamiento.
- Tras `createMetric.mutateAsync` con `refreshed === false`: `setSaved(values)`, `form.reset(values)` (formulario sin
  cambios pendientes, con lo escrito; AC-002.2), `setJustSaved(false)`, `setLaterDate(null)`, `setRefreshFailed(true)`,
  `setPendingFinish({ values, hadProfile })`.
- «Reintentar» → `refresh.mutateAsync()`; si `true`: `setRefreshFailed(false)` y `finishSave(pendingFinish.values,
  pendingFinish.hadProfile)` (AC-002.3, AC-002.4); si `false`, nada cambia (AC-002.5). No se llama a `saveProfile` ni a
  `createBodyMetric` (AC-002.6).
- Un guardado sin cambio de peso ni composición no relee y termina como hoy (AC-002.9). El aviso solo desaparece con una
  relectura correcta (reintento o un registro posterior cuya relectura termine bien); mientras está visible ocupa el
  lugar de «Cambios guardados», que no se muestra a la vez.
- Se pinta en la fila de botones, en el lugar de «Cambios guardados», con `PROFILE_REFRESH_FAILED_MESSAGE`.

**`ProfilePage`:** `ProfileLoadError` pasa a depender de `isLoadingError` del perfil: el error de la carga inicial se ve
como hoy y un fallo de la relectura del perfil (AC-002.8) no muestra además el error de carga sobre el formulario.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `hooks.ts` (`refreshMetricsAndProfile`, `useCreateBodyMetric` con `refreshed`, `useRefreshMetricsAndProfile`), `RegisterMetricDialog.tsx` (`onSaved`), `RefreshFailedNotice.tsx`, `BodyMetricsPage.tsx` (aviso, `isLoadingError`) |
| REQ-002 | `hooks.ts`, `RefreshFailedNotice.tsx`, `PhysicalDataForm.tsx` (`refreshFailed`, `pendingFinish`, `finishSave`), `ProfilePage.tsx` (`isLoadingError`) |
| REQ-003 | `historyReveal.ts` (`visibleCountToReveal`), `MetricsHistory.tsx` (`reveal`), `BodyMetricsPage.tsx` (petición tras `onSaved`) |
| REQ-004 | Sin código de producción nuevo: `frontend/src/test/fakeMetricsServer.ts` + `BodyMetricsPage.sync.test.tsx` (AC-004.1 a AC-004.3) y `test_body_metric_routes.py` con instante fijado (AC-004.4) |
| REQ-005 | `utils/clock.py`, `app.py` (`install_clock`), `_build_*_service()` de `body_metric_routes.py`, `auth_routes.py` y `profile_routes.py`; fixtures de `conftest.py` |
| REQ-006 | `config.py` (`resolve_frontend_base_url`, `FRONTEND_BASE_URL_REQUIRED`), `app.py` (validación antes de las extensiones, `config_overrides`) |
| REQ-007 | Código existente (`utils/email_sender.py`, `services/password_reset_service.py`); `create_app(config_overrides=...)` para arrancar con `resend`; tests en `test_resend_email_routes.py` |
| NFR-001 | `install_clock` decide por `TESTING`; en desarrollo y producción el reloj es `utc_now` (sin `set`); ninguna ruta lee fecha de la petición |
| NFR-002 | `FakeOpener` sustituye a `urlopen` en el transporte antes de cualquier petición; en el frontend, red simulada en `api.ts` con el servidor de prueba con estado |

## 5. Estrategia de pruebas

### backend (pytest, Postgres de prueba; Art. P1 backend)

**Fixtures nuevos en `backend/tests/conftest.py`:**
- `app_clock(app)`: devuelve `get_app_clock(app)` (un `AdjustableClock`). Fixture autouse `_reset_app_clock(app)`: llama
  a `reset()` antes y después de cada test, para que un instante fijado no se filtre.
- `make_app()`: fábrica `make_app(config_name, **overrides)` que llama a `create_app(config_name, overrides)` con
  valores por defecto seguros: `SQLALCHEMY_DATABASE_URI` = la de la app de tests, `LANGFUSE_PUBLIC_KEY`/`SECRET_KEY` =
  `None` y `MAIL_BACKEND="memory"` salvo que el test lo sobrescriba. Necesario porque en CI no existen
  `DEV_DATABASE_URL` ni `PROD_DATABASE_URL`, y porque el `.env` local puede traer claves reales. Las tablas ya existen
  (las creó la app de sesión) y `_clean_database` limpia las filas.
- Sin `monkeypatch` ni `unittest.mock`: los «sin variable» se expresan con `FRONTEND_BASE_URL=None` en los overrides
  (es lo que devuelve `os.getenv` cuando falta) y la red con `email_sender.transport.opener = FakeOpener(...)`
  (sustitución de atributo, como ya hace `conftest` con `transport`). `caplog` (fixture estándar de pytest) se usa para
  leer el log.

**Unitarios:**
- `test_services/test_clock.py` (REQ-005, NFR-001): `AdjustableClock` sin fijar delega en un `FakeClock` inyectado;
  `set` con naive y con aware (convierte a UTC); no avanza entre llamadas; `reset` vuelve al real; `install_clock` sobre
  `Flask(__name__)` con `TESTING=True` instala un `AdjustableClock` y con `TESTING=False` instala `utc_now` (sin `set`).
- `test_services/test_production_config.py` (REQ-006): `resolve_frontend_base_url` con `None`, `""`, `"   "`,
  `"http://localhost:5173"` y `required=True` → `ValueError` con el mensaje exacto (AC-006.1–006.3); válido → el valor
  (AC-006.4); `required=False` con `None` → `http://localhost:5173` (AC-006.5). Integración de `create_app` con
  `make_app`: `production` sin variable / vacía / espacios / `http://…` → `pytest.raises(ValueError, match=…)`;
  `production` con `https://fitnerd.betofallas.dev` → `app.config["FRONTEND_BASE_URL"]` igual; `development` con
  `FRONTEND_BASE_URL=None` → `http://localhost:5173`; `testing` → `http://localhost:5173` (AC-006.6, también con
  `create_app("testing")` directo, sin overrides, porque la clase fija el valor).

**Integración (`client` y apps de `make_app`):**
- `test_routes/test_fixed_clock_routes.py` (REQ-005, NFR-001): AC-005.1–005.3 y AC-005.5 (`POST /api/body-metrics`
  con `app_clock.set(...)`), AC-005.4 (registro con `date_of_birth` 2012-10-12 / 2012-10-13), AC-005.6 (sin fijar →
  `datetime.now(timezone.utc).date()` del momento del test), AC-005.7/005.8 (forgot-password a 12:00:00; token leído de
  `email_sender.transport.outbox`; reset a 12:04:59 → 200 y a 12:05:00 → 400), AC-005.9 (dos `POST` sin fecha → la
  misma fecha y una sola medición). NFR-001: AC-N001.1 con apps `production` (con `FRONTEND_BASE_URL` válida) y
  `development` de `make_app` → `recorded_at` = fecha UTC real; AC-N001.2 con app `production`, cuerpo con
  `"now": "2020-01-01T00:00:00Z"` y cabeceras `Date`/`X-Now` → fecha real. En ambos, el usuario se registra con
  `/api/auth/register` de esa misma app.
- `test_routes/test_body_metric_routes.py` (añadir): AC-004.4 con `app_clock.set(2026-10-12 12:00)`, perfil kg 78,
  medición 2026-10-01 de 78, registros 2026-10-05 (77) y 2026-10-03 (76), lectura de `/api/profile` tras cada uno →
  `weight: 77` ambas veces.
- `test_routes/test_resend_email_routes.py` (REQ-007, NFR-002): `make_app("testing", MAIL_BACKEND="resend",
  RESEND_API_KEY="re_test_key", MAIL_FROM="fitnerd <no-reply@fitnerd.betofallas.dev>",
  FRONTEND_BASE_URL="https://fitnerd.betofallas.dev")` e inmediatamente `opener = FakeOpener(...)` asignado a
  `email_sender.transport.opener` (y comprobación de que el transporte es `ResendTransport`) antes de la primera
  petición. AC-007.1/007.2 (una sola petición; método, URL, `Authorization`, `User-Agent`, cuerpo JSON con `from`, `to`,
  `subject` y enlace `https://fitnerd.betofallas.dev/reset-password?token=` en `text` y `html`), AC-007.3 (token del
  cuerpo interceptado → reset 200), AC-007.4 (`FakeOpener(status=403)` → 503 con el mensaje, `"re_test_key" not in
  caplog.text`, ninguna `PasswordResetRequest` con `token_hash` para el usuario), AC-007.5 (`RESEND_API_KEY=None` → 503
  y `opener.requests == []`), AC-007.6 (correo sin cuenta → 200 y sin peticiones), AC-007.7 (`MAIL_BACKEND="console"`,
  `caplog.set_level(logging.INFO)` → el log contiene «Restablece tu contraseña de fitnerd», transporte `ConsoleTransport`),
  AC-007.8 (`MAIL_BACKEND="pigeon"` → `ValueError` «MAIL_BACKEND desconocido: pigeon»). AC-N002.1: en cada test de
  REQ-007 que envía, las peticiones quedan en `opener.requests` (el `FakeOpener` nunca toca la red).
- **Conversión a fechas absolutas (Q5, sin debilitar):** en `test_body_metric_routes.py`, los tests con marcador
  `016 REQ-005 AC-005.1`, `AC-005.2` y `AC-005.3` fijan `app_clock` en 2026-10-12 12:00 y usan `2025-10-11`,
  `2025-10-10` y `2026-10-14`; en `test_auth_routes.py`, los de `018 REQ-005 AC-005.4` a `AC-005.8` fijan el mismo
  instante y usan fechas absolutas (mañana = 2026-10-13; 14 años = 2012-10-12/2012-10-13; 101 años = 1925-10-12;
  100 años = 1925-10-13). Conservan su marcador y sus aserciones. El resto de tests no cambia.

### frontend (Vitest + Testing Library; Art. P1 frontend)

Red simulada con `vi.mock("@/features/body-metrics/api")`, `vi.mock("@/features/profile/api")` y
`vi.mock("@/features/auth/api")`, como en `BodyMetricsPage.register.test.tsx`; `QueryClient` con `retry: false`; fecha
fija con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 12, 12))`.

- `historyReveal.test.ts` (unitario, REQ-003): fecha ya visible → igual; índice 25 con 10 visibles → 30; índice 16 → 20;
  fecha ausente → igual; con 30 visibles e índice 0 → 30.
- `RefreshFailedNotice.test.tsx`: rol `alert`, texto, botón «Reintentar» que llama a `onRetry`, deshabilitado con
  `retrying` (AC-001.6, AC-002.7).
- `BodyMetricsPage.refresh.test.tsx` (REQ-001 y REQ-003 a nivel de página): `listMock.mockResolvedValueOnce(inicial)
  .mockRejectedValueOnce(new ApiError(...))` para AC-001.1–001.4, `getProfileMock` que falla en la segunda llamada para
  AC-001.5, éxito para AC-001.7; AC-001.8 con `vi.advanceTimersByTime(60_000)` (activando el falseo de `setTimeout`
  solo en ese test) o equivalente; AC-001.9 con `compareDocumentPosition` entre botón, aviso y encabezado «Historial».
  REQ-003: 25 o 35 mediciones generadas por día; AC-003.1–003.4 cuentan filas (`getAllByRole("row").slice(1)`) y
  «Mostrar más»; AC-003.5 con `createMock.mockRejectedValue` (diálogo abierto, 10 filas).
- `MetricsHistory.test.tsx` (añadir): `reveal` con fecha pendiente que llega en una lista posterior → se despliega
  entonces; dos peticiones con la misma fecha y distinto `seq`.
- `PhysicalDataForm.refresh.test.tsx` (REQ-002; monta `ProfilePage` como `ProfilePage.test.tsx`): AC-002.1–002.10 con
  `saveProfile`/`createBodyMetric` que resuelven y `listBodyMetrics`/`getProfile` que fallan en la relectura; AC-002.6
  comprueba que tras «Reintentar» `saveProfile` y `createBodyMetric` siguen con una sola llamada; AC-002.9 cambia solo
  la meta.
- `BodyMetricsPage.sync.test.tsx` (REQ-004, NFR-002): usa el **servidor de prueba con estado**
  `frontend/src/test/fakeMetricsServer.ts` (doble nuevo, lo escribe el `test-author`):

  ```ts
  export type FakeMetricsServer = {
    listBodyMetrics(): Promise<BodyMetric[]>
    createBodyMetric(payload: CreateBodyMetricPayload): Promise<BodyMetric>
    getProfile(): Promise<ProfileResponse>
    saveProfile(payload: SaveProfilePayload): Promise<ProfileResponse>
  }
  export function createFakeMetricsServer(initial: {
    profile: ProfileResponse
    metrics: BodyMetric[]
  }): FakeMetricsServer
  ```

  Guarda mediciones (una por fecha, combinando como el servidor) y aplica la regla de `_sync_profile_weight`: última
  medición con peso por **fecha**, tolerancia 0,05 kg, conversión a lb con `KG_PER_LB = 0.45359237`, redondeo a 0,1
  *half-up* y límites 30–300 kg / 66–660 lb. Se conecta con `listMock.mockImplementation(server.listBodyMetrics)`, etc.
  El peso esperado nunca se fija en una respuesta simulada. AC-004.1 (perfil «Peso» 77 y home «77 kg»), AC-004.2
  (sigue 78), AC-004.3 (perfil en lb y medición inicial de 78 kg; se registra 162 lb, que `registrationPayload` envía
  como 73,5 kg; el servidor de prueba lo devuelve como 162,0 lb y se espera «Peso» 162 con la unidad lb).

**Cobertura de AC:** todos los AC de REQ-001 a REQ-007, NFR-001 y NFR-002 tienen un test asignado arriba; los marcadores
llevan el número de spec (`# SDD: 020 REQ-005 AC-005.1`, `// SDD: 020 REQ-001 AC-001.1`; Art. P1.1).

**Entorno:** Postgres de prueba (`docker compose up -d postgres redis`, puerto 5433) y claves JWT para el backend;
`npm ci` para el frontend. Ningún test llama a Resend ni a otro servicio externo.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El servidor de prueba con estado se aparta de la regla real de conversión kg/lb y AC-004.3 pasa en el frontend sin reflejar el servidor | Baja | Medio | `fakeMetricsServer` usa las mismas constantes y redondeo que `_sync_profile_weight` (`KG_PER_LB`, 0,1 *half-up*); AC-004.3 usa 162 lb, que va y vuelve sin pérdida (73,5 kg ↔ 162,0 lb). La desviación de 0,1 lb con otros valores sigue en el backlog |
| Falta `FRONTEND_BASE_URL` (o no es `https://`) en el `.env` de EC2: el contenedor no arranca tras el CD | Baja | Alto (API caída hasta corregir) | Paso manual documentado antes del merge (runbook, `CLAUDE.md`); la comprobación de `/api/health` del CD lo detecta; marcha atrás según el runbook |
| Apps extra creadas en tests reconfiguran singletons globales (`email_sender`, `tracer`, `jwt_manager`) | Media | Medio (fugas entre tests o un correo real con una clave del `.env`) | `make_app` con `MAIL_BACKEND="memory"` y Langfuse a `None` por defecto; REQ-007 sustituye el `opener` antes de cualquier petición y fija `RESEND_API_KEY`; los fixtures autouse existentes reponen `transport` y `tracer.backend` en cada test |
| `invalidateQueries` con reintentos por defecto (producción: 3) retrasa el aviso unos segundos | Media | Bajo | Aceptado: la mutación sigue «Guardando…» mientras tanto, como hoy; los tests usan `retry: false` |
| Con `isLoadingError`, un fallo de una relectura en segundo plano (no causada por un registro) deja de mostrar el error técnico en Métricas y en el perfil | Media | Bajo | Se conservan los datos anteriores, que es el comportamiento que pide la spec para la relectura; la carga inicial no cambia |
| `flask db …` sin `FLASK_ENV` en local ahora falla por la validación | Media | Bajo (positivo: evita migrar Supabase por error) | Documentarlo en `CLAUDE.md` (puntos delicados) |

## 7. Cumplimiento de la constitución

- **B1, B4:** todos los REQ/NFR mapeados (sección 4) y todos los AC con test (sección 5), con marcador `SDD: 020 …`.
  AC-004.3 se diseña con el valor de la spec aprobada (162 lb).
- **B5.1–B5.3:** tests antes de implementar; la conversión de tests existentes a instante fijado mantiene sus
  aserciones (no los debilita, solo quita la dependencia del reloj real). B5.4 y P1 backend 4: ninguna llamada a Resend
  (`FakeOpener`). B5.6: esqueletos definidos en 3.2; el parámetro `config_overrides` de `create_app` se añade ya en el
  esqueleto con su `app.config.update` porque es fontanería de los fixtures (justificado en 3.2).
- **P1 backend 3:** sin `unittest.mock` ni `monkeypatch`; dobles a mano (`FakeClock`, `FakeOpener`) inyectados por
  constructor o por atributo; `caplog` es un fixture estándar de lectura del log.
- **P1 frontend:** tests junto al archivo; el servidor de prueba con estado en `src/test/`; red simulada en `api.ts`.
- **P2 backend:** capas intactas; el reloj llega a los servicios por constructor desde `_build_*_service()` (P2.2);
  `utc_now` reutilizado desde `utils/` (P2.5); sin cambios de modelo (P2.4 no aplica).
- **P2 frontend:** organización por feature; TanStack Query (claves en `hooks.ts`); todo HTTP por `apiFetch`; componente
  de aviso en `features/body-metrics/components/` (específico de la feature, no un primitivo de `components/ui/`).
- **P3:** sin endpoints nuevos; NFR-001 impide fijar la hora desde la petición o el entorno. P3.5: `FRONTEND_BASE_URL`
  ya está en `backend/.env.example`; se añade el comentario de producción.
- **P4:** sin migración; el paso manual de EC2 queda documentado (runbook o `docs-report.md`).
- **DEBERÍA no cumplidos:** ninguno.

## 8. ADRs

- [ADR-0028](../../docs/sdd/decisions/ADR-0028-reloj-de-la-app-y-configuracion-de-produccion.md) (Propuesta): reloj por
  app fijable solo en pruebas, `create_app(config_name, config_overrides)` y validación de `FRONTEND_BASE_URL` al
  arrancar en producción.
