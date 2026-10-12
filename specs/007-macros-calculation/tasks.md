# Tareas 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-12)

## Fase A0 — Andamiaje (implementer, modo scaffold)
No hay módulos, funciones ni clases nuevas que los tests vayan a importar (`calculateMacros` ya existe). Solo se añaden dos campos de tipo, rellenos con `Number.NaN` y sin lógica (plan 5.4), para que AC-008.1 falle por aserción y no por typecheck.
- [ ] T-000 [REQ-008] (scaffold) Añadir `exactKcal: number` a `MacroResult` y `exactTargetKcal: number` a `MacrosSummary`, rellenados provisionalmente con `Number.NaN` y sin lógica — `frontend/src/features/macros/calculations.ts`

## Fase A — Tests (test-author)
- [ ] T-001 [REQ-001, AC-001.1] (test) Perfil H en ft/in y lb: mantenimiento 2139 y objetivo 1711 — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-002 [REQ-001, AC-001.2, AC-001.3] (test) Edad por cumpleaños: 29 años el 11-10-2026 (2142 / 1714) y 30 el 12-10-2026 (2136 / 1709) — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-003 [REQ-002, AC-002.1, AC-002.2] (test) Mantenimiento por nivel de actividad en H y M (`it.each`) — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-004 [REQ-003, AC-003.1] (test) Objetivo diario para las cinco metas — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-005 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) Suelo calórico en M y H, mantenimiento sin suelo, y gramos y kcal de cada macro — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-006 [REQ-004, AC-004.4, AC-004.5] (test) Objetivo 1363 sin suelo; las cinco metas dan 1200 de objetivo y 872 de mantenimiento — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-007 [REQ-005, AC-005.1] (test) Reparto estándar de macros (160 g / 47 g / 160 g) — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-008 [REQ-006, AC-006.1, AC-006.2, AC-006.3] (test) Tope de proteína por IMC 27: 175 g en kg y en lb, 175 g con 90 kg y 170 g con 85 kg, y resto del reparto de AC-006.1 — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-009 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) Mínimo de 100 g de carbohidratos: cesión de grasas, grasas al 20 %, cesión de proteínas, caso que no lo activa y caso combinado con suelo — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-010 [REQ-008, AC-008.1] (test) Bucle sobre las 400 combinaciones límite: sin negativos, objetivo >= suelo y |Σ exactKcal − exactTargetKcal| < 0,001 — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-011 [REQ-008, AC-008.2] (test) Suma de porcentajes sin redondear igual a 1 (tolerancia 1e-6) en los perfiles de los AC anteriores — `frontend/src/features/macros/calculations.test.ts`
- [ ] T-012 [REQ-009, AC-009.1, AC-009.2] (test) `/macros` muestra objetivo, gramos y porcentajes de los perfiles de AC-006.1 y AC-007.2 — `frontend/src/features/macros/pages/MacrosPage.test.tsx`
- [ ] T-013 [REQ-009, AC-009.3, AC-009.5] (test) `/macros` en kJ (7150) con el perfil de AC-005.1, y objetivo 1200 kcal con mantenimiento 1427 kcal con el perfil de AC-004.1 — `frontend/src/features/macros/pages/MacrosPage.test.tsx`
- [ ] T-014 [REQ-010, AC-010.1, AC-010.2, AC-010.3] (test) La nota informativa contiene "Mifflin-St Jeor", el tope de IMC 27, el mínimo de 100 g y el suelo de 1200/1500 kcal — `frontend/src/features/macros/pages/MacrosPage.test.tsx`
- [ ] T-015 [REQ-009, AC-009.4, AC-009.5] (test) `/home` muestra 3379 kcal, 459 g, 175 g y 94 g con el perfil de AC-006.1, y 1200 kcal con el de AC-004.1 — `frontend/src/features/home/pages/HomePage.test.tsx`

