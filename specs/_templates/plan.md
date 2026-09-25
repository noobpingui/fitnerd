# Plan NNN — <Título de la feature>

- **Spec:** [spec.md](spec.md) (aprobada el <fecha>)

## 1. Resumen de la solución
<!-- 3 a 6 líneas: qué se construye y cómo encaja en la arquitectura existente. -->

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | | | |
| backend · repositories | | | |
| backend · services | | | |
| backend · routes | | | |
| frontend · features/<x> | | | |

## 3. Diseño
### 3.1 Modelo de datos y migraciones
<!-- Tablas y columnas nuevas o cambiadas, índices y migración Alembic necesaria. "No aplica" si no hay cambios. -->

### 3.2 Contratos de API
<!-- Método, ruta, auth, request, response y códigos de error. -->
| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|

### 3.3 Lógica de negocio
<!-- Servicios, reglas y dependencias inyectadas. -->

### 3.4 Frontend
<!-- Páginas, componentes, hooks, schemas zod y claves de query. -->

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | |

## 5. Estrategia de pruebas
<!-- Qué se prueba con tests unitarios de servicios (con fakes), qué con integración de rutas y qué con RTL. Fakes nuevos necesarios. -->

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|

## 7. Cumplimiento de la constitución
<!-- Enumera los artículos relevantes. Cualquier "DEBERÍA" que no se cumpla se justifica aquí. -->

## 8. ADRs
<!-- Decisiones de arquitectura nuevas: enlaza docs/sdd/decisions/ADR-XXXX-*.md, o indica "Ninguna". -->
