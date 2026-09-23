# Spec 000 — Utilidad clamp(value, min, max) en el frontend (prueba en seco del harness)

- **Feature:** `000-example` · **Tipo:** feature
- **Ámbito:** frontend
- **Estado:** borrador

## 1. Contexto y problema
El frontend de fitnerd no tiene una utilidad común para limitar un número a un rango. Cada vez que hace falta (por ejemplo, para acotar valores numéricos introducidos o calculados), habría que reescribir la misma lógica, y además sin un comportamiento uniforme ante rangos inválidos.

Esta feature añade una función utilitaria `clamp(value, min, max)` que devuelve el valor limitado al rango cerrado `[min, max]` y avisa con un error si el rango es inválido (`min > max`).

Además, esta feature es la **prueba en seco del harness SDD**: su objetivo secundario es recorrer todas las etapas del flujo con un cambio pequeño y fácil de verificar. Por eso usa el número `000` y se ramifica desde `chore/sdd-harness` en vez de desde `main`.

## 2. Historia de usuario
Como **desarrollador del frontend de fitnerd**, quiero **una función `clamp(value, min, max)` compartida** para **limitar números a un rango de forma coherente en toda la app, sin repetir lógica y detectando pronto los rangos mal definidos**.

## 3. Alcance
**Incluye:**
- Una función utilitaria `clamp(value, min, max)` disponible para el resto del frontend desde la carpeta de utilidades compartidas (`frontend/src/lib/`), tal como pide la idea original.
- Su comportamiento con valores dentro, por debajo y por encima del rango, con límites iguales, con infinitos y con un rango inválido.
- El comportamiento ante `NaN` (resuelto en Q1).

**Fuera de alcance:**
- Usar `clamp` en pantallas o componentes existentes (ninguna pantalla cambia su comportamiento).
- Cualquier cambio en el backend.
- Variantes para otros tipos (fechas, cadenas, `bigint`) o rangos abiertos/semiabiertos.
- Textos visibles para el usuario final: la función no muestra nada en la interfaz.

## 4. Requisitos funcionales

### REQ-001 — Valor dentro del rango
WHEN `clamp` se llama con un `value` tal que `min <= value <= max` THE SYSTEM SHALL devolver `value` sin modificarlo.

- **AC-001.1:** Given `min = 0` y `max = 10`, When se llama `clamp(5, 0, 10)`, Then devuelve `5`.
- **AC-001.2:** Given `min = 0` y `max = 10`, When se llama `clamp(0, 0, 10)`, Then devuelve `0` (el límite inferior es inclusivo).
- **AC-001.3:** Given `min = 0` y `max = 10`, When se llama `clamp(10, 0, 10)`, Then devuelve `10` (el límite superior es inclusivo).
- **AC-001.4:** Given un rango con decimales y negativos `min = -1.5` y `max = 2.5`, When se llama `clamp(-0.25, -1.5, 2.5)`, Then devuelve `-0.25`.

### REQ-002 — Valor por debajo del rango
WHEN `clamp` se llama con un `value` menor que `min` THE SYSTEM SHALL devolver `min`.

- **AC-002.1:** Given `min = 0` y `max = 10`, When se llama `clamp(-5, 0, 10)`, Then devuelve `0`.
- **AC-002.2:** Given `min = 0` y `max = 10`, When se llama `clamp(-Infinity, 0, 10)`, Then devuelve `0`.

### REQ-003 — Valor por encima del rango
WHEN `clamp` se llama con un `value` mayor que `max` THE SYSTEM SHALL devolver `max`.

- **AC-003.1:** Given `min = 0` y `max = 10`, When se llama `clamp(15, 0, 10)`, Then devuelve `10`.
- **AC-003.2:** Given `min = 0` y `max = 10`, When se llama `clamp(Infinity, 0, 10)`, Then devuelve `10`.

### REQ-004 — Rango degenerado (min igual a max)
WHEN `clamp` se llama con `min === max` THE SYSTEM SHALL devolver ese valor común, sin lanzar error, sea cual sea `value` (salvo `NaN`, ver REQ-006).

- **AC-004.1:** Given `min = 3` y `max = 3`, When se llama `clamp(1, 3, 3)`, Then devuelve `3`.
- **AC-004.2:** Given `min = 3` y `max = 3`, When se llama `clamp(7, 3, 3)`, Then devuelve `3`.

### REQ-005 — Rango inválido
IF `clamp` se llama con `min > max` THEN THE SYSTEM SHALL lanzar un error de tipo `RangeError` cuyo mensaje incluye los valores de `min` y `max` recibidos, y no devolver ningún valor.

- **AC-005.1:** Given `min = 10` y `max = 0`, When se llama `clamp(5, 10, 0)`, Then lanza un `RangeError`.
- **AC-005.2:** Given `min = 10` y `max = 0`, When se llama `clamp(5, 10, 0)`, Then el mensaje del error es exactamente `clamp: min (10) no puede ser mayor que max (0)`.
- **AC-005.3:** Given `min = 10` y `max = 0`, When se llama `clamp(10, 10, 0)` (un `value` que coincide con uno de los límites), Then también lanza `RangeError` (la validación del rango se hace antes que cualquier otra cosa).

