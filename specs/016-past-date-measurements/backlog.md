# Backlog · 016-past-date-measurements

## spec · spec-writer
- [ ] Que el perfil se vuelva a leer tras registrar desde el perfil puede obligar a ajustar los tests de la spec 006 que cuentan lecturas; el planner debe tratarlo sin debilitar tests (Art. B5.3).
- [ ] Los tests de rutas con fechas fijas y reloj real pueden quedar fuera del límite de un año con el tiempo; conviene inyectar el reloj.
- [ ] Desplegar el Historial hasta la medición recién registrada (fuera de alcance).

## plan · planner
- [ ] Inyectar un reloj configurable en la app para los tests de rutas, si en el futuro hacen falta fechas absolutas.
- [ ] Mostrar un error o reintento si falla la relectura tras registrar desde el perfil (hoy, como mucho, no se ve el aviso de REQ-009).
- [ ] Desplegar el Historial hasta la medición recién registrada (fuera de alcance de la spec).
