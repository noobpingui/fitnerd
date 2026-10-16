# Backlog · 016-past-date-measurements

## spec · spec-writer
- [ ] Que el perfil se vuelva a leer tras registrar desde el perfil puede obligar a ajustar los tests de la spec 006 que cuentan lecturas; el planner debe tratarlo sin debilitar tests (Art. B5.3).
- [ ] Los tests de rutas con fechas fijas y reloj real pueden quedar fuera del límite de un año con el tiempo; conviene inyectar el reloj.
- [ ] Desplegar el Historial hasta la medición recién registrada (fuera de alcance).

## plan · planner
- [ ] Inyectar un reloj configurable en la app para los tests de rutas, si en el futuro hacen falta fechas absolutas.
- [ ] Mostrar un error o reintento si falla la relectura tras registrar desde el perfil (hoy, como mucho, no se ve el aviso de REQ-009).
- [ ] Desplegar el Historial hasta la medición recién registrada (fuera de alcance de la spec).

## tests · test-author
- [ ] Los tests de la página con navegación (AC-008.1, AC-008.2 y AC-008.4) comprueban el valor que devuelve `getProfile` mockeado; la sincronización real del servidor ya está cubierta en el backend. No hay test de extremo a extremo.
- [ ] Si las cuatro filas de mediciones superan el tamaño de página del historial ("Mostrar más"), los tests de orden de AC-003.4 habría que revisarlos. Hoy usan 3 filas.

## implement · implementer
- [ ] Si falla la relectura de mediciones o del perfil tras registrar, no se ve el aviso REQ-009 (riesgo del plan §6).

## spec (rework) · spec-writer
- [ ] Hay que actualizar el test de AC-007.6 para que registre peso y grasa en la medición del 2026-10-05.
