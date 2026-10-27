# Plan 027 — Endurecer SECRET_KEY en producción y la validación del snapshot del token de restauración

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-27)
- **Ámbitos:** backend

## 1. Resumen de la solución

Dos cambios pequeños y aislados en el backend, sin migración, sin variables nuevas y sin cambios en el frontend:

1. **SECRET_KEY obligatoria en producción.** Se replica el patrón de `FRONTEND_BASE_URL` de la spec 020 (ADR-0028):
   una función pura `resolve_secret_key(value, *, required)` en `backend/config.py`, un indicador de clase
   `SECRET_KEY_REQUIRED` (falso en `Config`, verdadero en `ProductionConfig`) y una llamada en `create_app()` justo
   después de resolver `FRONTEND_BASE_URL`. En producción, una clave ausente, vacía, en blanco o igual (tras `strip()`)
   a `"DEFAULT SECRET"` o `"change-me"` lanza `ValueError`; una clave válida se devuelve **sin recortar**.
2. **Validación estricta del snapshot.** En `parse_snapshot_payload` (`backend/services/meal_rules.py`) la versión pasa
   a exigir el entero `1` (no `1.0`), la posición un entero en `0..MAX_DB_INTEGER` y el `fdc_id`, si viene, un entero
   en `1..MAX_DB_INTEGER`. Reutiliza `is_int` y `MAX_DB_INTEGER`, que ya existen. Un snapshot que no cumple devuelve
   `None` y `MealService.restore_item` ya lo traduce a `ResourceNotFoundError` (404) sin tocar la base.

El fixture `make_app` de `tests/conftest.py` pasa a dar por defecto una `SECRET_KEY` propia de pruebas, para que los
tests de producción de la 020 arranquen en CI sin `SECRET_KEY` (NFR-002).

## 2. Impacto en la arquitectura

| Ámbito | Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|---|
| backend | Configuración | — | `backend/config.py` | Constantes `DEFAULT_SECRET_KEY`, `KNOWN_DEFAULT_SECRET_KEYS`, `SECRET_KEY_REQUIRED_MESSAGE`, función `resolve_secret_key`, atributo `SECRET_KEY_REQUIRED` (REQ-001..003) |
| backend | Factory de la app | — | `backend/app.py` | Llamar a `resolve_secret_key` tras `resolve_frontend_base_url` y guardar el resultado en `app.config["SECRET_KEY"]` (REQ-001..003) |
| backend | Servicios (reglas puras) | — | `backend/services/meal_rules.py` | `parse_snapshot_payload`: versión entera `1`, posición y `fdc_id` dentro del rango de la base (REQ-004..006) |
| backend | Tests (fixture) | — | `backend/tests/conftest.py` | `make_app` añade `"SECRET_KEY": "test-production-secret-key"` a sus valores por defecto (NFR-002) |
| backend | Tests unitarios | `backend/tests/test_services/test_secret_key_config.py` | `backend/tests/test_services/test_meal_rules.py` | `resolve_secret_key` y arranque de `create_app`; casos nuevos de `parse_snapshot_payload` |
| backend | Tests de integración | — | `backend/tests/test_routes/test_meal_routes.py` | `POST /api/meals/restore` con tokens firmados de contenido anómalo y restauración en una app de producción |

No cambian `backend/services/meal_service.py`, `backend/utils/restore_token.py`, `backend/routes/meal_routes.py` ni
`backend/routes/coach_routes.py`: siguen leyendo `current_app.config["SECRET_KEY"]`, que ya es el valor resuelto.

## 3. Diseño

### 3.1 Datos y migraciones

No aplica. No hay cambios de modelo ni migraciones. El tope `MAX_DB_INTEGER = 2_147_483_647` ya existe en
`meal_rules.py` y coincide con las columnas `INTEGER` de `meal_items.position` y `meal_items.fdc_id`.

### 3.2 Contratos e interfaces

**Nuevos símbolos en `backend/config.py`** (los tests los importan):

```python
DEFAULT_SECRET_KEY = "DEFAULT SECRET"
KNOWN_DEFAULT_SECRET_KEYS = frozenset({"DEFAULT SECRET", "change-me"})
SECRET_KEY_REQUIRED_MESSAGE = (
    "SECRET_KEY es obligatoria en producción y no puede ser un valor por defecto"
)


def resolve_secret_key(value: str | None, *, required: bool) -> str:
    """Clave de firma: en producción es obligatoria y no puede ser un valor por defecto conocido."""
```

