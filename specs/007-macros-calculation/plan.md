# Plan 007 — Cálculo de calorías y macros con límites de proteína y carbohidratos

- **Spec:** [spec.md](spec.md) (aprobada el 2026-10-12)

## 1. Resumen de la solución

El cálculo ya vive en una función pura del frontend, `calculateMacros()` en `frontend/src/features/macros/calculations.ts`, que usan `MacrosPage` y `HomePage`. La feature se resuelve casi por completo **dentro de esa función**:

- se mantiene la conversión de unidades, la edad y la fórmula de Mifflin-St Jeor, que ya cumplen REQ-001 a REQ-003;
- se añaden el suelo calórico (REQ-004), el peso de referencia con tope de IMC 27 (REQ-006) y el mínimo de 100 g de carbohidratos con cesión de grasas y luego de proteínas (REQ-007);
- el porcentaje pasa a calcularse sobre el objetivo sin redondear y se exponen los valores sin redondear para poder comprobar REQ-008.

Las dos páginas no cambian de lógica: siguen llamando a `calculateMacros()` y pintando sus campos redondeados. En `MacrosPage` solo cambia el texto de la nota informativa (REQ-010). No hay backend, API ni migración.

## 2. Impacto en la arquitectura

| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Sin cambios (ámbito solo frontend) |
| backend · repositories | — | — | Sin cambios |
| backend · services | — | — | Sin cambios |
| backend · routes | — | — | Sin cambios |
| frontend · features/macros | — | `frontend/src/features/macros/calculations.ts` | Suelo calórico, peso de referencia, mínimo de carbohidratos, porcentajes sobre el objetivo y campos sin redondear (REQ-001 a REQ-008) |
| frontend · features/macros | — | `frontend/src/features/macros/pages/MacrosPage.tsx` | Texto nuevo de la nota informativa (REQ-010); la presentación de cifras no cambia (REQ-009) |
| frontend · features/macros (tests) | — | `frontend/src/features/macros/calculations.test.ts`, `frontend/src/features/macros/pages/MacrosPage.test.tsx` | Tests nuevos de la spec 007 (los de la 006 se conservan) |
| frontend · features/home (tests) | — | `frontend/src/features/home/pages/HomePage.test.tsx` | Tests nuevos de AC-009.4 y AC-009.5 |
| frontend · features/home | — | — | `HomePage.tsx` no cambia: ya usa `summary.targetKcal` y `macro.grams` |

No se tocan `Pie3D.tsx`, `constants.ts`, `profile/*` ni `onboarding/*`. Se **reutilizan**:
- `KG_PER_LB` y `CM_PER_IN` de `frontend/src/features/onboarding/units.ts` (REQ-001);
- `ageFromIsoDate()` de `frontend/src/lib/age.ts` (REQ-001, edad con el cumpleaños incluido);
- `answersFromProfile()` de `frontend/src/features/profile/mappers.ts` (ya convierte el perfil del servidor en `OnboardingAnswers`);
- `makeAnswers()` y `makeProfileResponse()` de `frontend/src/test/profileFixtures.ts` en los tests.

## 3. Diseño

### 3.1 Modelo de datos y migraciones

No aplica. No hay cambios de modelo ni migración Alembic.

### 3.2 Contratos de API

No hay cambios de API. El cálculo usa la respuesta existente de `GET /api/profile` (spec 006) a través de `useProfile()`.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

### 3.3 Lógica de negocio

No hay servicios de backend. La lógica es la función pura `calculateMacros(a: OnboardingAnswers, today: Date = new Date()): MacrosSummary`. Su única "dependencia" es `today`, que ya se inyecta por parámetro y permite tests deterministas sin fakes.

**Constantes** (en `calculations.ts`, sin exportar salvo `KJ_PER_KCAL`, que ya se exporta):

| Constante | Valor |
|---|---|
| `ACTIVITY_FACTOR` | sin cambios (1,2 / 1,375 / 1,55 / 1,725 / 1,9) |
| `GOAL_FACTOR` | sin cambios (0,8 / 0,9 / 1 / 1,1 / 1,2) |
| `MIN_TARGET_KCAL` (nueva) | `{ male: 1500, female: 1200 }` |
| `PROTEIN_G_PER_KG` | 2 (sin cambios) |
| `PROTEIN_CAP_BMI` (nueva) | 27 |
| `FAT_SHARE` | 0,25 (sin cambios) |
| `MIN_FAT_SHARE` (nueva) | 0,20 |
| `MIN_CARBS_G` (nueva) | 100 |
| `KCAL_PER_GRAM` | sin cambios (4 / 4 / 9) |

