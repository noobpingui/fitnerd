# Review NNN — <Título de la feature>

- **Iteración:** 1 de 3
- **Commit / diff revisado:** `git diff main...<rama>` @ `<sha>`
- **Veredicto:** APPROVED | CHANGES_REQUESTED

## 1. Resumen
<!-- 2 a 4 líneas: qué hace el cambio y la impresión general. -->

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 | Sí / No / Parcial | |

## 3. Cumplimiento del plan
<!-- Desviaciones respecto a plan.md y si están justificadas. -->

## 4. Checklist de la constitución
- [ ] Art. 2: cada agente se mantuvo en su rol (los tests no se tocaron durante implement; ver el historial de commits por etapa)
- [ ] Art. 4: los marcadores `SDD:` son coherentes con los AC que prueban
- [ ] Art. 5: no hay tests borrados, saltados ni debilitados; fakes inyectados, sin llamadas externas reales
- [ ] Art. 6: capas respetadas; excepciones de dominio; `apiFetch`; organización por feature
- [ ] Art. 6.4: la migración está incluida si cambian los modelos
- [ ] Art. 7: sin secretos; `@require_auth` y filtrado por `user_id`; input validado
- [ ] Art. 6.11: textos visibles en español correcto

## 5. Hallazgos
<!--
Severidad:
  BLOQUEANTE  impide aprobar
  MAYOR       debe corregirse ahora
  MENOR       se puede diferir a una tarea futura con aprobación del usuario
  NIT         sugerencia opcional
Responsable: el agente al que el orquestador devuelve el hallazgo (spec-writer | planner | test-author | implementer).
-->
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | | | | |

## 6. Decisión
<!-- APPROVED solo si no hay hallazgos BLOQUEANTES ni MAYORES abiertos. -->
