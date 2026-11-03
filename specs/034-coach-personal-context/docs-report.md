# Reporte de documentación 034 — El coach conoce tu perfil, nombre, macros y progreso al responder

## 1. Archivos actualizados
| Archivo | Qué cambió | Motivo (enlazado a la spec o al diff) |
|---|---|---|
| `README.md` | En la lista de funcionalidades, el AI Coach menciona que conoce al usuario y que un interruptor lo desactiva. En «Design guarantees» del pipeline RAG se describe el contexto personal: datos de cuenta leídos en el servidor, datos de pantalla descartados en bloque si no valen y nombre anonimizado en la traza (incluidas las partes de un nombre compuesto y `previous_names`). Sigue en inglés y en UTF-8. | REQ-001 a REQ-003, REQ-010, REQ-013, NFR-001 a NFR-003; ADR-0038 |
| `CLAUDE.md` (solo sección Proyecto) | Fila del Coach de IA: `use_personal_context`, `personal_context`, `previous_names`, nombre y perfil leídos del servidor, interruptor con `localStorage`, nombre anonimizado en Langfuse, ADR-0038 y spec 034. | Diff de `coach_routes.py`, `personalContextPreference.ts` y ADR-0038 |
| `docs/deploy-runbook.md` | Nuevo «Caso A (sin migraciones): 034» con el paso de merge y CD, las comprobaciones manuales y la marcha atrás. | La feature cambia el comportamiento visible del coach y la traza; sin migración ni variables |

## 2. Documentación revisada y no tocada
| Archivo | Motivo de no tocarlo |
|---|---|
| `.env.example` (raíz, `backend/`, `frontend/`) | No hay variables de entorno nuevas. |
| `docs/backlog.md` | Backlog del proyecto; los pendientes de la 034 están en `specs/034-coach-personal-context/backlog.md`. |
| `docs/sdd/decisions/**` | ADR-0038 ya existe y está aceptada; las ADRs no son del doc-keeper. |
| Política de privacidad (`PrivacyPolicyPage.tsx`) | Ya actualizada en el diff (REQ-011); es código, no documentación. |

## 3. Conclusión
Se actualizaron README, la fila del Coach en la sección Proyecto de `CLAUDE.md` y el runbook de despliegue. Los tres archivos siguen en UTF-8. No hacían falta cambios en `.env.example`.