**Algoritmo** (todo con números sin redondear hasta el final):

1. **Entrada (REQ-001):** `kg` y `cm` como hoy (lb × `KG_PER_LB`; (ft × 12 + in) × `CM_PER_IN`), sin redondear. `age = ageFromIsoDate(a.dateOfBirth, today)`.
2. **Mantenimiento (REQ-002):** `bmr = 10·kg + 6,25·cm − 5·edad + (male ? 5 : −161)`; `maintenance = bmr × ACTIVITY_FACTOR[activity]`.
3. **Objetivo (REQ-003, REQ-004):** `goalKcal = maintenance × GOAL_FACTOR[goal]`; `target = max(goalKcal, MIN_TARGET_KCAL[sexo])`. El suelo se aplica siempre, aunque supere el mantenimiento, y el mantenimiento no se toca.
4. **Peso de referencia (REQ-006):** `refKg = min(kg, 27 × (cm / 100)²)`.
5. **Reparto estándar (REQ-005):**
   - `proteinStd = refKg × 2 × 4`;
   - `fatStd = target × 0,25`;
   - `carbsStd = target − proteinStd − fatStd`.
6. **Mínimo de carbohidratos (REQ-007):** si `carbsStd >= 100 × 4` (comparación sin redondear), se usa el reparto estándar. Si no:
   - `carbs = 400`;
   - `deficit = 400 − carbsStd`;
   - `fat = max(fatStd − deficit, target × 0,20)` (las grasas ceden primero, como mucho hasta el 20 %);
   - `protein = target − carbs − fat` (las proteínas cubren lo que falte).

   Si las grasas bastan, `protein` resulta igual a `proteinStd` (se demuestra algebraicamente), así que no hace falta una rama más. Calcular siempre el último macro como resto garantiza que las kcal suman exactamente el objetivo (REQ-008).
7. **Salida (REQ-008, REQ-009):** por cada macro, en el orden actual `carbs`, `protein`, `fat`:
   - `exactKcal`: kcal sin redondear (campo **nuevo**);
   - `kcal = Math.round(exactKcal)`;
   - `grams = Math.round(exactKcal / KCAL_PER_GRAM[key])`;
   - `share = exactKcal / target` (antes se dividía entre la suma de los tres; ahora es el objetivo sin redondear, que coincide con esa suma).

   `MacrosSummary` mantiene `maintenanceKcal` y `targetKcal` redondeados y añade `exactTargetKcal` (objetivo sin redondear, campo **nuevo**). Los campos nuevos solo existen para que los tests comprueben AC-008.1; la UI no los usa.

**Por qué el reparto nunca es negativo (REQ-008):** con el suelo, `target ≥ 1200`. En la rama del mínimo, `protein = target − 400 − fat ≥ target·0,8 − 400 ≥ 560` cuando `fat = 0,20·target`, y `fat ≥ 0,20·target > 0`. En la rama estándar, `carbs ≥ 400` y `fat = 0,25·target > 0`, y `protein = refKg × 8 > 0` porque el peso mínimo válido es 30 kg y `27 × 1² = 27`. Se elimina el `Math.max(…, 0)` provisional.

**Sexo nulo:** `OnboardingAnswers.gender` admite `null`, aunque `OnboardingGuard` garantiza perfil completo. Se conserva el comportamiento actual (`gender === "male"` → hombre; si no, constantes de mujer) también para el suelo, para que fórmula y suelo sean coherentes. Igual con `activityLevel ?? "low"` y `goal ?? "maintain"`, que no cambian.

**Comentarios:** se eliminan el bloque "TEMPORAL (fase de diseño)" y el "Pendiente para la fase SDD", y se sustituyen por comentarios en español que remiten a la spec 007 y explican cada regla.

### 3.4 Frontend

- **Páginas:**
  - `MacrosPage.tsx`: sin cambios de lógica ni de diseño. Ya muestra `targetKcal`, `maintenanceKcal`, `grams`, `energy(macro.kcal)` y `Math.round(share × 100) % del total`, y la conversión a kJ ya es `Math.round(kcalRedondeadas × 4,184)` (REQ-009). Solo se sustituye el párrafo de la nota informativa por el texto literal de la sección 6 de la spec, manteniendo `<strong className="font-medium text-foreground">Mifflin-St Jeor</strong>` (REQ-010). Hay que respetar la tipografía exacta del texto ("25 %", "20 %", "1200 kcal", "IMC de 27") porque los AC-010.x buscan subcadenas literales.
  - `HomePage.tsx`: sin cambios; hereda el cálculo nuevo.
