# Tareas 031 — Chat de porciones en el diario (frontend)

- **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)
- **Ámbitos:** `frontend`
- Formato: `- [ ] T-NNN [REQ, AC] (tipo) descripción — ruta`

## Fase A0 — Scaffold

Esqueletos con `throw new Error("not implemented")` y parámetros con `_` (Art. P1 frontend 5). Las constantes y los
tipos se escriben con su valor final; los esquemas zod (valores) llevan un esquema provisional que no valida nada.

- [x] T-001 [REQ-002, AC-002.3] (scaffold) Constante `PORTION_QUESTION_MAX_LENGTH = 200` — `frontend/src/features/diary/constants.ts`
- [x] T-002 [REQ-003, AC-003.1] (scaffold) Tipos `PortionEstimate`, `PortionChatAnswer`, `PortionChatTurn` y `PortionQuestionFormValues` — `frontend/src/features/diary/types.ts`
- [x] T-003 [REQ-002, REQ-003, REQ-005, AC-002.2, AC-005.1] (scaffold) Esquemas provisionales `portionQuestionFormSchema` y `portionEstimateResponseSchema` (`z.never()` forzado con `as`) — `frontend/src/features/diary/schemas.ts`
- [x] T-004 [REQ-003, AC-003.1] (scaffold) `estimatePortion(_question: string): Promise<PortionEstimate>` que lanza `not implemented` — `frontend/src/features/diary/api.ts`
- [x] T-005 [REQ-007, AC-007.4] (scaffold) Constante `PORTION_ESTIMATE_FAILED_MESSAGE` y `portionEstimateErrorAnswer(_error: unknown)` que lanza `not implemented` — `frontend/src/features/diary/errors.ts`
- [x] T-006 [REQ-005, REQ-006, AC-005.3, AC-006.1] (scaffold) `formatEstimatedGrams(_grams)` y `portionAnswerFromEstimate(_estimate)` que lanzan `not implemented` — `frontend/src/features/diary/portionChat.ts`
- [x] T-007 [REQ-003, REQ-004, REQ-008, AC-003.1, AC-004.1, AC-008.2] (scaffold) `useEstimatePortion()`, tipo `PortionChatState` y `usePortionChat()` que lanzan `not implemented` — `frontend/src/features/diary/hooks.ts`
- [x] T-008 [REQ-001, AC-001.1] (scaffold) Componente `PortionChat({ chat }: { chat: PortionChatState })` que lanza `not implemented` — `frontend/src/features/diary/components/PortionChat.tsx`
- [x] T-009 [REQ-001, AC-001.2] (scaffold) Prop opcional `afterTotals?: ReactNode` en `DiaryDayView` (aún sin pintarla) — `frontend/src/features/diary/components/DiaryDayView.tsx`

## Fase A — Tests

- [x] T-010 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-006.1, AC-006.2] (test) Utilitario de test `EGGS_ESTIMATE`, `NOT_FOOD_RESPONSE`, `UNKNOWN_RESPONSE` y `makePortionEstimate` — `frontend/src/test/portionEstimateFixtures.ts`
- [x] T-011 [REQ-002, REQ-003, REQ-005, REQ-006, REQ-007, AC-002.2, AC-003.1, AC-005.1, AC-005.2, AC-005.3, AC-006.1, AC-006.2, AC-007.5] (test) Tests de `portionQuestionFormSchema` (vacío, espacios, recorte, 200/201) y `portionEstimateResponseSchema` (respuestas de la spec, 5000, rechazo de `grams` nulo o decimal y de `status` desconocido) — `frontend/src/features/diary/schemas.test.ts`
- [x] T-012 [REQ-003, REQ-007, AC-003.1, AC-003.3, AC-007.5] (test) `describe("estimatePortion")`: una llamada a `apiFetch` con POST y cuerpo exacto `{ question }`, respuesta parseada y rechazo de formas inesperadas — `frontend/src/features/diary/api.test.ts`
- [x] T-013 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5] (test) Tests de `portionEstimateErrorAnswer`: 429 notice, 400/503 error, 500, red y `ZodError` con mensaje genérico — `frontend/src/features/diary/errors.test.ts`
- [x] T-014 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-005.3, AC-006.1, AC-006.2] (test) Tests de `formatEstimatedGrams` y `portionAnswerFromEstimate` — `frontend/src/features/diary/portionChat.test.ts`
- [x] T-015 [REQ-001, REQ-002, NFR-001, AC-001.1, AC-001.6, AC-002.1, AC-002.2, AC-002.3, AC-002.4, AC-N001.1] (test) `PortionChat.test.tsx` parte 1: textos, etiqueta, botón, conversación vacía, contador, botón desactivado, Enter con espacios, recorte a 200, `role="log"` con nombre — `frontend/src/features/diary/components/PortionChat.test.tsx`
- [x] T-016 [REQ-003, REQ-004, NFR-001, AC-003.1, AC-003.2, AC-003.3, AC-004.1, AC-004.2, AC-N001.2] (test) `PortionChat.test.tsx` parte 2: envío con clic y Enter, cuerpo recortado, campo vacío, «Calculando…», sin historial, bloqueo con pregunta en curso, reactivación y foco en el campo — `frontend/src/features/diary/components/PortionChat.test.tsx`
- [x] T-017 [REQ-005, REQ-006, REQ-007, REQ-008, AC-005.1, AC-005.2, AC-005.3, AC-006.1, AC-006.2, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.6, AC-008.1] (test) `PortionChat.test.tsx` parte 3: estimación completa/mínima/5000, `not_food` y `unknown`, 429 neutro, 400 y 503 en error, red, 500 y forma inesperada, nueva pregunta tras fallo y orden de dos preguntas — `frontend/src/features/diary/components/PortionChat.test.tsx`
- [x] T-018 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5] (test) `DiaryPage.test.tsx`: bloque presente, orden entre totales y «Desayuno», antes del aviso de día vacío, día pasado con `?date=`, ausente al cargar y al fallar (se añade `estimatePortion: vi.fn()` a la factoría del mock) — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-019 [REQ-008, NFR-002, AC-008.2, AC-008.3, AC-008.4, AC-N002.1] (test) `DiaryPage.test.tsx`: conversación conservada al cambiar de día (4 formas), respuesta tardía tras el cambio con una sola llamada, conversación vacía al salir y volver, sin llamadas a `addMealItems`/biblioteca ni nueva lectura del diario — `frontend/src/features/diary/pages/DiaryPage.test.tsx`

