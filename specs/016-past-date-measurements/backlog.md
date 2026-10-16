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
- [x] Hay que actualizar el test de AC-007.6 para que registre peso y grasa en la medición del 2026-10-05.

## verify · verifier
- [ ] Warnings de oxlint react(only-export-components) en frontend/src/components/ui/button.tsx:64 y frontend/src/components/ui/form.tsx:159 (previos a la feature, no tocados).
- [ ] Build de frontend avisa de chunk de 1,087 kB (>500 kB); no bloquea.

## review · reviewer
- [x] F1 (MENOR): en RegisterMetricDialog.tsx:112-151, los errores de peso, grasa y masa muscular y el mensaje "Registra al menos un valor" no están enlazados a su campo con aria-describedby (el plan §3.4 lo pide), porque NumberField no acepta esa prop.
- [x] F2 (MENOR): en BodyMetricsPage.tsx:51 y :79, "Registrar medición" se puede pulsar antes de que cargue el perfil. Mientras tanto la unidad vale kg, así que un usuario con el perfil en lb puede ver cómo la etiqueta y la conversión del peso cambian con el número ya escrito.
- [x] F3 (NIT): el test de AC-007.7 sustituye TrendChart por un stub y no comprueba el periodo de 1 mes.
- [x] F4 (NIT): las importaciones nuevas de PhysicalDataForm.tsx quedan intercaladas sin orden.
- [x] F5 (NIT): en PhysicalDataForm.tsx, si hay una medición posterior pero no hay perfil en caché, aparece el aviso con el peso escrito, no el del perfil (ya está en el backlog del implementer).
- [x] F6 (NIT): backlog.md:21 tiene la entrada de AC-007.6 aunque ya está resuelta en b1bd525.
