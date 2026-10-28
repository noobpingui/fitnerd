# Idea original · 029-edit-favorite-foods

2026-10-28T08:05:41.208Z

Permitir editar alimentos propios desde «Favoritos» en el buscador de «Añadir alimento» de /diary.

Qué se pide. En el panel de búsqueda de «Añadir alimento» (/diary), cada alimento de «Favoritos» tiene, después de «Elegir» y de la estrella, un botón «Editar». Permite cambiar el nombre y los valores por 100 g (calorías, proteína, carbohidratos y grasa, como al crear un alimento personalizado).

Reglas pedidas por el usuario.
- El botón «Guardar» está deshabilitado mientras no haya cambios y se habilita al detectar uno.
- Si el nombre nuevo ya lo tiene otro favorito, se avisa de que ya existe y «Guardar» sigue deshabilitado.

Propuestas a validar en el gate de spec (decisiones mías, no del usuario):
1. Solo alimentos propios (custom_foods). Los del catálogo son compartidos y de solo lectura, así que no llevan «Editar».
2. El historial no cambia. Cada comida registrada conserva su copia de nombre y valores (ADR-0036).
3. Edición en línea, dentro del elemento, no en un modal, para no esconder la lista a los lectores de pantalla, como ya hace la confirmación de borrado.
4. Backend: nuevo PATCH /api/food-library/custom/{id} con el servicio y el repositorio correspondientes. La unicidad del nombre se valida también en el servidor (sin mayúsculas ni tildes, por usuario), no solo en el cliente, y responde con un error claro de «ya existe».
5. Alcance de pantallas: el panel de búsqueda se comparte con la propuesta de foto, así que «Editar» aparecerá también ahí. Hay que confirmarlo o limitarlo.

Por decidir: si «Editar» debe estar también en «Recientes» y en los resultados de búsqueda, o solo en «Favoritos» como se pidió.

Tampoco hay migración prevista: custom_foods ya tiene todo lo necesario. Lo confirma el planner en el plan.
