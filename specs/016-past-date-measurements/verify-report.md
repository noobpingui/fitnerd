# Verify report 016 — Registrar mediciones corporales con fecha pasada (incluye 008 F2)

- **Modo:** red (tras la etapa tests, red check del test de F8)
- **Fecha:** 2026-10-17T02:49:46.225Z · **Rama:** `feat/016-past-date-measurements` @ `0da0cbd` · **Base:** `main`
- **Resultado:** PASS

## 1. Comandos ejecutados
Ámbitos tocados: backend, frontend. Los comandos a `null` no se listan. Modo red: solo los archivos de test cambiados de la feature (con marcador `SDD:`).

| Ámbito | Comando (cwd) | Resultado | Resumen de la salida |
|---|---|---|---|
| frontend | `npx vitest run` sobre los 7 archivos de test de la feature (`frontend`) | ❌ (1 esperado) | 161 passed, 1 failed: el test de F8 (`BodyMetricsPage.register.test.tsx`, AC-001.4/AC-001.7), rojo legítimo por aserción. Los 6 archivos restantes en verde. |
| backend | `".venv/Scripts/python.exe" -m pytest -q tests/test_routes/test_body_metric_routes.py tests/test_services/test_body_metric_service.py` (`backend`) | ✅ | 176 passed (sin cambios en esta iteración) |

Comprobación de la forma de los tests nuevos: el test de F8 lleva el marcador `// SDD: 016 REQ-001 AC-001.4 AC-001.7` en la línea anterior a `it(`. Sin `skip`, `xfail`, `.only` ni `.skip` en el diff sin commitear.

## 2. Trazabilidad
Modo red: se evalúa el test nuevo de esta iteración. La implementación ya está commiteada (0da0cbd), así que los demás tests nuevos de la feature pasan; esto es lo esperado.

| REQ / NFR | AC | Tareas | Tests con `SDD:` | Estado del test |
|---|---|---|---|---|
| REQ-001 | AC-001.4, AC-001.7 | T-035 (corrección F8) | `BodyMetricsPage.register.test.tsx:289`: "si el perfil llega en lb con el diálogo abierto, la unidad no cambia y se guarda el peso en kg tal como se escribió" | ❌ rojo legítimo (aserción: la etiqueta pasa a "Peso (lb)" mientras el diálogo está abierto y el valor 80 no se conserva bajo "Peso (kg)") |

- Resto de tests nuevos de la feature (frontend, 7 archivos; backend, 2 archivos): ✅ en verde.
- Nota: `state.json.tests_snapshot` registra el sha256 de `BodyMetricsPage.register.test.tsx` anterior al test de F8; el orquestador debe actualizarlo al registrar la etapa.

## 3. Criterios de aceptación manuales
Ninguno en esta comprobación.

## 4. Fallos (si los hay)
Ninguno en el sentido de la comprobación: el único test en rojo es el esperado y su fallo es legítimo.

| # | Qué falló | Salida relevante (recortada) | Responsable probable (test-author · implementer · entorno) |
|---|---|---|---|
| — | Ninguno (el test de F8 falla por comportamiento ausente, como se espera en red) | `TestingLibraryElementError: Unable to find a label with the text of: Peso (kg)`; el DOM muestra `Peso (lb)` con el diálogo abierto, `register-date` = 2026-10-05 | — |
