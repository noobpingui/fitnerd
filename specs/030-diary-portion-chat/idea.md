# Idea original · 030-diary-portion-chat

2026-10-30T06:35:46.385Z

Solo backend: endpoint para que el usuario del diario pregunte a un LLM cuántos gramos pesa un alimento o unidad (p. ej. "5 huevos", "un filete de pescado"). SIN RAG: llamada directa al LLM con system prompt estricto y salida estructurada (es_comida, gramos, unidad, nota). Si no es una pregunta de comida, el servidor responde un mensaje fijo. El servidor valida gramos (1 a 5000), recorta la nota (~100 caracteres), limita la pregunta (~200 caracteres), max_tokens bajo (~150), temperatura 0 y modelo pequeño tipo Haiku. Límite: 10 preguntas cada 6 horas por usuario en Redis, como el coach. Respuestas breves en español. Fuera de alcance: todo el frontend (ventana de chat, texto de aviso sobre la caja), que va en la siguiente feature.
