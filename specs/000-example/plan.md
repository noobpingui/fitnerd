# Plan 000 — Utilidad clamp(value, min, max) en el frontend (prueba en seco del harness)

- **Spec:** [spec.md](spec.md) (aprobada el 2026-09-23)
- **Estado:** borrador

## 1. Resumen de la solución
Se añade un módulo nuevo `frontend/src/lib/clamp.ts` que exporta una función pura `clamp(value: number, min: number, max: number): number`. No depende de React, de TanStack Query ni de la red, así que no encaja en `src/features/<x>/`. Va en `src/lib/`, que es la carpeta de utilidades compartidas que fija la spec, y se importa con el alias `@/lib/clamp`. Sus pruebas son tests unitarios puros de Vitest en `frontend/src/lib/clamp.test.ts`, siguiendo el estilo de `src/features/body-metrics/dateUtils.test.ts`. Ninguna pantalla existente cambia y no hay cambios en el backend.

## 2. Impacto en la arquitectura
| Capa / área | Archivos nuevos | Archivos modificados | Motivo |
|---|---|---|---|
| backend · models / migrations | — | — | Fuera de alcance (spec §3) |
| backend · repositories | — | — | Fuera de alcance |
| backend · services | — | — | Fuera de alcance |
| backend · routes | — | — | Fuera de alcance |
| frontend · lib (utilidades compartidas) | `frontend/src/lib/clamp.ts`, `frontend/src/lib/clamp.test.ts` | — | REQ-001 a REQ-007 |
| frontend · features/<x> | — | — | No se usa `clamp` en ninguna pantalla (spec §3, fuera de alcance) |

**Decisión Q4 (archivo concreto):** va en un archivo propio, `clamp.ts`, y no en el `frontend/src/lib/utils.ts` que ya existe. Motivos:
- `utils.ts` es el archivo que genera shadcn (`cn`), y el CLI de shadcn puede reescribirlo.
- Un módulo por utilidad deja el test al lado (`clamp.test.ts`, Art. 5.5), sin mezclar responsabilidades.
- Ya hay un precedente parecido: `dateUtils.ts` es un módulo propio con su propio test.

## 3. Diseño
### 3.1 Modelo de datos y migraciones
No aplica. No hay cambios de modelo ni migración Alembic.

### 3.2 Contratos de API
No aplica. No hay endpoints nuevos ni modificados. El único contrato es la firma de la función, que se describe en §3.4.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

### 3.3 Lógica de negocio
No hay servicios ni dependencias inyectadas. La lógica completa vive en la función pura `clamp`, sin estado ni efectos. El **orden de evaluación** es obligatorio, porque de él dependen los AC:

1. **Límites NaN (REQ-006):** si `Number.isNaN(min) || Number.isNaN(max)`, lanza `new RangeError("clamp: min y max deben ser números válidos")`.
   - Esta comprobación va primero: `NaN > x` siempre es `false`, así que si se hiciera después, un límite `NaN` pasaría la validación de rango en silencio.
2. **Rango inválido (REQ-005):** si `min > max`, lanza ``new RangeError(`clamp: min (${min}) no puede ser mayor que max (${max})`)``.
   - La interpolación con template literal equivale a `String(n)`, que produce `10`, `0`, `-1.5`, `Infinity`…, justo el formato de la spec §6.
   - Esta validación va antes de mirar `value`, lo que cubre AC-005.3.
3. **`value` NaN (REQ-006):** si `Number.isNaN(value)`, devuelve `NaN`.
   - Se comprueba de forma explícita en vez de confiar en que `Math.min(Math.max(NaN, …))` propague `NaN`. Así el comportamiento queda documentado y se cubre AC-006.5 (`NaN` prevalece sobre `min === max`).
4. **Acotado (REQ-001 a REQ-004 y REQ-007):** devuelve `Math.min(Math.max(value, min), max)`.
   - Los límites son inclusivos.
   - Con `min === max` devuelve ese valor común.
   - `-Infinity` e `Infinity` funcionan como límites o valores sin tratamiento especial, porque son números ordenables.

Se usa `Number.isNaN` y no el `isNaN` global, para que no haya coerción de tipos. Como la firma es `number`, TypeScript ya impide pasar otros tipos. El JSDoc de la función va en español (Art. 5.6) y resume el contrato: límites inclusivos, errores y trato de `NaN`.