Comportamiento exacto de `resolve_secret_key`:

| `required` | `value` | Resultado |
|---|---|---|
| `False` | `None` | `DEFAULT_SECRET_KEY` |
| `False` | cualquier otro | `value` tal cual (incluido `"change-me"` o `""`) |
| `True` | no es `str` (incluido `None`) | `ValueError(SECRET_KEY_REQUIRED_MESSAGE)` |
| `True` | `value.strip() == ""` | `ValueError(SECRET_KEY_REQUIRED_MESSAGE)` |
| `True` | `value.strip() in KNOWN_DEFAULT_SECRET_KEYS` | `ValueError(SECRET_KEY_REQUIRED_MESSAGE)` |
| `True` | cualquier otro `str` | `value` **sin modificar** (no se recorta) |

**Cambios de clase en `backend/config.py`:**

- `Config.SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)` (mismo valor que hoy, ahora con la constante).
- `Config.SECRET_KEY_REQUIRED = False`.
- `ProductionConfig.SECRET_KEY_REQUIRED = True`.
- `DevelopmentConfig` y `TestingConfig` heredan `False`.

**`create_app()` en `backend/app.py`** (sin cambio de firma): tras el bloque de `FRONTEND_BASE_URL`,

```python
app.config["SECRET_KEY"] = resolve_secret_key(
    app.config.get("SECRET_KEY"),
    required=app.config.get("SECRET_KEY_REQUIRED", False),
)
```

Como se ejecuta después de `config_overrides`, un override `SECRET_KEY=None` simula «variable ausente» en los tests,
igual que `FRONTEND_BASE_URL=None` en la 020. El `ValueError` sale de `create_app`, antes de `db.init_app`, por lo que
la app no queda creada (AC-001.6: con las dos variables mal, gana el mensaje de `FRONTEND_BASE_URL`, que se evalúa
primero; la spec admite cualquiera de los dos).

**`parse_snapshot_payload` en `backend/services/meal_rules.py`:** firma sin cambios,
`def parse_snapshot_payload(payload: object) -> RemovedItemSnapshot | None`. Nuevas reglas (todas devuelven `None`):

- `v`: no es `is_int(v)` o `v != 1` (rechaza `1.0`, `True`, `"1"`, `2`, `0`, `None` y ausente).
- `p`: no es `is_int(p)` o no cumple `0 <= p <= MAX_DB_INTEGER`.
- `f`: si no es `None`, no es `is_int(f)` o no cumple `1 <= f <= MAX_DB_INTEGER` (aplica a cualquier origen, porque
  el valor acaba en la misma columna; un snapshot de catálogo o personalizado emitido por el servidor siempre trae
  `f = None`, así que AC-006.4 se mantiene).

**`POST /api/meals/restore`:** contrato de la 026 sin cambios de forma. Un contenido rechazado responde
404 `{"error": "No encontramos ese alimento en la comida."}` por el camino ya existente
(`snapshot is None → ResourceNotFoundError(ITEM_NOT_FOUND_MESSAGE)`), antes de `_lock_user` y de cualquier escritura.
El formato del token y del payload (`snapshot_payload`) no cambia (NFR-001).

### 3.3 Lógica

- `resolve_secret_key` es una función pura de configuración, sin dependencias, junto a `resolve_frontend_base_url`
  (mismo módulo, mismo estilo). No se aplica en la clase (a nivel de import), sino en `create_app`, para que importar
  `config` nunca falle y para que los overrides de los tests se tengan en cuenta (decisión ya tomada en ADR-0028).
- La comparación con los valores por defecto se hace sobre `value.strip()` (`str.strip()` sin argumentos quita
  espacios, tabuladores y saltos de línea, que es lo que piden AC-001.4 y AC-001.5), pero se devuelve `value` original
  (AC-002.2).
- `parse_snapshot_payload` sigue siendo una función pura de `services/meal_rules.py`; reutiliza `is_int`
  (`services/number_validation.py`) y `MAX_DB_INTEGER`, igual que `_parse_usda_item`. No recibe dependencias nuevas.
  `MealService` no cambia: su constructor y su `restore_signer` siguen igual (Art. P2.2).
