# Informe de documentación: 006-user-profile

Base del diff: `chore/frontend-redesign` (`state.json.base_branch`).

## Archivos actualizados

| Archivo | Motivo |
|---|---|
| `README.md` | Nueva viñeta "Onboarding and profile" en "What it offers": el perfil físico, la fecha de nacimiento, el nivel de actividad y la meta ahora se guardan por cuenta en el servidor. Codificación verificada con `file`: ASCII/UTF-8, sin UTF-16, finales de línea LF como el original. |
| `CLAUDE.md` (solo `## Proyecto`) | Nueva fila en "Áreas funcionales": perfil y onboarding (`profile_routes`; `onboarding`, `profile`, `macros`), con `GET`/`PUT /api/profile`, la edad calculada desde `users.date_of_birth` (ADR-0019) y el cálculo de calorías y macros en el frontend. Codificación UTF-8 y CRLF intactos. |

## Documentación que no se tocó

- `.env.example` (los tres): la feature no añade variables de entorno.
- Secciones de despliegue y de "Running it locally" del README y de CLAUDE.md: la migración nueva (`c6a1f0d2e9b4`) se aplica con el mismo `flask db upgrade` ya documentado, y el CD ya avisa de las migraciones pendientes.
- `frontend/README.md`: no cambian comandos ni estructura de ejecución.
- `docs/`: no hay documentación técnica que describa estos endpoints; el ADR-0019 y su índice ya fueron escritos por el planner (y `docs/sdd/decisions/` queda fuera de mi alcance).
- Otras secciones de CLAUDE.md (SDD, Aprobación, Convenciones): solo cambian mediante ADR.
- README (inglés): no se menciona Macros porque el rediseño aún no lo documenta; queda fuera de esta feature.