## Fase B — Implementación

Orden por dependencia: esquemas → api → errores → lógica pura → hooks → componente → página.

- [ ] T-020 [REQ-002, REQ-003, REQ-005, REQ-006, REQ-007, AC-002.2, AC-005.1, AC-006.1, AC-007.5] (impl) Esquemas reales `portionQuestionFormSchema` (trim, 1–200) y `portionEstimateResponseSchema` (unión estricta, `grams` entero 1–5000) — `frontend/src/features/diary/schemas.ts`
- [ ] T-021 [REQ-003, REQ-007, NFR-002, AC-003.1, AC-003.3, AC-007.5, AC-N002.1] (impl) `estimatePortion` con `apiFetch` POST `{ question }` y validación zod — `frontend/src/features/diary/api.ts`
- [ ] T-022 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4] (impl) `portionEstimateErrorAnswer` (429 notice; 400/503 error con mensaje; resto genérico) — `frontend/src/features/diary/errors.ts`
- [ ] T-023 [REQ-005, REQ-006, AC-005.1, AC-005.2, AC-005.3, AC-006.1, AC-006.2] (impl) `formatEstimatedGrams` y `portionAnswerFromEstimate` — `frontend/src/features/diary/portionChat.ts`
- [ ] T-024 [REQ-003, REQ-004, REQ-007, REQ-008, NFR-002, AC-003.1, AC-003.3, AC-004.1, AC-004.2, AC-007.6, AC-008.2, AC-008.3, AC-N002.1] (impl) `useEstimatePortion` (sin reintentos ni invalidaciones) y `usePortionChat` (formulario, turnos, `inFlightRef`, actualización por id) — `frontend/src/features/diary/hooks.ts`
- [ ] T-025 [REQ-001, REQ-002, REQ-004, REQ-005, REQ-006, REQ-007, NFR-001, AC-001.1, AC-001.6, AC-002.1, AC-002.3, AC-002.4, AC-004.1, AC-005.1, AC-006.1, AC-007.1, AC-007.2, AC-N001.1, AC-N001.2] (impl) Componente `PortionChat`: título, texto, `role="log"`, turnos, formulario con contador y botón — `frontend/src/features/diary/components/PortionChat.tsx`
- [ ] T-026 [REQ-001, REQ-008, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-008.2, AC-008.3, AC-008.4] (impl) Pintar `afterTotals` en `DiaryDayView` y llamar a `usePortionChat()` en `DiaryPage` pasando `<PortionChat>` solo con diario y objetivos cargados — `frontend/src/features/diary/components/DiaryDayView.tsx`, `frontend/src/features/diary/pages/DiaryPage.tsx`

## Matriz de cobertura

| AC | Test | Impl |
|---|---|---|
| AC-001.1 | T-015, T-018 | T-025, T-026 |
| AC-001.2 | T-018 | T-026 |
| AC-001.3 | T-018 | T-026 |
| AC-001.4 | T-018 | T-026 |
| AC-001.5 | T-018 | T-026 |
| AC-001.6 | T-015 | T-025 |
| AC-002.1 | T-015 | T-025 |
| AC-002.2 | T-011, T-015 | T-020, T-024 |
| AC-002.3 | T-015 | T-025 |
| AC-002.4 | T-015 | T-025 |
| AC-003.1 | T-011, T-012, T-016 | T-021, T-024 |
| AC-003.2 | T-016 | T-024 |
| AC-003.3 | T-012, T-016 | T-021, T-024 |
| AC-004.1 | T-016 | T-024, T-025 |
| AC-004.2 | T-016 | T-024 |
| AC-005.1 | T-011, T-014, T-017 | T-020, T-023, T-025 |
| AC-005.2 | T-011, T-014, T-017 | T-023 |
| AC-005.3 | T-011, T-014, T-017 | T-023 |
| AC-006.1 | T-011, T-014, T-017 | T-020, T-023, T-025 |
| AC-006.2 | T-011, T-014, T-017 | T-023 |
| AC-007.1 | T-013, T-017 | T-022, T-025 |
| AC-007.2 | T-013, T-017 | T-022, T-025 |
| AC-007.3 | T-013, T-017 | T-022 |
| AC-007.4 | T-013, T-017 | T-022 |
| AC-007.5 | T-011, T-012, T-013, T-017 | T-020, T-021 |
| AC-007.6 | T-017 | T-024 |
| AC-008.1 | T-017 | T-024, T-025 |
| AC-008.2 | T-019 | T-024, T-026 |
| AC-008.3 | T-019 | T-024, T-026 |
| AC-008.4 | T-019 | T-026 |
| AC-N001.1 | T-015 | T-025 |
| AC-N001.2 | T-016 | T-025 |
| AC-N002.1 | T-019 | T-021, T-024 |
