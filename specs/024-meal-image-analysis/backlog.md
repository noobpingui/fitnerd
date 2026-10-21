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
