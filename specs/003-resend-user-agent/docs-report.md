# Docs 003 — User-Agent propio en el envío de correos con Resend

## Archivos actualizados
| Archivo | Motivo |
|---|---|
| `CLAUDE.md` (sección `## Proyecto`, "Puntos delicados") | Nuevo punto: Resend rechaza el User-Agent por defecto de Python (403, Cloudflare 1010); `ResendTransport` envía `fitnerd/1.0 (+https://fitnerd.betofallas.dev)` y el cuerpo del error de Resend queda en el log (200 caracteres, sin API key). Ayuda a diagnosticar futuros 503. Codificación comprobada: UTF-8 con CRLF, sin cambios. |

## Documentación no tocada
- `README.md` y `frontend/README.md`: no hay funcionalidad visible nueva ni cambios de ejecución; la línea de recuperación de contraseña sigue siendo correcta.
- `.env.example` (raíz, `backend/`, `frontend/`): no hay variables nuevas (el User-Agent es fijo, Q2).
- `docs/**`: nada técnico afectado; `docs/sdd/decisions/**` queda fuera de mi alcance y el ADR-0014 no cambia de decisión.

## Recordatorio
Paso manual tras el despliegue (Q4): pedir un restablecimiento real y confirmar que el correo llega.
