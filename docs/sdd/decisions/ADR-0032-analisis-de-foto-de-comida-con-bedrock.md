# ADR-0032: Análisis de la foto de una comida con Bedrock `converse` y salida estructurada, saneado en el servidor y metadatos quitados a nivel de bytes

- **Estado:** Propuesta · 2026-10-21 (plan de `024-meal-image-analysis`; ampliada en las iteraciones 1 y 2 de la review)
- **Decidido por:** el `planner`; pendiente de revisión por el usuario en el gate de `review`.

## Contexto
La spec 024 añade `POST /api/meals/analyze`: recibe la foto de una comida, la envía a un modelo de visión de Amazon
Bedrock y devuelve alimentos **solo del catálogo de la 023** (ADR-0031), con gramos, confianza y los macros del
catálogo. La foto no se guarda, no aparece en logs ni trazas y se envía sin metadatos (EXIF, XMP, texto). El fallo del
proveedor es un 503 y nunca debe filtrar la imagen.

Opciones consideradas:
1. **Cliente del proveedor:** SDK de Anthropic con Bedrock (`AnthropicBedrock`) frente a `boto3` (ya dependencia por S3)
   con la API `converse`.
2. **Formato de la respuesta del modelo:** texto JSON libre en la respuesta frente a una herramienta forzada
   (`toolChoice`) con un JSON Schema.
3. **Lista cerrada:** enviar todo el catálogo (unos 260 alimentos, id y nombre) en el prompt frente a buscar candidatos
   antes (por texto o embeddings) en una segunda llamada.
4. **Quitar metadatos:** volver a codificar la imagen con Pillow frente a filtrar segmentos y chunks a nivel de bytes.
5. **Subidas:** el `SpooledTemporaryFile` por defecto de Werkzeug (pasa a disco desde 500 KB) frente a guardar los
   archivos subidos en memoria.

## Decisión
- Adaptador `BedrockVisionClient` (`utils/vision_client.py`), singleton en `extensions.py`, sobre `boto3`
  `bedrock-runtime` y `converse`, con `read_timeout` de 30 s, `connect_timeout` de 5 s y un solo intento. El modelo se
  configura con `BEDROCK_VISION_MODEL_ID` (sin valor por defecto: sin él, 503) y la región con `BEDROCK_REGION`. Las
  credenciales vienen de la cadena por defecto de `boto3` (rol de la instancia en producción). No añade dependencias.
  `init_app` nunca impide arrancar la app (iteración 2 de la review, F4): con la región vacía o si `boto3` no puede
  crear el cliente, deja el proveedor sin configurar, lo avisa en el log y el endpoint responde 503.
- Salida estructurada por **tool use** forzado (`report_foods`, con un JSON Schema de `foods`). El servidor no confía
  en el esquema: `services/meal_image_rules.py` vuelve a sanear identificadores, gramos (enteros de 1 a 2000),
  confianza, nombres, duplicados y el máximo de 20, y toma nombres y valores del catálogo; los nutrientes usan
  `portion_nutrients` y `sum_nutrients` del diario.
- Todo el catálogo va en el prompt (id y nombre por línea). Es pequeño y estable, y evita una segunda llamada.
- Los metadatos se quitan **a nivel de bytes** sin volver a codificar (JPEG: fuera `APP1`–`APP13`, `APP15`, `COM` y lo
  que va tras el primer `EOI`; PNG: lista blanca de chunks; WebP: fuera `EXIF`, `XMP ` e `ICCP` y se limpian sus bits
  de `VP8X`). Pillow (declarada en `requirements.txt`, ya instalada vía `voyageai`) solo lee cabeceras y dimensiones.
- **El perfil ICC no se conserva** en ningún formato (iteración 2, F8): su cabecera lleva fabricante, modelo del
  dispositivo y fecha, y sus etiquetas son texto, lo que REQ-010 pide quitar; la mejora de color para reconocer
  alimentos es marginal y la 025 recodificará en sRGB sin perfil.
