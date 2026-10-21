# Backlog · 024-meal-image-analysis

## spec · spec-writer
- [ ] Tope de gasto global con el proveedor y medición del coste real por imagen.
- [ ] Actualizar la Política de privacidad (las fotos van a Amazon Web Services) en la 025.
- [ ] Un texto del usuario que acompañe a la foto.
- [ ] Admitir HEIC si la 025 no lo convierte en el cliente.

## spec · spec-writer (iteración tras respuestas)
- [ ] Tope de gasto global con el proveedor y medición del coste real por imagen (Q5).
- [ ] Actualizar la Política de privacidad para mencionar el envío de fotos a AWS, en la 025 (Q7).
- [ ] Revisión manual de la precisión con unas 10 fotos reales en el gate de review (Q9).

## plan · planner
- [ ] Caché de prompt de Bedrock para el bloque del catálogo y medición del coste real por análisis.
- [ ] Tope de gasto global con el proveedor (ya previsto en la spec, Q5).
- [ ] Enviar los sinónimos del catálogo en el prompt si mejora el reconocimiento.
- [ ] Límite global de memoria o concurrencia al decodificar fotos grandes (WebP de 8000 × 8000).
- [ ] Política de privacidad: mencionar el envío de fotos a AWS (va con la 025).

## tasks · task-breaker
- [ ] La documentación del paso manual de producción (IAM `bedrock:InvokeModel`, acceso al modelo, variables, IMDS) y el ADR-0032 no llevan tarea. El plan los asigna al doc-keeper (`docs/deploy-runbook.md`) y al planner (ADR).
- [ ] La revisión manual de Q9, con unas 10 fotos reales contra Bedrock, queda para el gate de review.

## tests · test-author
- [ ] Cuando se implemente el servicio, revisar que `InMemoryUploadRequest._get_file_stream` acepte la firma de llamada posicional `(total_content_length, content_type)` usada en el test.
- [ ] Falta un test automatizado de que `config.py` y `create_app` leen `BEDROCK_VISION_MODEL_ID` y `BEDROCK_REGION`. Solo se cubren indirectamente (AC-009.4, vía `vision_client.client = None`).
- [ ] Los tests de memoria con imágenes grandes (8000x8000 WebP) no están automatizados.
- [ ] Proceso: el test-author editó una vez el archivo del servicio con un script de Python desde la shell (dos líneas de aserciones dentro de `backend/tests/**`), contra su límite de no escribir desde la shell.

## tests · verifier (red)
- [ ] Dos tests de ruta (test_meal_analysis_routes.py líneas 219 y 545) leen `["items"]` del cuerpo antes de comprobar el estado. Hoy fallan por 404 y pasarán al existir la ruta; conviene que el test-author compruebe el status antes de leer el cuerpo, para que el fallo sea más claro.