## Fase B — Implementación (implementer)
- [ ] T-020 [REQ-004] (impl) Añadir `MIN_TARGET_KCAL` (1500 H / 1200 M) y aplicar el suelo al objetivo diario siempre, sin tocar el mantenimiento — `frontend/src/features/macros/calculations.ts`
- [ ] T-021 [REQ-006] (impl) Añadir `PROTEIN_CAP_BMI` y calcular el peso de referencia `min(kg, 27 × m²)` para la proteína — `frontend/src/features/macros/calculations.ts`
- [ ] T-022 [REQ-005, REQ-007] (impl) Reparto estándar y mínimo de 100 g de carbohidratos (`MIN_CARBS_G`, `MIN_FAT_SHARE`): grasas ceden hasta el 20 % y después proteínas como resto; eliminar el `Math.max(…, 0)` provisional — `frontend/src/features/macros/calculations.ts`
- [ ] T-023 [REQ-008] (impl) Rellenar `exactKcal` y `exactTargetKcal` con valores reales, calcular `share = exactKcal / target`, gramos desde kcal sin redondear, y sustituir los comentarios provisionales por comentarios de la spec 007 — `frontend/src/features/macros/calculations.ts`
- [ ] T-024 [REQ-001, REQ-002, REQ-003] (impl) Verificar que conversión de unidades, edad, Mifflin-St Jeor y factores de actividad y meta cumplen los AC (comportamiento ya existente; solo ajustar si algún test falla) — `frontend/src/features/macros/calculations.ts`
- [ ] T-025 [REQ-010] (impl) Sustituir el párrafo de la nota informativa por el texto literal de la sección 6 de la spec, manteniendo "Mifflin-St Jeor" resaltado — `frontend/src/features/macros/pages/MacrosPage.tsx`
- [ ] T-026 [REQ-009] (impl) Confirmar que `MacrosPage` y `HomePage` consumen el nuevo `MacrosSummary` sin cambios de lógica (kJ sobre kcal redondeadas, porcentaje entero); sin edición salvo fallo de test — `frontend/src/features/home/pages/HomePage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-001 | T-024 |
| REQ-001 | AC-001.2 | T-002 | T-024 |
| REQ-001 | AC-001.3 | T-002 | T-024 |
| REQ-002 | AC-002.1 | T-003 | T-024 |
| REQ-002 | AC-002.2 | T-003 | T-024 |
| REQ-003 | AC-003.1 | T-004 | T-024 |
| REQ-004 | AC-004.1 | T-005 | T-020 |
| REQ-004 | AC-004.2 | T-005 | T-020 |
| REQ-004 | AC-004.3 | T-005 | T-020 |
| REQ-004 | AC-004.4 | T-006 | T-020 |
| REQ-004 | AC-004.5 | T-006 | T-020 |
| REQ-005 | AC-005.1 | T-007 | T-022 |
| REQ-006 | AC-006.1 | T-008 | T-021 |
| REQ-006 | AC-006.2 | T-008 | T-021 |
| REQ-006 | AC-006.3 | T-008 | T-021 |
| REQ-007 | AC-007.1 | T-009 | T-022 |
| REQ-007 | AC-007.2 | T-009 | T-022 |
| REQ-007 | AC-007.3 | T-009 | T-022 |
| REQ-007 | AC-007.4 | T-009 | T-022 |
| REQ-008 | AC-008.1 | T-010 | T-023 |
| REQ-008 | AC-008.2 | T-011 | T-023 |
| REQ-009 | AC-009.1 | T-012 | T-026 |
| REQ-009 | AC-009.2 | T-012 | T-026 |
| REQ-009 | AC-009.3 | T-013 | T-026 |
| REQ-009 | AC-009.4 | T-015 | T-026 |
| REQ-009 | AC-009.5 | T-013, T-015 | T-026 |
| REQ-010 | AC-010.1 | T-014 | T-025 |
| REQ-010 | AC-010.2 | T-014 | T-025 |
| REQ-010 | AC-010.3 | T-014 | T-025 |