- **Componentes:** `Pie3D` sin cambios; sigue usando `share` y `key`.
- **Hooks y claves de query:** sin cambios. Se sigue usando `useProfile()` de `features/profile/hooks.ts` con su clave actual.
- **Schemas zod:** sin cambios. No hay input nuevo del usuario ni respuesta de API nueva; el perfil ya se valida en la spec 006.
- **Tipos:** `MacroResult` añade `exactKcal: number` y `MacrosSummary` añade `exactTargetKcal: number` (en `calculations.ts`, donde ya están definidos).

## 4. Mapa REQ → diseño

| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `calculateMacros()` paso 1: conversión con `KG_PER_LB` / `CM_PER_IN` sin redondear y `ageFromIsoDate(dateOfBirth, today)` (ya existentes; se fijan con tests) |
| REQ-002 | `calculateMacros()` paso 2: Mifflin-St Jeor × `ACTIVITY_FACTOR`; `maintenanceKcal` redondeado y sin suelo |
| REQ-003 | `calculateMacros()` paso 3: mantenimiento sin redondear × `GOAL_FACTOR`; `targetKcal` redondeado; los macros no lo modifican |
| REQ-004 | `calculateMacros()` paso 3: `max(goalKcal, MIN_TARGET_KCAL[sexo])`, siempre y para cualquier meta |
| REQ-005 | `calculateMacros()` paso 5: reparto estándar (2 g/kg de referencia, 25 % grasas, resto carbohidratos) |
| REQ-006 | `calculateMacros()` paso 4: `refKg = min(kg, 27 × m²)` |
| REQ-007 | `calculateMacros()` paso 6: 400 kcal de carbohidratos, grasas hasta el 20 %, después proteínas como resto |
| REQ-008 | `calculateMacros()` pasos 6-7: último macro como resto (suma exacta), `share = exactKcal / target`, redondeo por macro; campos `exactKcal` y `exactTargetKcal` para verificarlo |
| REQ-009 | `MacrosPage.tsx` y `HomePage.tsx` sin cambios de lógica: consumen el `MacrosSummary` nuevo; kJ con `KJ_PER_KCAL` sobre kcal redondeadas (ya existente) |
| REQ-010 | `MacrosPage.tsx`: párrafo de la nota informativa con el texto de la sección 6 de la spec |
| NFR | La spec no define NFR (sección 5): no aplica |

## 5. Estrategia de pruebas

No hay tests de backend (ni unitarios de servicio ni de integración de rutas): el ámbito es solo frontend. **No hacen falta fakes nuevos.** La red se simula como en los tests actuales, con `vi.mock("@/features/profile/api")` (constitución Art. 5.5).

**Pautas comunes:**
- Los tests existentes con marcadores `SDD: REQ-012 AC-012.x` son de la spec 006 y **se conservan sin cambios**. Sus perfiles (72,5 kg, 175 cm) quedan por debajo del tope de proteína y por encima del suelo, así que sus cifras no cambian.
- Las fechas se fijan siempre: en los unitarios, pasando `today` a `calculateMacros()` (p. ej. `new Date(2026, 9, 12)`); en RTL, con `vi.useFakeTimers({ toFake: ["Date"] })` y `vi.setSystemTime(...)`, como ya hacen `MacrosPage.test.tsx` y `HomePage.test.tsx`.
- Para expresar "N años cumplidos", se recomienda un helper local en el test que construya la fecha de nacimiento a partir de la fecha fijada (p. ej. con `today` = 12-10-2026, 30 años → `"1996-01-01"`). Los perfiles se construyen con `makeAnswers()` (unitarios) o `makeProfileResponse()` (RTL), con overrides de `gender`, `heightCm`/`heightFt`/`heightIn`, `weight`, `weightUnit`, `activityLevel` y `goal`.
- Los números de la UI se formatean con `Intl.NumberFormat("es-ES")`, que puede usar o no separador de miles según el entorno. Las aserciones de cifras de 4 dígitos deben tolerar el punto (`/3\.?379/`), igual que los tests actuales.

