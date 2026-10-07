# Idea original · 004-coach-observability

Fecha: 2026-10-06

Observabilidad del coach de IA con Langfuse Cloud. Cada pregunta al coach genera una traza en Langfuse con un paso por fase: el embedding de la pregunta (Voyage), la recuperación en pgvector (qué fragmentos salieron y a qué distancia, y si se superó el umbral) y la generación con Claude (modelo, tokens, coste y latencia). Cada traza lleva puntuaciones automáticas: si el coach respondió o dijo "no lo sé", y la distancia del mejor fragmento. La traza identifica al usuario solo por su ID interno, nunca por email ni nombre. Si Langfuse no está configurado o falla, el coach responde exactamente igual que hoy y sin latencia añadida apreciable. Fuera de alcance en esta feature: feedback del usuario en la UI, el análisis de progreso, datasets y evaluaciones, y la gestión de prompts.
