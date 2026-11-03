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

## tests · test-author
- [ ] Diferencia entre `str.strip()` de Python y `String.prototype.trim()` de JS con espacios Unicode raros (U+0085, U+FEFF): no hay test, ya está anotada en el riesgo 6 del plan.
- [ ] Se podría quitar `date_of_birth` de `registered_user` en `conftest` cuando se limpie la deuda de fixtures (hoy es inocuo).

## tests (red check) · verifier
- [ ] Reformular las guardas F-B2, F-5, F-3 y F-4 (y F-B1, F-1, F-2) para que fallen hoy, o decidir una excepción explícita al Art. B5.2.
- [ ] Dos tests de 014 (`RegisterForm` «envía el registro con 36 eñes» y «envía el correo recortado…») y uno de `schemas.test.ts` («el registro recorta el correo…») fallan hoy solo porque el registro exige fecha; pasarán con T-040 y T-051, sin cambios en el test.
- [ ] `services/date_of_birth_rules.py:28` lanza `ValueError` con `"2001-02-30"` en `register_from_body`; T-040 debe ignorar la fecha antes de parsearla.

## tests (red check, 2.ª pasada) · verifier
- [ ] Añadir el marcador SDD 033 a los tests existentes adaptados (14 de spec 014, router, lazyRoutes, ProfilePage «al cambiar solo la meta»).
- [ ] Corregir el recuento de AC (37 en state.json frente a 36 en spec.md).
- [ ] Corregir la casilla T-028 o adaptar PhysicalDataForm.refresh.test.tsx.