### REQ-006 — Entradas NaN
IF `value` es `NaN` y el rango es válido THEN THE SYSTEM SHALL devolver `NaN`, sin ocultar el error de origen.
IF `min` o `max` es `NaN` THEN THE SYSTEM SHALL lanzar un `RangeError` con el mensaje `clamp: min y max deben ser números válidos`, porque el rango no está definido.

- **AC-006.1:** Given `min = 0` y `max = 10`, When se llama `clamp(NaN, 0, 10)`, Then devuelve `NaN`.
- **AC-006.2:** Given `max = 10`, When se llama `clamp(5, NaN, 10)`, Then lanza un `RangeError`.
- **AC-006.3:** Given `min = 0`, When se llama `clamp(5, 0, NaN)`, Then lanza un `RangeError`.
- **AC-006.4:** Given `min = NaN` y `max = 10`, When se llama `clamp(5, NaN, 10)`, Then el mensaje del error es exactamente `clamp: min y max deben ser números válidos`.
- **AC-006.5:** Given `min = 3` y `max = 3`, When se llama `clamp(NaN, 3, 3)`, Then devuelve `NaN` (el caso `NaN` prevalece sobre el rango degenerado de REQ-004).

### REQ-007 — Límites infinitos
WHEN `min` es `-Infinity` o `max` es `Infinity` THE SYSTEM SHALL tratarlos como límites válidos (rango sin cota por ese lado).

- **AC-007.1:** Given `min = -Infinity` y `max = 10`, When se llama `clamp(-1000, -Infinity, 10)`, Then devuelve `-1000`.
- **AC-007.2:** Given `min = 0` y `max = Infinity`, When se llama `clamp(1000, 0, Infinity)`, Then devuelve `1000`.

## 5. Requisitos no funcionales
No aplica. Es una función pura y trivial: no hay requisitos de seguridad, rendimiento, accesibilidad ni i18n de cara al usuario final.

## 6. Datos y contratos visibles
El consumidor de esta feature es el propio código del frontend, así que el contrato visible es la firma de la función y sus errores:

- **Firma:** `clamp(value: number, min: number, max: number): number`, exportada desde las utilidades compartidas del frontend (`frontend/src/lib/`).
- **Argumentos:** tres números, en el orden `value`, `min`, `max`. Los límites son inclusivos.
- **Retorno:** un número en `[min, max]`, o `NaN` si `value` es `NaN` (REQ-006).
- **Efectos:** ninguno. La función no modifica nada ni depende de estado externo; con las mismas entradas siempre da la misma salida.
- **Error por rango inválido:** `RangeError` con el mensaje `clamp: min (<min>) no puede ser mayor que max (<max>)`, donde `<min>` y `<max>` son los valores recibidos convertidos a texto (por ejemplo, `clamp: min (10) no puede ser mayor que max (0)`).
- **Error por límite NaN (REQ-006):** `RangeError` con el mensaje `clamp: min y max deben ser números válidos`.

## 7. Preguntas abiertas
| # | Pregunta | Respuesta del usuario |
|---|---|---|
| Q1 | ¿Cómo se trata `NaN`? **Propuesta por defecto:** si `value` es `NaN`, devuelve `NaN` (no oculta el error de origen); si `min` o `max` es `NaN`, lanza `RangeError` con el mensaje `clamp: min y max deben ser números válidos`. | **Resuelta.** Todas las propuestas por defecto (usuario, 2026-09-23). Incorporada en REQ-006 (AC-006.1 a AC-006.5) y en la sección 6. |
| Q2 | ¿Qué tipo de error y qué mensaje se usan cuando `min > max`? **Propuesta por defecto:** `RangeError` con el mensaje en español `clamp: min (<min>) no puede ser mayor que max (<max>)`. Aunque no lo ve el usuario final, se escribe en español por coherencia con el resto de la app. | **Resuelta.** Todas las propuestas por defecto (usuario, 2026-09-23). Incorporada en REQ-005 (AC-005.1 a AC-005.3) y en la sección 6. |
| Q3 | ¿`min === max` es válido? **Propuesta por defecto:** sí; devuelve ese valor, sin error (REQ-004). Solo `min > max` es inválido. | **Resuelta.** Todas las propuestas por defecto (usuario, 2026-09-23). Incorporada en REQ-004 (AC-004.1 y AC-004.2). |
| Q4 | ¿Dónde vive la función: en el archivo de utilidades que ya existe en `frontend/src/lib/` o en uno propio dentro de esa carpeta? **Propuesta por defecto:** que lo decida el plan; la spec solo exige que esté en `frontend/src/lib/` y se pueda importar desde el resto del frontend. | **Resuelta.** Todas las propuestas por defecto (usuario, 2026-09-23). El archivo concreto lo decide el plan; la spec solo fija la carpeta (secciones 3 y 6). |

## 8. Glosario
- **clamp:** operación que "sujeta" un número dentro de un rango: si se sale por abajo devuelve el mínimo, si se sale por arriba devuelve el máximo y, si no, lo devuelve tal cual.
- **Prueba en seco:** ejecución completa del flujo SDD con una feature mínima para validar el harness, no para aportar funcionalidad de negocio.
