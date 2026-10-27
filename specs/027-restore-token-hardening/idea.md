# Idea original · 027-restore-token-hardening

2026-10-27T05:55:23.193Z

Endurecer la firma y la validación del token de restauración de la 026. F2: ProductionConfig debe fallar al arrancar si SECRET_KEY falta o es el valor por defecto "DEFAULT SECRET" (backend/config.py:47). F3: parse_snapshot_payload (backend/services/meal_rules.py) acepta v == 1.0 y no pone tope a position; debe exigir entero estricto y un máximo razonable. Sin migración. Cuidado con los tests y despliegues que dependan del valor por defecto.
