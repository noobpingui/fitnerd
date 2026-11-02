# Backlog · 033-profile-first-name

## spec · spec-writer
- [ ] Editar el apellido en el perfil.
- [ ] El saludo «Hola de nuevo» en la primera visita tras registrarse.

## plan · planner
- [ ] Renombrar `PhysicalDataForm` y `PhysicalDataFormValues` a «PersonalData…» ahora que incluyen el nombre.
- [ ] Alinear el recorte de espacios Unicode raros entre Python `strip()` y JS `trim()` (p. ej. U+0085 y U+FEFF), si llega a importar.
- [ ] El `doc-keeper` debe actualizar `CLAUDE.md` y `README.md`, que describen la validación de la fecha de nacimiento en el registro (spec 018).

## tasks · task-breaker
- [ ] Diferencias entre `str.strip()` de Python y `String.prototype.trim()` de JS con espacios Unicode raros (riesgo del plan, sección 6). El servidor manda y el caso acaba en un 400.