- Los scripts que llaman a `create_app()` (`scripts/load_food_catalog.py`, `scripts/import_usda_foods.py`,
  `scripts/ingest_transcripts.py`) heredan la comprobación cuando corren con `FLASK_ENV=production`; dentro del
  contenedor de EC2 leen el mismo `backend/.env`, así que no cambian si la clave es propia.

### 3.4 Interfaz de usuario

No aplica.

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `config.resolve_secret_key(required=True)` con `KNOWN_DEFAULT_SECRET_KEYS` y `SECRET_KEY_REQUIRED_MESSAGE`; `ProductionConfig.SECRET_KEY_REQUIRED = True`; llamada en `create_app()` tras `FRONTEND_BASE_URL` |
| REQ-002 | `resolve_secret_key` devuelve el valor original sin `strip()`; `create_app()` lo guarda en `app.config["SECRET_KEY"]`, que leen `meal_routes._build_meal_service` y `coach_routes` |
| REQ-003 | `Config.SECRET_KEY_REQUIRED = False` heredado por `DevelopmentConfig` y `TestingConfig`; `resolve_secret_key(required=False)` con `None → DEFAULT_SECRET_KEY` |
| REQ-004 | `meal_rules.parse_snapshot_payload`: `is_int(v) and v == 1` |
| REQ-005 | `meal_rules.parse_snapshot_payload`: `is_int(p) and 0 <= p <= MAX_DB_INTEGER`; 404 por el camino existente de `MealService.restore_item` |
| REQ-006 | `meal_rules.parse_snapshot_payload`: `f is None or (is_int(f) and 1 <= f <= MAX_DB_INTEGER)`; 404 por el mismo camino |
| NFR-001 | `snapshot_payload`, `RestoreTokenSigner` y `MealService` sin cambios; los snapshots que emite el servidor siempre cumplen las reglas nuevas (posición de un `meal_item` real, `fdc_id` validado al añadir) |
| NFR-002 | `tests/conftest.py::make_app` añade `SECRET_KEY` propia de pruebas a sus valores por defecto |

## 5. Estrategia de pruebas

Ámbito único: **backend**. Servicios del entorno: Postgres de prueba (`TEST_DATABASE_URL`) para los tests de rutas y
de `create_app`; nada externo. Sin `unittest.mock` ni `monkeypatch` (Art. P1.3): «variable ausente» se expresa con
el override `SECRET_KEY=None` de `make_app`, como hace la 020 con `FRONTEND_BASE_URL=None`. No hacen falta dobles de
prueba nuevos.

**Cambio previo en el fixture (NFR-002, lo hace el `test-author`):** en `backend/tests/conftest.py`, `make_app` añade
`"SECRET_KEY": "test-production-secret-key"` a `settings` antes de aplicar `overrides`, y se actualiza su docstring.
Los tests de la 020 (`test_production_config.py`, `test_fixed_clock_routes.py`) no se tocan y siguen comprobando lo
mismo (AC-N002.1). Así, sin `SECRET_KEY` en el entorno, esos tests pasan tanto antes como después de implementar.

**Unitarios, `backend/tests/test_services/test_secret_key_config.py` (nuevo):**

- Constantes: `SECRET_KEY_REQUIRED_MESSAGE` es el texto exacto de la spec; `DEFAULT_SECRET_KEY == "DEFAULT SECRET"`;
  `KNOWN_DEFAULT_SECRET_KEYS == {"DEFAULT SECRET", "change-me"}`; `ProductionConfig.SECRET_KEY_REQUIRED is True` y
  `DevelopmentConfig`/`TestingConfig` a `False`.
- `resolve_secret_key(..., required=True)`: `None` (AC-001.1), `"DEFAULT SECRET"` (AC-001.2), `"change-me"` (AC-001.3),
  `""`, `"   "`, `"\t\n"` (AC-001.4), `" DEFAULT SECRET "`, `"DEFAULT SECRET\n"`, `"\tchange-me "` (AC-001.5) lanzan
  `ValueError` con `match=re.escape(MESSAGE)`; `"una-clave-propia-de-produccion"` y `"  clave con espacios  "` se
  devuelven idénticos (AC-002.1, AC-002.2).
