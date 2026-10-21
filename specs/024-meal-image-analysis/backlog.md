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

## implement · implementer
- [ ] T-041: `pillow` añadida a `backend/requirements.txt` por el orquestador con autorización explícita del usuario (el role-guard no deja al implementer editar ese archivo). Falta marcar la casilla T-041 en tasks.md.
- [ ] La orientación EXIF se pierde al quitar los metadatos; la 025 debe aplicarla al redimensionar en el cliente.
- [ ] En `vision_client.py`, el import de `FOODS_TOOL_NAME` y `FOODS_TOOL_SCHEMA` es local, dentro de `recognize_foods`, para evitar un ciclo de importación entre `extensions.py` y los servicios.
- [ ] Test incorrecto `test_analyses_write_nothing_to_the_database`: usa `user_id` "user-1" que no es UUID. Aprobado por el usuario devolverlo al test-author junto con 3 E501 (L73 y L213 de test_meal_analysis_routes.py, L225 de test_meal_image_rules.py).

## verify · verifier
- [ ] Revisión manual de precisión del modelo con ~10 fotos reales contra el proveedor real en local (spec Q9), en el gate de review.
- [ ] Documentar el paso manual de producción de Bedrock (permisos de la instancia EC2, BEDROCK_VISION_MODEL_ID, BEDROCK_REGION) en docs/deploy-runbook.md (Art. P4), en la etapa docs.
- [ ] Actualizar la Política de privacidad al enviar fotos a AWS en la spec 025 (Q7).

## review · reviewer (iteración 1, CHANGES_REQUESTED)
- [x] F2 MENOR (planner): un WebP de 8000×8000 de solo 2,5 KB obliga a reservar unos 256 MB y 0,37 s de CPU por petición. La decodificación se hace antes del límite de uso, también en las peticiones que acaban en 429, así que el límite no acota este coste, al contrario de lo que dice la sección 6 del plan.
- [x] F3 MENOR (test-author): el test de AC-003.5 no prueba el límite de 4 MB del cuerpo, porque el archivo enviado ya supera los 3 MB. Debería enviar una imagen pequeña y un campo extra grande.
- [x] F4 MENOR (implementer): con BEDROCK_REGION vacía y el modelo configurado, create_app falla al arrancar en lugar de dejar el endpoint en 503.
- [x] F5 NIT (implementer): comentario nuevo en inglés en exceptions/custom_exceptions.py:42.
- [x] F6 NIT (implementer): si el bloque toolUse trae un input que no es un dict, salta un AttributeError en lugar de VisionProviderError. Acaba igualmente en 503.
- [x] F7 NIT (test-author): en AC-N001.1, el diario se consulta con un usuario distinto del que hizo los análisis.
- [x] F8 NIT (planner): se pierde el perfil ICC del JPEG; conviene comprobarlo en la revisión manual de Q9.

## plan · planner (corrección de review F1)
- [ ] Pasar gunicorn a hilos o a más workers cuando la memoria de decodificación esté acotada (F2), para que un análisis o una pregunta al coach no bloqueen al resto de la API.
- [ ] Fijar un tiempo límite (y los reintentos) en el cliente de Anthropic del coach (`utils/llm_client.py`, hoy con el valor por defecto del SDK); con `--timeout 90`, gunicorn lo corta a los 90 s en lugar de a los 30 s.
- [ ] Valorar un plazo absoluto para la llamada a Bedrock si en el futuro se usa streaming (`converse_stream`), donde `read_timeout` ya no equivale al tiempo total.
- [ ] doc-keeper: mencionar en el runbook que, tras desplegar, hay que comprobar que gunicorn arrancó con `--timeout 90`.
- [ ] Si el role-guard no deja al implementer editar `backend/Dockerfile` (fuera de los globs de producción), lo aplica el orquestador con autorización del usuario.

## implement · orquestador (excepción autorizada)
- [ ] T-059: `backend/Dockerfile` (fuera de los globs `prod` de `.sdd/config.json`) lo editó el orquestador con autorización explícita del usuario ("La opcion 1"), porque el role-guard bloqueó al implementer. El usuario prefirió no tocar `config.json` a mitad de feature. Pendiente: incluir `backend/Dockerfile` en los globs `prod` en un `chore/…` aparte.

## verify · verifier (iteración 2)
- [ ] Comprobar en producción que un análisis lento devuelve 503 con JSON y no 502 del proxy (el test T-058 solo verifica la configuración del CMD, no el comportamiento real).
- [ ] Las líneas de `backend/Dockerfile` (salvo FROM y CMD) van con sangría de dos espacios; es cosmético, sin efecto en el build.

## review · reviewer (iteración 2, APPROVED)
- [x] F9 NIT (test-author): el test de configuración T-058 está en `test_services/`, aunque no prueba ningún servicio.
- [ ] Hacer un `chore/…` que añada `backend/Dockerfile` a los globs `prod` de `.sdd/config.json`.
- [ ] Documentar el paso manual de producción (Art. P4), incluida la comprobación de `--timeout 90`, en la etapa docs.

## plan · planner (corrección de review F2-F9, iteración 2)
- [ ] Pasar gunicorn a hilos o a más workers, midiendo antes la memoria por worker en la t3.micro (F2 ya no lo bloquea).
- [ ] Si la revisión de Q9 muestra que quitar el ICC empeora el reconocimiento, valorar conservar un perfil saneado o convertir a sRGB.
- [ ] Valorar un test de memoria de la validación de un JPEG progresivo grande (las reservas de libjpeg no se ven con tracemalloc).
- [ ] Un test de que un WebP truncado da 400 (hoy ya lo rechaza el demuxer al abrir; no se añade para no meter otro test que ya pasa).
- [ ] Riesgo F2: un archivo con la estructura correcta pero píxeles corruptos ya no da 400; llega al proveedor y acaba en 503, que cuenta para el límite (mismo criterio que el PNG).
- [ ] Riesgo F2: el plan se apoya en que libwebp reserva con calloc sin ocupar memoria residente con glibc mientras no se decodifique.

## tests · orquestador (excepción autorizada)
- [ ] F9: `backend/tests/test_services/test_server_timeout.py` lo borró el orquestador con `git rm` y autorización explícita del usuario ("Autorizo"), porque el test-author no puede borrar archivos. Su contenido está idéntico en `test_gunicorn_config.py`.
- [ ] doc-keeper/harness: permitir al test-author borrar o renombrar archivos de tests propios.

## review · reviewer (iteración 3, APPROVED)
- [x] F10 NIT (test-author): `test_icc_profile_is_stripped` no cubre PNG; el descarte de `iCCP` solo lo garantiza la lista blanca de `_strip_png`, sin un test que lo fije.
- [x] F11 NIT (planner): el código comprueba las dimensiones antes que la integridad, al revés que el orden «lectura, dimensiones» de la sección 6 de la spec. Un archivo truncado de más de 8000 px da el mensaje de las dimensiones; desde F2 la integridad se puede comprobar antes sin coste.
- [ ] Revisión manual de Q9 con unas 10 fotos reales, incluida alguna en Display P3, para confirmar que quitar el ICC no empeora el reconocimiento.
