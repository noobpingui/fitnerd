# ADR-0028: Reloj de la app fijable solo en pruebas y configuración de producción validada al arrancar

- **Estado:** Propuesta · 2026-10-18 (plan de `020-metrics-followups-prod-config`)
- **Decidido por:** el `planner`; pendiente de revisión por el usuario en el gate de `review`.

## Contexto
Los servicios del backend ya reciben un reloj por constructor (`clock=utc_now`) y los tests unitarios inyectan
`FakeClock`, pero las rutas construyen los servicios sin pasar reloj: los tests de rutas usan la hora real y los límites
de fecha (un año en mediciones, de 14 a 100 años en el registro, 5 minutos del enlace de restablecimiento) solo se
pueden probar con fechas relativas, que fallan al cruzar la medianoche UTC. La spec 020 (REQ-005, NFR-001) pide poder
fijar el instante en la configuración de pruebas, y solo en ella.

Además, `FRONTEND_BASE_URL` tiene un valor por defecto de desarrollo (`http://localhost:5173`) que también se aplica en
producción si la variable falta en EC2, y los correos salen con enlaces a `localhost` (REQ-006). Las clases de
`config.py` leen el entorno al importarse, así que un test no puede simular «variable ausente» sin recargar el módulo.

Opciones consideradas para el reloj:
1. **Un reloj por app en `app.extensions`**, que en la configuración de pruebas es un `AdjustableClock` y en las demás
   la función `utc_now` real (sin método para fijarlo).
2. **Un singleton en `extensions.py`** con un indicador «se puede fijar» que activa `init_app`: los tests crean más de
   una app (producción, desarrollo) en el mismo proceso, y la última que se inicializa cambiaría el comportamiento de
   las demás.
3. **Una variable de entorno o una cabecera para fijar la hora:** prohibido por NFR-001.

## Decisión
- Opción 1. Módulo nuevo `backend/utils/clock.py` con `utc_now()`, `AdjustableClock` (`set`, `reset`, invocable),
  `install_clock(app)` y `current_clock()`. `install_clock` elige el reloj solo según `app.config["TESTING"]`, una
  constante de `TestingConfig` que no se lee del entorno. Las funciones `_build_*_service()` pasan `clock=current_clock()`
  a los servicios que dependen de la fecha (mediciones, análisis, registro, perfil y restablecimiento).
- `create_app(config_name=None, config_overrides=None)`: los valores de `config_overrides` se aplican después de la clase
  de configuración. Solo se usa desde código (tests); no se puede activar desde el entorno.
- `FRONTEND_BASE_URL` se resuelve en `create_app` con `resolve_frontend_base_url(value, required=...)`, antes de
  inicializar ninguna extensión. `ProductionConfig.FRONTEND_BASE_URL_REQUIRED = True`: si el valor falta, está vacío o no
  empieza por `https://`, `create_app` lanza `ValueError` con «FRONTEND_BASE_URL es obligatoria en producción y debe
  empezar por https://» y gunicorn no arranca. En desarrollo el valor por defecto sigue siendo `http://localhost:5173`;
  en pruebas, fijo.

## Consecuencias
- (+) Los tests de rutas fijan el instante con `AdjustableClock.set(...)` y prueban límites con fechas absolutas; el
  instante no avanza solo.
- (+) En desarrollo y producción no existe ningún objeto capaz de fijar la hora: el reloj es la función real.
- (+) Un despliegue sin `FRONTEND_BASE_URL` válida falla al arrancar (y en la comprobación de `/api/health` del CD) en
  lugar de enviar enlaces rotos.
- (−) `flask db …` con la configuración de producción también exige la variable (en EC2 ya está en `backend/.env`; en
  local, sin `FLASK_ENV=development`, ahora falla antes de tocar Supabase).
- (−) El JWT, el `created_at` que pone la base (`func.now()`) y la ventana de límite del análisis siguen usando la hora
  real: el instante fijado solo afecta a las reglas de servicio que enumera REQ-005.