- `resolve_secret_key(..., required=False)`: `None → "DEFAULT SECRET"` (AC-003.1), `"change-me"` se conserva
  (AC-003.2).
- `create_app` con `make_app("production", FRONTEND_BASE_URL=PROD_URL, SECRET_KEY=…)` para cada valor anterior: falla
  con el mensaje exacto (AC-001.1..001.5) o arranca con `app.config["SECRET_KEY"]` idéntico (AC-002.1, AC-002.2).
- AC-001.6: `make_app("production", FRONTEND_BASE_URL="http://localhost:5173", SECRET_KEY=None)` lanza `ValueError`
  con uno de los dos mensajes (`match` con alternativa de ambos escapados).
- AC-003.1/003.2: `make_app("development", FRONTEND_BASE_URL=None, SECRET_KEY=None)` arranca con `"DEFAULT SECRET"`;
  con `SECRET_KEY="change-me"` arranca con `"change-me"`. AC-003.3: `make_app("testing", SECRET_KEY=None)` y
  `make_app("testing", SECRET_KEY="DEFAULT SECRET")` arrancan sin error.

**Unitarios, `backend/tests/test_services/test_meal_rules.py` (casos nuevos, sin tocar los existentes):** reutilizan
`_VALID_PAYLOAD`, `_payload_with`, `_REMOVE` y `snapshot()`.

- AC-004.1/004.2: `v` = `1.0`, `True`, `"1"`, `2`, `0`, `None`, ausente → `None`. AC-004.3: `_VALID_PAYLOAD`
  (`v=1`) devuelve `snapshot()` completo.
- AC-005.1: `p=2147483647` se acepta con esa posición; AC-005.4: `p=0` se acepta. AC-005.2: `p=2147483648` → `None`.
  AC-005.3: `p` = `-1`, `1.0`, `True`, `"3"`, `None`, ausente → `None`.
- AC-006.1/006.2: payload de USDA (`s="usda"`, `c=None`, `f=…`, `dt="sr_legacy_food"`) con `f` = `2147483648`, `0`,
  `-5`, `1.0` → `None`. AC-006.3: `f=2147483647` se acepta. AC-006.4: catálogo (`_VALID_PAYLOAD`) y personalizado
  (`s="custom"`, `c=None`, `f=None`) se aceptan.
- AC-N001.1: ida y vuelta `parse_snapshot_payload(snapshot_payload(x)) == x` para catálogo, USDA y personalizado en
  posiciones `0`, `1` y `MAX_DB_INTEGER` (amplía el round-trip existente con un test nuevo parametrizado).

**Integración, `backend/tests/test_routes/test_meal_routes.py` (casos nuevos, sección «Spec 027»):** fixtures
`client`, `app`, `headers` y `app_clock`; helpers existentes `post`, `diary`, `counts`, `restore`,
`delete_with_undo` y `three_item_breakfast`. El token se fabrica con
`RestoreTokenSigner(app.config["SECRET_KEY"]).sign(user_id, payload)` (utilidad real, Art. P2.5), con `payload`
construido como `snapshot_payload(...)` válido con `exp` en el futuro respecto al reloj de la app y un solo campo
alterado; el `user_id` del usuario de `headers` (registrado por `register()` con su correo) se lee de la tabla
`users` dentro de `app.app_context()` filtrando por ese correo, como ya hace `seed_food` con la sesión de `db`.

- AC-004.4: `v=1.0` → 404 con el mensaje exacto y `diary`/`counts` iguales antes y después.
- AC-005.5: `p=2147483648` → 404 (no 500), mismas comprobaciones.
- AC-006.5: `s="usda"`, `f=2147483648` → 404 (no 500), mismas comprobaciones.
- AC-002.3: app de producción `make_app("production", FRONTEND_BASE_URL=PROD_URL,
  SECRET_KEY="una-clave-propia-de-produccion")`, registro por la API (patrón de `register_headers` de
  `test_fixed_clock_routes.py`), comida con tres alimentos, `DELETE …?undo=1` del segundo y `POST /api/meals/restore`
  con el token: el alimento vuelve a la misma comida y posición.
