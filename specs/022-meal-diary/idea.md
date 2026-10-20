# Idea original · 022-meal-diary

Fecha: 2026-10-20T17:28:30.586Z

Diario de comidas: el usuario registra lo que come cada día y ve sus totales frente al objetivo de Macros.

Backend (con migración, que no se aplica sola):
- Modelo de comida y de alimentos de la comida. Cada alimento puede ser de USDA (public.foods) o personalizado, con gramos y macros (calorías, proteína, carbohidratos, grasa) calculados y GUARDADOS en la línea, para que el historial no cambie si se reimporta USDA.
- CRUD de comidas bajo /api, con sesión y por usuario. El «día» se calcula con backend/utils/clock.py.

Frontend (completo, por feature):
- Pantalla del diario: añadir alimento buscando (reutiliza GET /api/foods/search de la 021), editar gramos, quitar alimento, y totales del día frente al objetivo de calorías y macros de la feature macros.
- Alimento personalizado con macros a mano para lo que USDA no tiene (por ejemplo, gallo pinto).
- Enlazar «Alimentos»/diario en la navegación y añadir la atribución a USDA en la página legal (pendiente de la 021).
- Posible parámetro para elegir el número de resultados de la búsqueda, si hace falta.

Deja un producto útil sin IA y construye la edición de comidas que reutilizará la 024 (foto + confirmar). Fuera de alcance: Branded Foods, API de USDA, fotos, edición avanzada de comidas pasadas, estadísticas semanales.

Contexto: docs/backlog.md, sección «Plan: registro de comidas con foto y datos de USDA» (022) y los pendientes de la 021 (specs/021-usda-food-database/). Backend primero dentro de la spec.
