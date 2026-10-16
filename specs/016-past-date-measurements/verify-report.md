# Verify report 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Modo:** red (tras la etapa tests)
- **Fecha:** 2026-10-16T21:11:30.934Z · **Rama:** `feat/016-past-date-measurements` @ `3527d19` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_routes/test_body_metric_routes.py tests/test_services/test_body_metric_service.py` (`backend`) | ✅ | 176 passed. Incluye los tests de AC-005.2 que estaban en rojo en el red check anterior (ahora en verde por T-030). |
| frontend | `npx vitest run` sobre los 7 archivos de test de la feature (`frontend`) | ❌ | 154 passed, 6 failed de 160. Los 6 fallos son los tests nuevos de la corrección de la review (F1, F2 y F5), en rojo por comportamiento ausente (ver §4). |

Modo red: solo se ejecutan los tests de la feature (archivos con marcador `SDD: 016`). Lint, typecheck y build se ejecutan en la etapa verify.

## 2. Trazabilidad
Tests nuevos o reescritos de esta iteración:

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| NFR-002 | AC-N002.1 | T-018, T-035 | `RegisterMetricDialog.test.tsx` (aria-describedby de Peso, % Grasa, % Masa muscular, "Registra al menos un valor" y Fecha) | ❌ (Peso, % Grasa, % Masa muscular y "Registra al menos un valor"); ✅ (Fecha, ya existente) |
| REQ-001 | AC-001.4 | T-020, T-036 | `BodyMetricsPage.register.test.tsx` ("'Registrar medición' no se puede pulsar hasta que carga el perfil") | ❌ |
| REQ-009 | AC-009.1 | T-023, T-037 | `ProfilePage.test.tsx` (medición posterior sin perfil en la caché) | ❌ |
| REQ-007 | AC-007.7 | T-021 | `BodyMetricsPage.register.test.tsx` (reescrito con stub que filtra por periodo) | ✅ (esperado: verifica comportamiento ya existente) |

- Tests `SDD:` de esta iteración con marcador correcto: todos.
- AC sin test: ninguno nuevo. La comprobación completa de trazabilidad se hace en la etapa verify.
- Tareas sin marcar `[x]`: no se comprueba en modo red.
- `skip`, `xfail`, `.only`, `.skip` o equivalentes nuevos en el diff de tests: ninguno.
- Pasan sin implementación nueva (esperado): el test de fecha de NFR-002 y el test reescrito de AC-007.7. Verifican comportamiento que ya existe en `3527d19`, no son vacíos.

## 3. Criterios de aceptación manuales
Ninguno en esta etapa.

## 4. Fallos (si los hay)
Los 6 fallos son aserciones sobre comportamiento ausente en `3527d19`. Ninguno es de sintaxis, fixture, configuración ni import.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| 1 | `RegisterMetricDialog.test.tsx`: error de "Peso (kg)" enlazado con aria-describedby (F1) | `expect(element).toHaveAttribute("aria-describedby")`: el input no tiene el atributo | implementer |
| 2 | `RegisterMetricDialog.test.tsx`: error de "% Grasa corporal" enlazado (F1) | `expect(element).toHaveAttribute("aria-describedby")` | implementer |
| 3 | `RegisterMetricDialog.test.tsx`: error de "% Masa muscular" enlazado (F1) | `expect(element).toHaveAttribute("aria-describedby")` | implementer |
| 4 | `RegisterMetricDialog.test.tsx`: "Registra al menos un valor" enlazado a los campos de valores (F1) | `expect(element).toHaveAccessibleDescription(/Registra al menos un valor/)` | implementer |
| 5 | `BodyMetricsPage.register.test.tsx`: "Registrar medición" deshabilitado hasta cargar el perfil (F2) | `expect(element).toBeDisabled()`: el botón está habilitado con las mediciones cargadas y el perfil pendiente | implementer |
| 6 | `ProfilePage.test.tsx`: sin perfil en la caché no hay aviso REQ-009 y se muestra "Cambios guardados" (F5) | `TestingLibraryElementError: Unable to find an element with the text: Cambios guardados` (en su lugar aparece el aviso de REQ-009) | implementer |

Nota para el orquestador: `state.json.tests_snapshot` no coincide con los archivos de test modificados en esta iteración. Hay que volver a tomar el snapshot tras esta corrección.
