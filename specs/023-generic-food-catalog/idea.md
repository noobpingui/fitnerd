# Idea original · 023-generic-food-catalog

Fecha: 2026-10-21T05:27:32.765Z

Catálogo genérico de alimentos en español (023): una tabla propia de unos 300 alimentos simples que sustituye a USDA en la búsqueda del diario, para que el usuario encuentre un alimento de forma sencilla y vea sus macros por 100 g (calorías, proteína, carbohidratos y grasa), sin las miles de variantes en inglés de USDA.

REGLAS DE LA TABLA:
(1) Solo alimentos simples, de un solo ingrediente; nada de platos ni combinaciones (no «arroz con frijoles», no «pan integral con mermelada», no «huevo con tocineta») porque al combinar alimentos los valores cambian mucho. Un alimento procesado de ingrediente simple, como el pan integral o el queso, cuenta como simple; un plato preparado no. «Huevo cocido» es simple; «huevo frito» o «plátano maduro frito» no, porque llevan aceite.
(2) Todos los nombres y datos en español, con nombres neutros y comunes (por ejemplo «banano», «frijoles») y que el usuario pueda reconocer; la lista debe admitir sinónimos regionales para la búsqueda.
(3) Cocido en la mayoría de los casos, y crudo solo donde es lo normal comerlo así (frutas, verduras de ensalada); arroz, pasta, avena, legumbres y carnes van cocidos, y el nombre lo indica claramente («cocido», «cocida», «a la plancha»). Un alimento tiene una sola versión en la lista.

DATOS: los macros salen de USDA (ya cargado en public.foods) sin modificarlos; lo que se cura es el nombre y la versión elegida. Los alimentos de comida local que USDA no tiene (por ejemplo gallo pinto como ingredientes sueltos) se añaden a mano. Los datos se preparan en un CSV que el usuario revisa antes de cargarse en la base.

ALCANCE: el diario (feature 022) busca solo en este catálogo; los alimentos personalizados siguen existiendo; /foods y la tabla foods de USDA se conservan como fuente pero dejan de mostrarse en el diario (decidir en el spec si /foods se retira o se redirige). Requiere migración (tabla nueva), que no se aplica sola, y carga de datos en producción. El catálogo servirá de lista cerrada para el análisis de imagen posterior.

NUMERACIÓN: esta feature es la 023; el análisis de imagen con Bedrock pasa a ser la 024 y subir foto y confirmar pasa a ser la 025.

Fuera de alcance: platos compuestos, marcas, Branded Foods, medidas caseras, fotos y análisis de imagen.

Contexto: specs/022-meal-diary/, specs/021-usda-food-database/ y docs/backlog.md (sección «Plan: registro de comidas con foto y datos de USDA»).
