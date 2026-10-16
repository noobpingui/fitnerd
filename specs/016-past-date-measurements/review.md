# Review 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Iteración:** 2 de 3
- **Diff revisado:** `git diff main...feat/016-past-date-measurements` @ `46faf15`, con foco en `git diff 3527d19 46faf15` (corrección de F1 a F6). Sin commitear solo hay cambios en `specs/016-past-date-measurements/state.json` y `verify-report.md`.
- **Veredicto:** APPROVED

## 1. Resumen

Revisión de seguimiento. La iteración 1 quedó APPROVED con F1 a F6 (2 MENOR y 4 NIT), y el usuario pidió corregirlos todos. Los seis están resueltos:
- `df02ae5` añade los tests de F1, F2 y F5 y reescribe el de AC-007.7 (F3);
- `46faf15` corrige F1, F2, F4 y F5 sin tocar ningún test;
- el backlog marca F6.

No hay regresiones: los AC de la iteración 1 siguen como estaban, `snapshot --check` da idéntico y he vuelto a ejecutar vitest sobre `body-metrics`, `profile` y `onboarding` (492 tests en verde).

## 2. Cumplimiento de la spec

La tabla completa de la iteración 1 sigue siendo válida: el cambio de esta iteración no toca el backend ni la lógica de registro. Solo cambian estas filas:

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.4 | Sí, ahora sin la ventana en `kg` | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:44`, `:80-86` (`disabled={profileLoading}`); test "'Registrar medición' no se puede pulsar hasta que carga el perfil" en `BodyMetricsPage.register.test.tsx` |
| AC-007.7 | Sí | `BodyMetricsPage.register.test.tsx`: el stub de `TrendChart` usa `trendChartData` y `periodStart` reales, pulsa "1M" y comprueba que entra la medición del 05/10 y queda fuera la del 20/08 |
| AC-009.1 | Sí, también sin perfil en la caché | `frontend/src/features/profile/components/PhysicalDataForm.tsx:117-121` (`hadProfile` antes del PUT) y `:161-167` (aviso y peso real solo si había perfil); test nuevo en `ProfilePage.test.tsx` |
| AC-N002.1 (y plan §3.4) | Sí | `RegisterMetricDialog.tsx:57-63` (`describedBy`), `:131`, `:142`, `:157` y `:162` (`id="register-values-error"`); `frontend/src/features/onboarding/components/NumberField.tsx:17`, `:28`, `:40` |

## 3. Cumplimiento del plan

- La desviación de la iteración 1 (plan §3.4, `aria-describedby` solo en "Fecha") está corregida: peso, grasa y masa muscular enlazan su propio error y, cuando aparece, "Registra al menos un valor".
- **Decisiones del implementer** (registradas en `history`):
  - si falla la carga del perfil, el botón se habilita;
  - el aviso de REQ-009 solo se muestra si había perfil en la caché antes del PUT.

  Las dos son coherentes con el plan y con la spec. En el primer caso, la etiqueta "Peso (kg)" deja ver la unidad, así que no hay conversión silenciosa.
- `NumberField` recibe una prop opcional nueva. El resto de sus usos (onboarding y perfil) no cambia.
- Sin migración, sin dependencias nuevas y sin ADR.

## 4. Checklist de la constitución

### Parte I (base)
- [x] B1.3: la corrección pasó por `rework tests` con la petición del usuario (comentario de la iteración 1) y por las etapas tests, implement y verify.
- [x] B2: `snapshot --check` da idéntico al snapshot del 2026-10-16T21:12:07, que se rehízo tras el `rework tests` autorizado. `git diff df02ae5 HEAD` (commit `tests`) no toca ningún archivo de test: implement solo cambió código de producción.
- [x] B4: los tests nuevos llevan marcadores `SDD: 016` con el AC que prueban (AC-N002.1, AC-001.4, AC-009.1 y AC-007.7).
- [x] B5: el `rework tests` no borró ni debilitó ningún test. El de AC-007.7 se reforzó: añade la comprobación del periodo de 1 mes. El red check mostró los 6 tests nuevos en rojo por comportamiento ausente. No hay `skip` ni `only`.
- [x] B5.7: según verify (`46faf15`), el ratchet de ruff no tiene violaciones nuevas, oxlint da 0 errores y `tsc -b` y `build` pasan.
- [x] B6.5: sin secretos y sin variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: tests junto al archivo, `it("…")` en español y red simulada con `vi.mock`.
- [x] P2 frontend: organización por feature, TanStack Query y componentes de `components/ui`. Las importaciones de `PhysicalDataForm.tsx` vuelven a estar agrupadas.
- [x] P2 general: textos y comentarios en español correcto.
- [x] P3 y P4: sin cambios en el backend ni en la autorización; sin migración.

## 5. Hallazgos

### Seguimiento de la iteración 1

| # | Severidad | Estado | Evidencia |
|---|---|---|---|
| F1 | MENOR | Resuelto | `RegisterMetricDialog.tsx:57-63`, `:131`, `:142`, `:157`, `:162`; `NumberField.tsx:17`, `:40`. Lo cubren 5 tests de accesibilidad con `toHaveAccessibleDescription` en `RegisterMetricDialog.test.tsx` |
| F2 | MENOR | Resuelto | `BodyMetricsPage.tsx:44`, `:80-86`. El test deja el perfil pendiente, comprueba que el botón está deshabilitado y que se habilita al llegar un perfil en lb |
| F3 | NIT | Resuelto | `BodyMetricsPage.register.test.tsx`: el stub filtra por periodo con la lógica real y el test pulsa "1M" |
| F4 | NIT | Resuelto | `PhysicalDataForm.tsx:1-25`: `useQueryClient` junto a las demás librerías y los módulos de `body-metrics` antes de los de `onboarding` |
| F5 | NIT | Resuelto | `PhysicalDataForm.tsx:117-121`, `:161-167`; test nuevo en `ProfilePage.test.tsx` (sin aviso y campo con 79) |
| F6 | NIT | Resuelto | `specs/016-past-date-measurements/backlog.md:21` marcada `[x]` |

### Nuevos

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F7 | NIT | `frontend/src/features/body-metrics/pages/BodyMetricsPage.tsx:83` | Si `GET /api/profile` falla, el botón queda deshabilitado mientras TanStack Query reintenta (3 reintentos con espera creciente, varios segundos) y después se habilita en `kg`. No hay error de datos, porque la etiqueta muestra la unidad, pero un usuario con perfil en lb tendría que escribir el peso en kg. Basta con pasarlo al backlog. | implementer |

## 6. Decisión

**APPROVED.** F1 a F6 están resueltos, no hay regresiones y los tests coinciden con el snapshot autorizado. No quedan hallazgos BLOQUEANTES ni MAYORES. F7 es un NIT para el backlog del proyecto.

## Comentarios del usuario

## Comentarios del usuario

> F1 a F6, vamos a arreglarlas todas de una vez

> Corrige ahora el F7
