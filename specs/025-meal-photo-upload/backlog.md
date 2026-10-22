# Backlog · 025-meal-photo-upload

## spec · spec-writer
- [ ] AC-001.3 (pantalla completa a 375 px) y AC-004.3 (orientación EXIF) pueden ser difíciles de comprobar en jsdom. Conviene que el plan defina cómo probarlos o prever una revisión manual en el gate de review.
- [ ] Prueba manual en un iPhone real (HEIC y cámara) y en Chrome Android en el gate de review.
- [ ] Mostrar cuántos análisis quedan en la hora.
- [ ] Confirmar antes de descartar una propuesta, si el usuario lo pide más adelante.
- [ ] Cerrar en el backlog del proyecto los puntos de la 022 («añadir varios de una vez») y de la 024 (privacidad, HEIC y EXIF) al cerrar esta feature.

## plan · planner
- [ ] Abortar la petición de análisis al cerrar el diálogo (con `AbortController` en `apiFetch`).
- [ ] Ofrecer «Crear alimento personalizado» también desde la búsqueda de «Añadir otro alimento».
- [ ] Volver a codificar con menos calidad si el JPEG supera los 3 MB, en lugar de mostrar el error (muy improbable a 1600 px).
- [ ] Extraer un componente de búsqueda del catálogo compartido entre `AddFoodDialog` y `ProposalSearchStep` para quitar la duplicación de JSX.