### 5.1 Unitarios puros — `frontend/src/features/macros/calculations.test.ts` (Vitest)

| AC | Qué se comprueba |
|---|---|
| AC-001.1 | Perfil en ft/in y lb: `maintenanceKcal` 2139 y `targetKcal` 1711 |
| AC-001.2, AC-001.3 | Mismo perfil el 11-10-2026 (2142 / 1714) y el 12-10-2026 (2136 / 1709) |
| AC-002.1, AC-002.2 | `maintenanceKcal` para cada actividad indicada (puede ser `it.each`) |
| AC-003.1 | `targetKcal` para las cinco metas |
| AC-004.1, AC-004.2, AC-004.3 | `targetKcal` en el suelo, `maintenanceKcal` sin suelo y `grams`/`kcal` de cada macro |
| AC-004.5 | Las cinco metas dan 1200 de objetivo y 872 de mantenimiento |
| AC-004.4 | Objetivo 1363 sin suelo |
| AC-005.1 | Gramos y kcal del reparto estándar |
| AC-006.1, AC-006.2, AC-006.3 | Proteína con el tope (175 g en kg y en lb; 175 g con 90 kg y 170 g con 85 kg) y el resto del reparto de AC-006.1 |
| AC-007.1, AC-007.2, AC-007.3, AC-007.4 | Mínimo de carbohidratos: cesión de grasas, grasas al 20 % y cesión de proteínas, caso que no lo activa y caso combinado con suelo y tope |
| AC-008.1 | Bucle sobre las 400 combinaciones (2 sexos × 2 edades × 2 alturas × 2 pesos × 5 actividades × 5 metas). Por cada una: `grams >= 0` y `kcal >= 0`; `targetKcal >= 1200/1500`; `|Σ exactKcal − exactTargetKcal| < 0,001`. Para que el cálculo use 14 y 100 años, las fechas de nacimiento se derivan de la fecha fijada. Conviene que el mensaje de fallo identifique la combinación. |
| AC-008.2 | Para cada perfil de los AC anteriores (lista compartida en el test): `|Σ share − 1| < 1e-6` |

Para localizar un macro en `summary.macros` se recomienda un helper `byKey(summary, "protein")`. El orden del array no forma parte de la spec y no debe afirmarse.

### 5.2 RTL — `frontend/src/features/macros/pages/MacrosPage.test.tsx`

| AC | Qué se comprueba |
|---|---|
| AC-009.1 | Perfil de AC-006.1: objetivo `/3\.?379/` en el bloque de "Objetivo diario"; "175 g", "94 g" y "459 g" visibles. Lo ideal es asociar cada cifra a su etiqueta ("Proteínas", "Grasas", "Carbohidratos") buscando dentro del `<li>` de esa etiqueta (p. ej. `within(screen.getByText("Proteínas").closest("li")!)`). |
| AC-009.2 | Perfil de AC-007.2: dentro de cada `<li>`, "100 g" y "31 % del total", "156 g" y "49 % del total", "28 g" y "20 % del total". Ojo: `Pie3D` también pinta porcentajes ("31 %"), así que hay que buscar el texto completo "… % del total" o acotar con `within`. |
| AC-009.3 | Perfil de AC-005.1: `userEvent` o `fireEvent` sobre el botón "kJ" del `UnitToggle` y el objetivo pasa a `/7\.?150/` |
| AC-009.5 (parte `/macros`) | Perfil de AC-004.1: objetivo `/1\.?200/` y texto "Mantenimiento: 1427 kcal" (con separador opcional) |
| AC-010.1, AC-010.2, AC-010.3 | Localizar la nota (p. ej. `screen.getByText("Mifflin-St Jeor").closest("p")`) y comprobar con `toHaveTextContent` que contiene las tres subcadenas literales y "Mifflin-St Jeor". El texto de JSX partido en varias líneas se une con espacios, así que la comparación por subcadena funciona. |

### 5.3 RTL — `frontend/src/features/home/pages/HomePage.test.tsx`

| AC | Qué se comprueba |
|---|---|
| AC-009.4 | Perfil de AC-006.1: `/3\.?379/` y "459 g", "175 g" y "94 g" en la tarjeta "Objetivo de hoy" |
| AC-009.5 (parte `/home`) | Perfil de AC-004.1: objetivo `/1\.?200/` en la tarjeta "Objetivo de hoy" |

