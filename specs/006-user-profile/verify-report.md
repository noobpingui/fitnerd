# Verify report 006 — Perfil de usuario persistido en el backend

- **Modo:** red (tras la etapa tests, iteración 2/3)
- **Fecha:** 2026-10-12T05:21:08.181Z · **Rama:** `feat/006-user-profile` @ `d8529aa` (cambios sin commit de tests y scaffold)
- **Resultado:** PASS

## 1. Comandos ejecutados
| Ámbito | Comando | Resultado | Resumen de la salida |
|---|---|---|---|
| backend | `python -m pytest -q tests/test_services/test_profile_service.py tests/test_routes/test_profile_routes.py` | ✅ rojo legítimo | 139 failed, 0 errores de colección. 112 `NotImplementedError` (scaffold), 27 `404` de `/api/profile` inexistente (aserciones de estado), 18 `assert 404 == 200`, 7 `assert 404 == 400`, 2 `assert 404 == 401` |
| frontend | `npx vitest run` sobre los 12 archivos de test nuevos o con marcador nuevo | ✅ rojo legítimo | 61 failed, 0 passed. 21 `Error: not implemented` (scaffold), 12 + 11 + 1 + 1 textos o etiquetas que la UI aún no muestra (TestingLibrary), 2 aserciones numéricas de `calculateMacros` (2508 frente a 2322 y 2315) |

Archivos de test nuevos (con marcador `SDD:`):
- Backend: `backend/tests/test_services/test_profile_service.py` (41 marcadores), `backend/tests/test_routes/test_profile_routes.py` (25 marcadores).
- Frontend: `src/app/OnboardingGuard.test.tsx`, `src/app/OnboardingRoute.test.tsx`, `src/app/accountSwitch.test.tsx`, `src/features/onboarding/validation.test.ts`, `src/features/onboarding/pages/OnboardingPage.test.tsx`, `src/features/profile/mappers.test.ts`, `src/features/profile/pages/ProfilePage.test.tsx`, `src/features/home/pages/HomePage.test.tsx`, `src/features/macros/calculations.test.ts`, `src/features/macros/pages/MacrosPage.test.tsx`, `src/features/body-metrics/pages/BodyMetricsPage.test.tsx`, `src/lib/age.test.ts`.

Comprobaciones de la etapa red:
- **Errores ilegítimos:** ninguno. No hay `SyntaxError`, `ModuleNotFoundError`, errores de import, de fixture ni de `conftest`. Vitest no reporta `does not provide an export`, `Failed to resolve` ni `is not a function`.
- **Esqueletos `(scaffold)`:** `backend/services/profile_service.py` solo contiene `raise NotImplementedError` en `get_profile` y `save_profile`. La función `utc_now()` que señaló el red check anterior ya no existe. `frontend/src/lib/age.ts`, `frontend/src/features/profile/api.ts`, `frontend/src/features/profile/mappers.ts`, las dos funciones nuevas de `frontend/src/features/onboarding/validation.ts` y `frontend/src/app/OnboardingRoute.tsx` solo lanzan `Error("not implemented")` o `NotImplementedError`, sin lógica.
- **Sin `skip`, `xfail`, `.only` ni `.skip` en los tests nuevos.**
- **Mocks:** backend sin `unittest.mock` ni `monkeypatch`. Frontend usa `vi.mock` sobre la capa `api.ts` (permitido por Art. 5.5). Además, `BodyMetricsPage.test.tsx` y `ProfilePage.test.tsx` mockean componentes de gráficas o análisis (`TrendChart`, `ProgressAnalysis`). No es llamada de red, así que no infringe Art. 5.5; se anota solo como observación.
- **Cobertura de marcadores:** los 70 AC de `spec.md` aparecen en al menos un marcador `SDD:` de un test nuevo.

## 2. Trazabilidad
Esta comprobación no es bloqueante en modo red. Se revisará completa en la etapa verify.

- ACs sin test: — (los 70 AC tienen marcador `SDD:`)
- REQs sin tarea: — (no comprobado en red)
- Tareas sin marcar `[x]`: T-100 a T-129 (fase B, esperado en red)

## 3. Criterios de aceptación
Sin cambios en esta etapa. Los AC que solo se pueden verificar a mano (por ejemplo, la sensación visual del indicador de carga) se marcarán como "manual" en la etapa verify.

## 4. Fallos (si los hay)
Ningún fallo bloqueante. Los dos fallos del red check anterior quedan resueltos:

| # | Qué falló | Estado actual | Responsable probable |
|---|---|---|---|
| 1 | `OnboardingGuard.test.tsx` > "redirige a /onboarding si el servidor dice que el onboarding está pendiente" pasaba sin implementación | Ahora falla por aserción legítima: `Unable to find ... "Pantalla onboarding"` (el guard actual muestra `Pantalla Home`) | — (resuelto) |
| 2 | `utc_now()` con lógica en el esqueleto de `profile_service.py` | Eliminada; el esqueleto solo lanza `NotImplementedError` | — (resuelto) |
| Obs. | Tests de rutas que leían el JSON antes de comprobar el estado (`KeyError` sobre 404) | Ahora comprueban el código de estado antes de leer el cuerpo (`assert 404 == 200`, `assert 404 == 400`, `assert 404 == 401`) | — (resuelto) |

Rojos legítimos verificados (resumen):
- Backend: `NotImplementedError` del scaffold (112), `404` de `/api/profile` aún inexistente (27 en total, con sus aserciones de 200, 400 y 401 esperadas).
- Frontend: `Error: not implemented` de los esqueletos (21), textos o etiquetas que la UI aún no muestra ("Fecha de nacimiento", "Objetivo diario", "Meta: Perder peso", "No se pudo cargar tu perfil.", "Reintentar", "Pantalla onboarding", rol `status" del indicador de carga, etc.) y aserciones numéricas de Macros y `calculateMacros` (2508 frente a 2322 y 2315 esperados).
