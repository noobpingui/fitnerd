# Idea original · 019-auth-email-integrity

Fecha: 2026-10-18T21:00:43.469Z

Garantizar la integridad de los correos guardados: recortar los espacios de los correos ya guardados (la migración de la 014 solo los pasó a minúsculas), añadir una garantía en la base (CHECK email = lower(email) o índice único funcional) una vez migrados los datos, y valorar las filas antiguas de la tabla de solicitudes de restablecimiento con correos en mayúsculas. Lleva migración Alembic con volcado previo y falla sin modificar nada si hay conflictos.
