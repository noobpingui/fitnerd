# ADR-0033: Preparación de la foto de una comida en el navegador y envío `multipart` por `apiFetch`

- **Estado:** Propuesta · 2026-10-22 (plan de `025-meal-photo-upload`)
- **Decidido por:** el `planner`; pendiente de revisión por el usuario en el gate de `review`.

## Contexto
La spec 025 conecta el diario con `POST /api/meals/analyze` (spec 024, ADR-0032), que recibe un único archivo en el
campo `image` (`multipart/form-data`, JPEG, PNG o WebP de hasta 3 MB) y no admite HEIC. La app debe enviar siempre un
JPEG con la orientación de la foto aplicada, con el lado mayor reducido a 1600 px y de 3 MB como mucho, y debe leer las
fotos HEIC o HEIF cuando el navegador sepa hacerlo, **sin dependencias nuevas**. Es la primera subida de archivos del
frontend: `apiFetch` (`src/lib/apiClient.ts`) siempre fija `Content-Type: application/json` y serializa el cuerpo con
`JSON.stringify`. Además, jsdom (el entorno de los tests) no decodifica imágenes ni implementa `canvas`.

Opciones consideradas:
1. **Decodificar y orientar:** leer la orientación EXIF a mano y girar en el `canvas`; `createImageBitmap` con
   `imageOrientation: "from-image"`; o decodificar con `HTMLImageElement` (`img.decode()`), que los navegadores actuales
   (Chrome 81+, Firefox 77+, Safari 13.1+) ya muestran y dibujan en el `canvas` con la orientación aplicada, igual que la
   vista previa.
2. **HEIC:** una librería de conversión (p. ej. `heic2any`), frente a confiar en el decodificador del navegador.
3. **Subida:** una función `fetch` aparte para `multipart`, frente a ampliar `apiFetch` para aceptar `FormData`.
4. **Pruebas:** simular `canvas` y `Image` en jsdom, frente a aislar el código del navegador detrás de un puerto.

## Decisión
- La foto se decodifica con `HTMLImageElement` desde una URL `blob:` y se dibuja en un `canvas` al tamaño de destino;
  `naturalWidth` y `naturalHeight` ya llegan orientados. Se codifica con `canvas.toBlob("image/jpeg", 0.85)`. Así la
  imagen enviada coincide con la vista previa, sin leer EXIF a mano y sin metadatos (el `canvas` no los copia).
- HEIC y HEIF se leen con el mismo decodificador: si el navegador no los sabe leer (Chrome en Windows), la decodificación
  falla y se muestra «No se pudo leer la foto…». Sin dependencias nuevas.
- El código que usa APIs del navegador vive detrás del puerto `PhotoProcessor` (`readSize`, `toJpeg`,
  `createPreviewUrl`, `revokePreviewUrl`) en `src/features/diary/photo.ts`, con el adaptador `browserPhotoProcessor`.
  La regla (tipos, 20 MB, 1600 px, 3 MB) son funciones puras que reciben el puerto; los tests usan un
  `FakePhotoProcessor` escrito a mano (`src/test/photoFixtures.ts`). `MealPhotoDialog` recibe el puerto por prop, con el
  adaptador del navegador por defecto.
- `apiFetch` acepta `FormData` como cuerpo: lo envía tal cual y no fija `Content-Type` (el navegador pone el
  `boundary`); el resto de su comportamiento (token, 401, `ApiError`) no cambia.

## Consecuencias
- La orientación y la lectura de HEIC dependen del navegador: no se pueden probar en jsdom y se comprueban a mano
  (foto vertical de un móvil con EXIF 6 y una HEIC en Safari) en la verificación de la feature.
- El adaptador `browserPhotoProcessor` no tiene tests unitarios; es una capa fina sin reglas.
- Si un navegador dejara de aplicar la orientación al dibujar en el `canvas`, habría que pasar a `createImageBitmap` o
  leer EXIF; queda acotado al adaptador.
- Cualquier subida futura de archivos puede usar `apiFetch` con `FormData`.
