# Tareas 009 — Indicadores de progreso de Métricas especificados y con tests

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-13)

<!--
Ámbito: solo frontend (`frontend/src/features/body-metrics/` y `frontend/src/features/onboarding/units.ts`). Sin backend ni migraciones.
Los tests con marcador `REQ-012 AC-012.3` son de la spec 006 y no se tocan (solo T-023 fija el reloj, plan §5.4).
Varios tests de página son de caracterización (pasan desde el principio, plan §5.6).
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo en `insights.ts`, `dateUtils.ts` y `units.ts`. La página y el gráfico no se tocan en el scaffold.

- [x] T-001 [REQ-003, AC-003.1] (scaffold) Añadir el tipo `RateIndicator` y la función exportada `rateIndicator(weightSeries, today)` que lanza `Error("not implemented")` — `frontend/src/features/body-metrics/insights.ts`
- [x] T-002 [REQ-004, AC-004.1] (scaffold) Añadir `"off_range"` a `PaceStatus` y las funciones exportadas `ratePercent` y `paceStatusFromPercent(pct, goal)` que lanzan `Error("not implemented")` — `frontend/src/features/body-metrics/insights.ts`
- [x] T-003 [REQ-005, AC-005.1] (scaffold) Añadir el tipo `ChartPoint` y la función exportada `trendChartData(metrics, field, fromIso, toDisplayWeight)` que lanza `Error("not implemented")` — `frontend/src/features/body-metrics/insights.ts`
- [x] T-004 [REQ-005, AC-005.1] (scaffold) Añadir la función exportada `periodStart(today, months)` que lanza `Error("not implemented")` — `frontend/src/features/body-metrics/dateUtils.ts`
- [x] T-005 [REQ-007, AC-007.3] (scaffold) Añadir la función exportada `heightCmFromAnswers(answers)` que lanza `Error("not implemented")` — `frontend/src/features/onboarding/units.ts`

## Fase A — Tests (test-author)

### Unitarios puros (`insights.test.ts`, `dateUtils.test.ts`, `units.test.ts`)
- [x] T-010 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.8, AC-001.9] (test) `latestWithDelta` sobre `seriesOf(..., "weight")`: referencia a 30 días, límite exacto, menos de 30 días, una sola medición, cambio 0 y última medición antigua — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-011 [REQ-002, AC-002.1, AC-002.2, AC-002.3] (test) `latestWithDelta` sobre `seriesOf(..., "body_fat_percentage")`: cambio negativo, positivo y sin cambio con una sola medición — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-012 [REQ-003, AC-003.1, AC-003.3, AC-003.4, AC-003.5, AC-003.6, AC-003.7, AC-003.8] (test) `rateIndicator`: pendiente semanal, mínimos de 3 mediciones y 10 días, límite de 28 días de la ventana y ritmo 0 — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-013 [REQ-003, AC-003.10, AC-003.11, AC-003.12, AC-003.13] (test) `rateIndicator` con `today = "2026-10-12"`: `stale` con más de 28 días, 28 días exactos sigue reciente, y `stale` antes que `insufficient` — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-014 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (test) `ratePercent` y `paceStatusFromPercent` con las mediciones de AC-003.1 (-0,5 kg con 78,5 kg) en las metas `lose`, `lose_slow`, `gain` y `maintain`, y ritmo 0 con `maintain` — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-015 [REQ-004, AC-004.6, AC-004.7, AC-004.8, AC-004.9, AC-004.12] (test) `paceStatusFromPercent`: más lento, más rápido, dirección contraria, `off_range` en `maintain` por ambos lados y cada límite de la tabla en las 5 metas — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-016 [REQ-005, AC-005.1, AC-005.2, AC-005.3, AC-005.4, AC-005.5] (test) `trendChartData`: promedio de 7 días con mediciones anteriores al periodo, medición de hace 7 días fuera, redondeo a un decimal, conversión a lb, mediciones sin peso, y sin `trend` con grasa — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-017 [REQ-005, AC-005.1] (test) `periodStart` con 1, 3 y 12 meses, ajuste a fin de mes, y `isWithinLastMonths` con una medición de justo hace 1 mes — `frontend/src/features/body-metrics/dateUtils.test.ts`
- [x] T-018 [REQ-006, AC-006.1, AC-006.2, AC-006.4, AC-006.5, AC-006.6] (test) `composition`: masa grasa, masa magra, FFMI, última medición con peso y grasa a la vez, altura 175,26 cm, sin grasa y valores en mediciones distintas — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-019 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (test) `composition.bmi` con la última medición de peso (no la de la composición), altura 5 ft 9 in y sin pesos — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-020 [REQ-010, AC-010.1] (test) `composition` con `heightCm = null`, 0 o no finito da `bmi` y `ffmi` a `null`, y `fatKg` y `leanKg` se calculan igual — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-021 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6] (test) `streak(metrics, today).weeks`: semanas seguidas, semana actual vacía, hueco, 0 semanas, domingo y varias mediciones en la misma semana — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-022 [REQ-009, AC-009.1, AC-009.3, AC-009.4] (test) `streak(metrics, today)`: `last30` con límites de 30 días incluidos, `total` y `lastDate` contando mediciones con cualquier valor — `frontend/src/features/body-metrics/insights.test.ts`
- [x] T-023 [REQ-007, AC-007.3, AC-006.4] (test) `heightCmFromAnswers`: cm, ft/in (175,26) y `null` con valor vacío, no finito o menor o igual que 0 — `frontend/src/features/onboarding/units.test.ts`

