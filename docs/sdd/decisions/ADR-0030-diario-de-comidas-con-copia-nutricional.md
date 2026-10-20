# ADR-0030: Diario de comidas con copia de los valores nutricionales y día decidido por el cliente

- **Estado:** Aceptada · 2026-10-20 (plan de `022-meal-diary`; aceptada por el usuario en la review)
- **Decidido por:** el `planner`; revisada y aceptada por el usuario en el gate de `review`.

## Contexto
La spec 022 añade un diario de comidas: comidas por usuario, fecha y tipo (desayuno, almuerzo, cena y meriendas) con
alimentos de USDA (`public.foods`, ADR-0029) o personalizados. El historial **no** debe cambiar si USDA se reimporta o
un alimento desaparece (REQ-008), y el «día» de una comida es la fecha local del usuario, mientras que el reloj del
servidor (`utils/clock.py`, ADR-0028) va en UTC (en Costa Rica, UTC−6, una cena a las 19:00 ya es «mañana» en UTC).
La spec 024 reutilizará el mismo contrato para guardar los alimentos detectados en una foto.

Opciones consideradas:
1. **Datos del alimento registrado:** referencia a `foods` con clave foránea y cálculo al leer, frente a una **copia**
   de la descripción, el origen y los valores por 100 g en cada alimento registrado, con los nutrientes de la porción
   calculados y guardados al registrarlo.
2. **Día de la comida:** el servidor decide con su reloj, frente al cliente que envía su fecha local y el servidor la
   acepta solo dentro de una ventana de ±1 día de la suya (como Métricas, que ya admite `today + 1`).
3. **Redondeo:** `round()` de Python sobre `float` (redondeo bancario y errores binarios: 3,57 × 1,5 = 5,354999…),
   frente a `decimal.Decimal` construido desde `repr(float)` con `ROUND_HALF_UP` a 2 decimales.
4. **Identificadores:** UUID como el resto de tablas, frente a enteros autoincrementales, que es lo que pide el contrato
   de la spec (`id` entero).

## Decisión
- Dos tablas nuevas, `public.meals` (una por `user_id`, `meal_date` y `meal_type`, con restricción única) y
  `public.meal_items`, con claves primarias enteras autoincrementales y `ON DELETE CASCADE` de los alimentos hacia su
  comida.
- `meal_items` **no** tiene clave foránea hacia `foods`: guarda `fdc_id` como dato informativo, una copia de
  `description` (como `name`), `data_type` y los cuatro valores por 100 g (`float`, nulos si USDA no tiene dato), los
  gramos (`NUMERIC(5,1)`) y los cuatro nutrientes de la porción (`NUMERIC(8,2)`, nulos si el valor por 100 g es nulo).
  Al cambiar los gramos se recalcula con la copia, nunca con `foods`.
- El cálculo `valor por 100 g × gramos / 100` se hace con `Decimal(repr(valor))` y `ROUND_HALF_UP` a 2 decimales en
  una función pura de `services/meal_rules.py`; los totales suman los nutrientes ya redondeados (exactos en `Decimal`)
  y se calculan al leer, sin guardarse.
- El cliente envía `date` (`AAAA-MM-DD`, su fecha local). Al **añadir**, el servidor la acepta solo entre
  `reloj.date() − 1` y `reloj.date() + 1`; leer, corregir y quitar no tienen ventana.
- Todas las escrituras bloquean antes la fila del usuario (`UserRepository.get_by_id_for_update`, como ADR-0020), lo
  que serializa la creación de la comida de un tipo y el tope de 50 alimentos ante peticiones simultáneas; la
  restricción única queda como red de seguridad.

## Consecuencias
- El historial es estable aunque `foods` cambie o se vacíe, a costa de duplicar unos pocos campos por alimento
  registrado (del orden de 100 bytes).
- Corregir la descripción de un alimento de USDA no se propaga a los registros ya guardados (es lo que pide la spec).
- Un usuario podría registrar comidas de «mañana» o de «ayer» respecto a su fecha real (ventana de ±1 día); es el
  precio de no conocer su zona horaria en el servidor.
- `meals` y `meal_items` son las primeras tablas con identificadores enteros en lugar de UUID; las rutas usan
  `<int:…>` y el servicio responde 404 a identificadores fuera del rango de `INTEGER`.
- La migración es aditiva (dos tablas nuevas) y, como las demás, no se aplica sola en producción.
