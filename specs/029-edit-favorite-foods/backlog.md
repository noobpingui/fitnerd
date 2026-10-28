# Backlog · 029-edit-favorite-foods

## spec · spec-writer
- [ ] Deshacer una edición de un alimento propio.
- [ ] Editar un alimento propio desde las filas del diario o desde una pantalla «Mis alimentos».

## plan · planner
- [ ] Tras un 404 al editar desde la propuesta de foto, desvincular las filas de ese alimento, como `unlinkCustomFood` al borrar en la 028 (la spec no lo pide).
- [ ] Endpoint dedicado para comprobar si un nombre ya existe, si la comprobación del cliente con la búsqueda se queda corta.
- [ ] Usar `aria-disabled` en lugar de `disabled` para no perder el foco mientras se guarda, en la edición y en el borrado de la 028.