- AC-N001.2: la suite existente de la 026 en `test_meal_service.py`, `test_meal_routes.py`, `test_meal_rules.py` y
  `test_restore_token.py` se ejecuta completa sin cambios.

**Rojo esperado:** los tests de `resolve_secret_key`, constantes y `SECRET_KEY_REQUIRED` fallan por `ImportError`
de símbolos del plan hasta que el `implementer` cree los esqueletos (`resolve_secret_key` con
`raise NotImplementedError("not implemented")`, constantes con su valor); los de `create_app` en producción con clave
por defecto fallan porque arranca; `v=1.0` se acepta hoy y `p`/`f` enormes dan 500 hoy. Los casos que ya pasan
(versión `2`, posición `-1`, etc.) son guardas de regresión y se marcan como tales.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El `backend/.env` de EC2 no define `SECRET_KEY` o usa `change-me`: tras el CD el contenedor no arranca y falla `/api/health` | Baja | Alto | El `doc-keeper` añade al runbook y a `CLAUDE.md` un paso previo al merge: comprobar en EC2 que `SECRET_KEY` existe y no es un valor por defecto (sin imprimirla, p. ej. comparando su longitud o un hash). Marcha atrás: revertir el commit. |
| Comandos locales con `FLASK_ENV=production` (p. ej. `flask db upgrade` contra Supabase) dejan de funcionar si el `.env` local trae `change-me` | Media | Bajo | Documentarlo en el runbook (Q1 de la spec): exportar la clave de producción o una propia solo para ese comando. |
| Los tests de producción de la 020 fallan en CI si el fixture no se actualiza antes de implementar | Media | Medio | El cambio de `make_app` es la primera tarea de la etapa de tests; el `verifier` ejecuta la suite completa del backend. |
| Un snapshot legítimo de la 026 se rechaza con las reglas nuevas | Muy baja | Medio | Las posiciones reales caben en `INTEGER` y el `fdc_id` se valida en `1..MAX_DB_INTEGER` al añadir; test de ida y vuelta por origen y posición extrema (AC-N001.1). |

## 7. Cumplimiento de la constitución

- **Art. B1/B4/B5:** cambio funcional con spec aprobada; cada AC tiene test previsto con marcador
  `# SDD: 027 REQ-… AC-…`; TDD con rojo legítimo; ningún test existente se borra ni se debilita (el cambio de
  `make_app` añade un valor por defecto que los tests pueden sobrescribir, no relaja ninguna comprobación).
- **Art. P1.1–P1.5 (backend):** unitarios en `tests/test_services/`, integración en `tests/test_routes/` con `client`;
  nombres en inglés y docstrings en español; sin `unittest.mock` ni `monkeypatch`; solo Postgres de prueba; esqueletos
  con `NotImplementedError("not implemented")`.
- **Art. P2.1–P2.3:** la validación del token sigue en `services/` (función pura) y el 404 sale de
  `ResourceNotFoundError`; las rutas no cambian. La comprobación de arranque vive en `config.py`/`create_app`, como la
  de `FRONTEND_BASE_URL` (ADR-0028).
- **Art. P2.4:** sin cambios de modelo, sin migración.
- **Art. P2.5:** se reutilizan `RestoreTokenSigner`, `is_int` y `MAX_DB_INTEGER`; no se duplica nada.
- **Art. P3.2:** refuerza la validación del input externo (contenido del token) en el servicio.
- **Art. P3.5:** no hay variables nuevas; `SECRET_KEY` ya está en `backend/.env.example` (con `change-me`, que en
  producción ahora se rechaza: el `doc-keeper` puede añadir un comentario en el ejemplo).
- **Art. P4:** el paso manual de comprobar `SECRET_KEY` en EC2 antes del merge lo documenta el `doc-keeper`.
- Ningún «DEBERÍA» queda sin cumplir.

## 8. ADRs

Ninguna. La comprobación de `SECRET_KEY` aplica la decisión ya tomada en
[ADR-0028](../../docs/sdd/decisions/ADR-0028-reloj-de-la-app-y-configuracion-de-produccion.md) (validar al arrancar
en `create_app` las variables obligatorias de producción) y la validación del snapshot endurece
[ADR-0035](../../docs/sdd/decisions/ADR-0035-deshacer-con-token-de-restauracion-firmado.md) sin cambiar su formato.