### RTL de página (`BodyMetricsPage.test.tsx`)
- [x] T-024 [REQ-003, AC-003.10] (test) Fijar el reloj en el `describe` raíz con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(new Date(2026, 9, 12, 12))`, con `vi.useRealTimers()` en `afterEach`, sin cambiar ninguna aserción existente (plan §5.4) — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-025 [REQ-001, AC-001.1, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8, AC-001.9] (test) Tarjeta "Peso": valor y "{cambio} {unidad} en 30 días" en kg y lb, una sola medición, última medición de peso, sin pesos y última medición antigua — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-026 [REQ-002, AC-002.1, AC-002.3, AC-002.4, AC-002.5] (test) Tarjeta "% Grasa": valor, "pts en 30 días", una sola medición, sin grasa y perfil en lb — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-027 [REQ-003, AC-003.1, AC-003.2, AC-003.4, AC-003.5, AC-003.9] (test) Tarjeta "Ritmo": valor en kg y lb, "Faltan registros para calcularlo" y mediciones sin peso que no cuentan — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-028 [REQ-003, AC-003.10, AC-003.13, AC-003.14] (test) Tarjeta "Ritmo": "—" y "Sin registros recientes" (prioridad sobre "Faltan registros…" y con una medición reciente sin peso) y sin estado de meta — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-029 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.5, AC-004.10, AC-004.13] (test) Estado de meta en página: "En ritmo con tu meta", "Más rápido…", "Más lento…", ritmo 0 con `maintain`, y sin estado con "Faltan registros…" o "Sin registros recientes" — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-030 [REQ-004, AC-004.4] (test) Meta `maintain` con -0,5 kg/sem: "Fuera del rango de tu meta" con el mismo `data-tone="warn"` que "Más rápido que tu meta" (AC-004.2), y sin "Más rápido…" ni "Más lento…" — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-031 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6] (test) "Composición corporal": masa grasa, masa magra, FFMI y descripción con `stat(label)`, en kg y lb, con altura en ft/in, y con "—" y el texto de registrar grasa — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-032 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5] (test) "IMC": última medición de peso, altura en ft/in, sin pesos y perfil en lb — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-033 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4, AC-008.5, AC-008.6] (test) "Racha": "{n} semanas" y "1 semana" (AC-008.5 con el reloj en 2026-10-18) — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-034 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5] (test) "Últimos 30 días", "{total} en total" y "Último registro": "1 registro" sin "1 registros", "0 registros" y mediciones sin peso — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`
- [x] T-035 [REQ-010, AC-010.1, AC-010.2, AC-010.3, AC-004.11] (test) Perfil no disponible: `getProfile` rechaza con `ApiError` (kg, "—" en IMC y FFMI sin "∞", "NaN" ni "0", ritmo sin estado de meta ni "Faltan registros…") y perfil en lb que se resuelve después del primer render — `frontend/src/features/body-metrics/pages/BodyMetricsPage.test.tsx`

### RTL del gráfico (`TrendChart.test.tsx`)
- [x] T-036 [REQ-005, AC-005.6] (test) `TrendChart` con stub local de `ResizeObserver` escrito a mano: con "Peso" aparecen "Registro" y "Tendencia (7 días)", y con "% Grasa" desaparece "Tendencia (7 días)" — `frontend/src/features/body-metrics/components/TrendChart.test.tsx`