- **Validar no decodifica píxeles** (iteración 2, F2): la integridad se comprueba por la estructura (PNG con `verify` y
  sus CRC; JPEG con el recorrido de segmentos, un `SOF` de base, extendido o progresivo, un `SOS` y el `EOI`; WebP con
  el *demuxer* de libwebp y el recorrido RIFF). Así el coste de validar, que ocurre antes del límite de uso, es
  proporcional al tamaño del archivo (≤ 3 MB) y no a los píxeles: un WebP *lossless* o un JPEG progresivo de
  8000 × 8000 de pocos KB ya no reservan cientos de MB. A cambio, un archivo con estructura correcta y píxeles
  corruptos llega al proveedor (503) en lugar de dar 400, como ya pasaba con el PNG. Se descartaron mover la
  decodificación después del límite (cambia el orden de la spec y haría contar fotos ilegibles) y un tope de píxeles
  (AC-003.6 exige aceptar 8000 × 6000). Como la integridad ya no decodifica, forma parte de la «lectura» y se comprueba
  antes de las dimensiones, en el orden de la sección 6 de la spec (iteración 3, F11).
- Los errores del proveedor se registran solo con su tipo y su código (`describe_vision_error`), nunca con `str(exc)`,
  porque `ParamValidationError` de botocore incluye el valor de los parámetros (los bytes de la imagen).
- La app usa `InMemoryUploadRequest` (`app.request_class`) para que los archivos subidos nunca toquen el disco; la
  ruta fija `request.max_content_length` en 4 MB solo para esa petición y traduce el 413 de Werkzeug a
  `PayloadTooLargeError` con el mensaje en español.
- **Tiempo límite del servidor** (añadido en la iteración 1 de la review, F1): gunicorn corre con `--timeout 90` en el
  `CMD` de `backend/Dockerfile`, por encima del peor caso del servidor (unos 38 s: validación, credenciales del rol,
  5 s de conexión y 30 s de lectura de Bedrock) más margen para la subida del cuerpo. Con el valor por defecto (30 s),
  un worker *sync* moría antes de que botocore agotara sus tiempos y el cliente recibía un 502 de Caddy en lugar del
  503 de la spec. Se mantienen un solo worker y la clase *sync*: en la iteración 1, porque en una t3.micro atender
  varias fotos a la vez multiplicaba el pico de memoria de decodificar un WebP grande; desde la iteración 2 ese pico ya
  no existe, pero cambiar la concurrencia de toda la API queda fuera de esta spec. Un test
  (`tests/test_services/test_gunicorn_config.py`) lee el `CMD` y lo compara con los tiempos de `utils/vision_client.py`.

## Consecuencias
- Cambiar de modelo es cambiar una variable; cambiar de proveedor es escribir otro adaptador con `recognize_foods`.
- Cada análisis paga la imagen más el catálogo en tokens de entrada; la caché de prompt y un tope de gasto global
  quedan en el backlog.
- Se pierde la orientación EXIF (las dimensiones se conservan); la 025 redimensiona en el cliente con la orientación
  aplicada.
- La salida del modelo nunca aporta números nutricionales; un id que no está en el catálogo pasa a `unmatched`.
- En producción hace falta un paso manual: permiso `bedrock:InvokeModel` en el rol de la instancia, acceso al modelo,
  las dos variables y que el contenedor llegue a IMDSv2 (límite de saltos 2). Sin eso el endpoint responde 503 y el
  resto de la app no cambia.
- Mientras dura un análisis (hasta unos 38 s en el peor caso), el resto de peticiones esperan en cola en el único
  worker, como ya pasa con el coach. Pasar a hilos queda en el backlog (la memoria de decodificación ya no lo bloquea).
  El coach también gana margen: gunicorn ya no lo corta a los 30 s. El nuevo `--timeout` se aplica solo con el CD.
- Las fotos en Display P3 llegan al proveedor sin perfil y se interpretan como sRGB (colores algo menos saturados); se
  comprueba en la revisión manual con fotos reales.
