# Docs report 002 — Recuperación de contraseña por correo

## Archivos actualizados
| Archivo | Cambio y motivo |
|---|---|
| `README.md` | Nuevo punto en "What it offers" (recuperación de contraseña por correo, límites). Aviso en "Running it locally": `flask` sin `FLASK_ENV=development` carga `ProductionConfig` y apunta a producción (incidente de verify); el correo solo se registra en consola en local. Codificación comprobada: ASCII antes y después. |
| `CLAUDE.md` (solo `## Proyecto`) | Área de autenticación con recuperación de contraseña; variables de despliegue en EC2 (`FRONTEND_BASE_URL` obligatoria por F1, `RESEND_API_KEY`, `MAIL_FROM`) y prueba manual con cuenta real (F2); punto delicado de `FLASK_ENV`. UTF-8 con CRLF conservado. |

## Documentación no tocada
- `backend/.env.example`: ya lo actualizó la implementación (MAIL_BACKEND, RESEND_API_KEY, MAIL_FROM, FRONTEND_BASE_URL, PROXY_FIX_X_FOR). No se añadió `FLASK_ENV` porque no es parte del diff; queda cubierto en README y CLAUDE.md.
- `.env.example` raíz y `frontend/.env.example`: la feature no añade variables.
- `frontend/README.md`: sin cambios en cómo correr o testear.
- `docs/sdd/decisions/**`: fuera de mi alcance (ADR-0014 y ADR-0015 ya existen).
- `docs/sdd/00-discovery.md`: foto histórica.
- Otras secciones de `CLAUDE.md`: solo cambian mediante ADR.
- F3 y F7 de review quedan como tareas futuras (no documentadas, no son comportamiento actual).

## Comentarios del usuario
Gate de docs, iteración 1 (2026-10-05). Copiado literalmente por el orquestador:

> 1. Si y si 2. Si. 3. Si

El "Si" del punto 1 aprueba esta propuesta del orquestador: añadir a la sección **Despliegue** de `CLAUDE.md` (Proyecto) un paso explícito **previo** al despliegue: crear la cuenta de Resend y verificar el dominio `fitnerd.betofallas.dev` (registros SPF y DKIM), según ADR-0014.

**Aplicado (iteración 1):** se añadió a la sección Despliegue de `CLAUDE.md` (Proyecto) el paso previo de crear la cuenta de Resend y verificar el dominio `fitnerd.betofallas.dev` (SPF y DKIM), según ADR-0014. Los puntos 2 y 3 ("Si") no requieren cambios adicionales en la documentación.