## Fase B — Implementación (implementer)
Orden: utilidades y funciones puras, luego helper de onboarding, luego gráfico y página.

- [ ] T-040 [REQ-001, REQ-002, AC-001.1] (impl) Añadir `dayNumber` y `daysBetween` (enteros con `Date.UTC`) y usarlos en `latestWithDelta`; la referencia es la más reciente con `daysBetween >= 30` o la primera, y sin cambio si es la propia última — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-041 [REQ-008, REQ-009, AC-008.1] (impl) Reescribir `weekStart` con `dayNumber` y `streak` con `daysBetween` (`last30` con `0 <= días <= 30`), manteniendo firma y retorno — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-042 [REQ-003, AC-003.1] (impl) Implementar `rateIndicator`: `insufficient` con serie vacía, `stale` con `daysBetween(last, today) > 28` antes del mínimo, ventana de 28 días, mínimos de 3 mediciones y 10 días, y pendiente por mínimos cuadrados × 7 — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-043 [REQ-004, AC-004.1] (impl) Implementar `ratePercent` y `paceStatusFromPercent` con `off_range` en `maintain`, límites incluidos con `EPS = 1e-9`, y quitar el comentario de "provisionales" de `EXPECTED_RATE` — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-044 [REQ-005, AC-005.1] (impl) Implementar `periodStart` (ajuste a fin de mes) y reimplementar `isWithinLastMonths` como `isoDate >= periodStart(todayIsoDate(), months)` — `frontend/src/features/body-metrics/dateUtils.ts`
- [ ] T-045 [REQ-005, AC-005.1] (impl) Implementar `trendChartData`: promedio de 7 días en kg sobre la serie completa, recorte a `date >= fromIso`, conversión final con `round1` y sin `trend` con grasa o músculo — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-046 [REQ-006, REQ-007, REQ-010, AC-006.1] (impl) Hacer que `composition` acepte `heightCm: number | null` (`bmi` y `ffmi` a `null` si la altura no es válida) y comparar con `latestWeight !== undefined` — `frontend/src/features/body-metrics/insights.ts`
- [ ] T-047 [REQ-007, REQ-010, AC-007.3] (impl) Implementar `heightCmFromAnswers` (cm, ft/in con `CM_PER_IN` y `null` si no es finito o `<= 0`) — `frontend/src/features/onboarding/units.ts`
- [ ] T-048 [REQ-005, AC-005.6] (impl) Usar `periodStart` y `trendChartData` en el gráfico, manteniendo la leyenda y la línea de tendencia solo con peso — `frontend/src/features/body-metrics/components/TrendChart.tsx`
- [ ] T-049 [REQ-010, AC-010.1, AC-010.3] (impl) Calcular `today` una vez por render, `heightCm = profile ? heightCmFromAnswers(profile) : null`, y los indicadores en `useMemo` sobre `[metrics, profile, heightCm, today]`, con kg por defecto sin perfil — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-050 [REQ-003, REQ-004, AC-003.10, AC-004.4] (impl) Tarjeta "Ritmo" con `rateIndicator`: "—" con "Sin registros recientes" o "Faltan registros para calcularlo", estado de meta solo con `ok` y `profile?.goal`, `PACE_COPY.off_range` ("Fuera del rango de tu meta", tono `warn`) y `data-tone` en `KpiTile` — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`
- [ ] T-051 [REQ-009, AC-009.2] (impl) "Últimos 30 días" muestra "1 registro" en singular y "{n} registros" en los demás casos — `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-025 | T-040 |
| REQ-001 | AC-001.2 | T-010 | T-040 |
| REQ-001 | AC-001.3 | T-010 | T-040 |
| REQ-001 | AC-001.4 | T-010, T-025 | T-040 |
| REQ-001 | AC-001.5 | T-025 | T-049 |
| REQ-001 | AC-001.6 | T-025 | T-040 |
| REQ-001 | AC-001.7 | T-025 | T-040 |
| REQ-001 | AC-001.8 | T-010, T-025 | T-040 |
| REQ-001 | AC-001.9 | T-010, T-025 | T-040 |
| REQ-002 | AC-002.1 | T-011, T-026 | T-040 |
| REQ-002 | AC-002.2 | T-011 | T-040 |
| REQ-002 | AC-002.3 | T-011, T-026 | T-040 |
| REQ-002 | AC-002.4 | T-026 | T-040 |
| REQ-002 | AC-002.5 | T-026 | T-049 |
| REQ-003 | AC-003.1 | T-012, T-027 | T-042 |
| REQ-003 | AC-003.2 | T-027 | T-049 |
| REQ-003 | AC-003.3 | T-012 | T-042 |
| REQ-003 | AC-003.4 | T-012, T-027 | T-042 |
| REQ-003 | AC-003.5 | T-012, T-027 | T-042 |
| REQ-003 | AC-003.6 | T-012 | T-042 |
| REQ-003 | AC-003.7 | T-012 | T-042 |
| REQ-003 | AC-003.8 | T-012 | T-042 |
| REQ-003 | AC-003.9 | T-027 | T-042 |
| REQ-003 | AC-003.10 | T-013, T-028 | T-042, T-050 |
| REQ-003 | AC-003.11 | T-013 | T-042 |
| REQ-003 | AC-003.12 | T-013 | T-042 |
| REQ-003 | AC-003.13 | T-013, T-028 | T-042, T-050 |
| REQ-003 | AC-003.14 | T-028 | T-042, T-050 |
| REQ-004 | AC-004.1 | T-014, T-029 | T-043, T-050 |
| REQ-004 | AC-004.2 | T-014, T-029 | T-043, T-050 |
| REQ-004 | AC-004.3 | T-014, T-029 | T-043, T-050 |
| REQ-004 | AC-004.4 | T-014, T-030 | T-043, T-050 |
| REQ-004 | AC-004.5 | T-014, T-029 | T-043, T-050 |
| REQ-004 | AC-004.6 | T-015 | T-043 |
| REQ-004 | AC-004.7 | T-015 | T-043 |
| REQ-004 | AC-004.8 | T-015 | T-043 |
| REQ-004 | AC-004.9 | T-015 | T-043 |
| REQ-004 | AC-004.10 | T-029 | T-050 |
| REQ-004 | AC-004.11 | T-035 | T-049, T-050 |
| REQ-004 | AC-004.12 | T-015 | T-043 |
| REQ-004 | AC-004.13 | T-029 | T-050 |
| REQ-005 | AC-005.1 | T-016, T-017 | T-044, T-045 |
| REQ-005 | AC-005.2 | T-016 | T-045 |
| REQ-005 | AC-005.3 | T-016 | T-045 |
| REQ-005 | AC-005.4 | T-016 | T-045 |
| REQ-005 | AC-005.5 | T-016 | T-045 |
| REQ-005 | AC-005.6 | T-036 | T-048 |
| REQ-006 | AC-006.1 | T-018, T-031 | T-046 |
| REQ-006 | AC-006.2 | T-018, T-031 | T-046 |
| REQ-006 | AC-006.3 | T-031 | T-049 |
| REQ-006 | AC-006.4 | T-018, T-023, T-031 | T-046, T-047 |
| REQ-006 | AC-006.5 | T-018, T-031 | T-046 |
| REQ-006 | AC-006.6 | T-018, T-031 | T-046 |
| REQ-007 | AC-007.1 | T-019, T-032 | T-046 |
| REQ-007 | AC-007.2 | T-019, T-032 | T-046 |
| REQ-007 | AC-007.3 | T-019, T-023, T-032 | T-046, T-047 |
| REQ-007 | AC-007.4 | T-019, T-032 | T-046 |
| REQ-007 | AC-007.5 | T-032 | T-049 |
| REQ-008 | AC-008.1 | T-021, T-033 | T-041 |
| REQ-008 | AC-008.2 | T-021, T-033 | T-041 |
| REQ-008 | AC-008.3 | T-021, T-033 | T-041 |
| REQ-008 | AC-008.4 | T-021, T-033 | T-041 |
| REQ-008 | AC-008.5 | T-021, T-033 | T-041 |
| REQ-008 | AC-008.6 | T-021, T-033 | T-041 |
| REQ-009 | AC-009.1 | T-022, T-034 | T-041 |
| REQ-009 | AC-009.2 | T-034 | T-051 |
| REQ-009 | AC-009.3 | T-022, T-034 | T-041 |
| REQ-009 | AC-009.4 | T-022, T-034 | T-041 |
| REQ-009 | AC-009.5 | T-034 | T-051 |
| REQ-010 | AC-010.1 | T-020, T-035 | T-046, T-049 |
| REQ-010 | AC-010.2 | T-035 | T-049, T-050 |
| REQ-010 | AC-010.3 | T-035 | T-049 |
| NFR | — | La spec no define ninguno (§5) | — |