### 3.4 Frontend
- **Módulo:** `frontend/src/lib/clamp.ts`.
- **Exportación:** exportación con nombre, `export function clamp(value: number, min: number, max: number): number`, sin export default. Así sigue el estilo de `cn` en `utils.ts` y de `dateUtils.ts`.
- **Importación desde el resto del frontend:** `import { clamp } from "@/lib/clamp"`.
- **Páginas, componentes, hooks, claves de query, schemas zod y `apiFetch`:** no aplican.
  - La función no hace llamadas HTTP ni maneja estado de servidor, y no tiene UI.
  - Tampoco recibe input externo directo: la validación con zod (Art. 7.3) corresponde a quien la use en un formulario, y eso queda fuera de alcance.
- **Textos visibles para el usuario:** ninguno. Los mensajes de `RangeError` son para desarrolladores. Aun así, van en español con tildes correctas ("números válidos"), tal como fija la spec.

## 4. Mapa REQ → diseño
| REQ / NFR | Dónde se resuelve |
|---|---|
| REQ-001 | `clamp.ts`, paso 4 (`Math.min(Math.max(...))` con límites inclusivos) |
| REQ-002 | `clamp.ts`, paso 4 (`Math.max(value, min)` devuelve `min`; también con `-Infinity`) |
| REQ-003 | `clamp.ts`, paso 4 (`Math.min(..., max)` devuelve `max`; también con `Infinity`) |
| REQ-004 | `clamp.ts`, paso 4 (con `min === max` el resultado es ese valor; el paso 2 no lanza porque la comparación es estricta, `>`) |
| REQ-005 | `clamp.ts`, paso 2 (`RangeError` con mensaje interpolado, evaluado antes de mirar `value`) |
| REQ-006 | `clamp.ts`, paso 1 (límite `NaN` lanza `RangeError`) y paso 3 (`value` `NaN` devuelve `NaN` antes del acotado) |
| REQ-007 | `clamp.ts`, pasos 2 y 4 (`±Infinity` son números ordenables; no hay tratamiento especial) |
| NFR | La spec §5 declara "No aplica"; no hay NFR que mapear |

## 5. Estrategia de pruebas
- **Backend (unitarios con fakes o integración de rutas):** no aplica, porque no hay cambios en el backend. No hacen falta fakes nuevos en `backend/tests/fakes.py`.
- **RTL:** no aplica, porque no hay componentes.
- **Unitarios puros con Vitest:** un solo archivo, `frontend/src/lib/clamp.test.ts`, junto al módulo (Art. 5.5).
  - Importa `describe`, `it` y `expect` desde `"vitest"` (`globals: false`).
  - Importa `clamp` desde `"./clamp"`.
  - No hay red ni mocks.
  - Cada `it(...)` va en español, con el marcador `// SDD: REQ-00X AC-00X.Y` en la línea anterior.
  - Se recomienda un `it` por AC para que la trazabilidad sea uno a uno, agrupados en un `describe` por REQ.

| REQ | AC | Aserción clave |
|---|---|---|
| REQ-001 | AC-001.1 | `expect(clamp(5, 0, 10)).toBe(5)` |
| REQ-001 | AC-001.2 | `expect(clamp(0, 0, 10)).toBe(0)` |
| REQ-001 | AC-001.3 | `expect(clamp(10, 0, 10)).toBe(10)` |
| REQ-001 | AC-001.4 | `expect(clamp(-0.25, -1.5, 2.5)).toBe(-0.25)` |
| REQ-002 | AC-002.1 | `expect(clamp(-5, 0, 10)).toBe(0)` |
| REQ-002 | AC-002.2 | `expect(clamp(-Infinity, 0, 10)).toBe(0)` |
| REQ-003 | AC-003.1 | `expect(clamp(15, 0, 10)).toBe(10)` |
| REQ-003 | AC-003.2 | `expect(clamp(Infinity, 0, 10)).toBe(10)` |
| REQ-004 | AC-004.1 | `expect(clamp(1, 3, 3)).toBe(3)` |
| REQ-004 | AC-004.2 | `expect(clamp(7, 3, 3)).toBe(3)` |
| REQ-005 | AC-005.1 | `expect(() => clamp(5, 10, 0)).toThrow(RangeError)` |
| REQ-005 | AC-005.2 | capturar el error y comprobar `expect(err.message).toBe("clamp: min (10) no puede ser mayor que max (0)")`. No usar `toThrow(string)`, porque solo comprueba subcadena |
| REQ-005 | AC-005.3 | `expect(() => clamp(10, 10, 0)).toThrow(RangeError)` |
| REQ-006 | AC-006.1 | `expect(clamp(NaN, 0, 10)).toBeNaN()` |
| REQ-006 | AC-006.2 | `expect(() => clamp(5, NaN, 10)).toThrow(RangeError)` |
| REQ-006 | AC-006.3 | `expect(() => clamp(5, 0, NaN)).toThrow(RangeError)` |
| REQ-006 | AC-006.4 | mensaje exacto `"clamp: min y max deben ser números válidos"` (mismo patrón de captura que AC-005.2) |
| REQ-006 | AC-006.5 | `expect(clamp(NaN, 3, 3)).toBeNaN()` |
| REQ-007 | AC-007.1 | `expect(clamp(-1000, -Infinity, 10)).toBe(-1000)` |
| REQ-007 | AC-007.2 | `expect(clamp(1000, 0, Infinity)).toBe(1000)` |