### 5.4 Rojo legítimo esperado

Contra el código actual fallan por comportamiento ausente: AC-004.x, AC-006.x, AC-007.1, AC-007.2, AC-007.4, AC-008.1 (los campos `exactKcal`/`exactTargetKcal` no existen todavía, así que dan `undefined`/`NaN`, que es un fallo de aserción y no de import), AC-009.1, AC-009.2, AC-009.4, AC-009.5 y AC-010.1, AC-010.3.

Pasan ya en verde porque el comportamiento existe y solo se fija: AC-001.x, AC-002.x, AC-003.1, AC-004.4, AC-005.1, AC-007.3, AC-008.2, AC-009.3 y AC-010.2. Es aceptable (Art. 5.2 exige rojo en lo que falta, no en lo que ya está). El test-author debe declararlo para que el verifier no lo tome como rojo ilegítimo.

**Tipado de los tests de AC-008.1:** si el test-author accede a `exactKcal`/`exactTargetKcal` antes de que existan en el tipo, `tsc -b` fallará, pero Vitest (esbuild) no comprueba tipos y el test fallará en la aserción. Para evitar ruido de typecheck en la fase de tests, el implementer en modo scaffold (ADR-0012) **añade primero los dos campos a los tipos** `MacroResult` y `MacrosSummary` y los rellena provisionalmente con `Number.NaN`, sin lógica. Así el rojo de AC-008.1 es por comportamiento.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Redondeo en el límite de ,5 (p. ej. una kcal x,5 que por error de coma flotante redondee al otro lado) hace fallar un AC por una unidad | Baja | Medio | Todos los AC de la spec se han recalculado en este plan con el algoritmo de la sección 3.3 y coinciden. Se redondea solo al final, sobre el valor sin redondear, como dice REQ-008. Si un test discrepa en una unidad, se revisa el orden de las operaciones antes de tocar el test. |
| Aserciones RTL ambiguas: los porcentajes salen también en `Pie3D`, y "175 g" puede repetirse en otras pantallas o tests | Media | Bajo | Buscar el texto completo ("31 % del total") y acotar con `within` al `<li>` de cada macro (sección 5.2). |
| El separador de miles de `Intl.NumberFormat("es-ES")` difiere entre entornos (en es-ES, los números de 4 cifras pueden ir sin punto) | Media | Bajo | Regex con punto opcional (`/1\.?427/`), como en los tests existentes. |

## 7. Cumplimiento de la constitución

- **Art. 1:** cambio funcional con spec aprobada (ca17070).
- **Art. 4:** cada REQ tiene su sitio en el mapa (sección 4) y cada AC un test previsto con marcador `// SDD: REQ-0NN AC-0NN.M` (sección 5). La spec no tiene NFR.
- **Art. 5.1-5.3:** los tests se escriben antes que la implementación. Los existentes (spec 006) se conservan sin debilitarlos. El rojo esperado está en la sección 5.4.
- **Art. 5.4:** no aplica (sin backend).
- **Art. 5.5:** tests junto al archivo que prueban, `describe`/`it`/`expect` importados de `vitest`, y red simulada en `features/profile/api.ts` con `vi.mock`, el patrón vigente de los tests de página.
- **Art. 5.6:** nombres `it("…")` en español.
- **Art. 5.7:** el scaffold solo añade los campos de tipo con `Number.NaN`, sin lógica. No se crean funciones nuevas exportadas que necesiten `Error("not implemented")`.
- **Art. 6.6-6.9:** se respeta la organización por feature (`features/macros`). No hay llamadas HTTP nuevas, claves de query, formularios ni componentes de UI nuevos. Alias `@/`.
- **Art. 6.10:** `npm run lint`, `npx tsc -b` y `npm run build` deben pasar.
- **Art. 6.11:** el texto nuevo de la nota es el literal de la spec, en español correcto y sin voseo.
- **Art. 7:** sin secretos, endpoints ni input externo nuevos. El perfil ya se valida con zod (spec 006).
- **Art. 6.1-6.5:** no aplican (sin backend).

No hay ningún "DEBERÍA" incumplido.

## 8. ADRs

Ninguna. El cálculo sigue en el frontend como función pura, y la spec ya fija que moverlo al backend queda fuera de alcance (sección 3). Esto no contradice ADR-0019, que solo trata la persistencia del perfil y la edad derivada de `users.date_of_birth`.