**Rojo legítimo (Art. 5.2):** si `clamp.ts` no existe, el test falla por un error de import, y eso **no** cuenta como rojo legítimo. Por eso `tasks.md` debería incluir, antes de la verificación del rojo, un **esqueleto** de `clamp.ts`: la firma exportada y un cuerpo que lance `new Error("clamp: no implementado")`.
- Con ese esqueleto, los 20 AC fallan por comportamiento ausente:
  - los que esperan un valor reciben una excepción;
  - los que esperan `RangeError` reciben un `Error` genérico, así que `toThrow(RangeError)` falla.
- El esqueleto no debe devolver `value`, porque haría pasar en falso AC-001.x, AC-006.1, AC-007.x y otros.
- Qué agente crea el esqueleto (test-author como andamiaje o implementer en una tarea previa) lo decide `tasks.md` según las reglas de rol del harness.

**Suite completa:** `npm test`, `npm run lint`, `npx tsc -b` y `npm run build` en `frontend/` (Art. 9).

## 6. Riesgos y mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El rojo falla por un error de import (no legítimo) al no existir `clamp.ts` | Alta | Medio (bloquea el gate de red_check) | Crear el esqueleto que lanza `Error` genérico antes de la verificación del rojo (§5) |
| Un límite `NaN` pasa la validación de rango porque las comparaciones con `NaN` dan `false` | Media | Medio (se incumplen AC-006.2 a AC-006.4) | Orden obligatorio: la comprobación de `NaN` en los límites va antes que `min > max` (§3.3, paso 1) |
| El test del mensaje exacto usa `toThrow(string)`, que solo comprueba subcadena, y acepta mensajes con texto de más | Media | Bajo | Capturar el error y comparar `message` con `toBe` (§5, AC-005.2 y AC-006.4) |
| Diferencias de acentos o codificación en el mensaje ("números válidos") entre test e implementación | Baja | Bajo | Ambos archivos en UTF-8; copiar el literal exacto de la spec §6 |

## 7. Cumplimiento de la constitución
- **Art. 1:** el cambio pasa por el flujo SDD completo (spec 000 aprobada).
- **Art. 4:** los 7 REQ están mapeados (§4) y los 20 AC tienen un test previsto con marcador `// SDD:` (§5). No hay NFR.
- **Art. 5:** TDD con verificación del rojo legítimo gracias al esqueleto (§5). El test va junto al archivo, con `globals: false` e imports desde `vitest`, `it` en español y sin red.
- **Art. 6.6 (organización por feature):** `clamp` no pertenece a ninguna feature. Es una utilidad transversal y va en `src/lib/`, junto a `utils.ts` y `apiClient.ts`, que es la ubicación que fija la spec. Por tanto, no se incumple la organización por feature.
- **Art. 6.7 y 6.8:** no aplican (sin HTTP, sin estado de servidor, sin formularios).
- **Art. 6.9:** se importa con el alias `@/`.
- **Art. 6.10:** hay que pasar `npm run lint` y `npx tsc -b`. Es una función tipada sin `any`.
- **Art. 6.11:** no hay textos visibles para el usuario. Los mensajes de error van en español correcto, sin voseo.
- **Art. 7:** no aplica. No hay secretos, endpoints, input externo directo ni IA. No hay variables de entorno nuevas.
- **Art. 8:** se trabaja en la rama `feat/000-example`. Parte de `chore/sdd-harness` y no de `main`, como excepción documentada en la spec §1 por ser la prueba en seco del harness.
- **"DEBERÍA" incumplidos:** ninguno.

## 8. ADRs
Ninguna. Ubicar una utilidad pura en `src/lib/` sigue la convención existente y no es una decisión de arquitectura nueva.
