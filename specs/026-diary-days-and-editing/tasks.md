# Tareas 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-27)

<!--
Reglas:
- Cada tarea es atómica: un objetivo, verificable y de pocos archivos (si necesita más de unos 3, divídela).
- Formato OBLIGATORIO, que el verifier parsea:
    - [ ] T-NNN [REQ-001, AC-001.1] (scaffold|test|impl|migration|config|docs) <descripción> — `ruta/archivo`
- Orden: scaffold → test → impl.
- La casilla la marca [x] el agente responsable al completar la tarea; nadie más cambia el texto.
- No hay migración ni config: la 026 no cambia el modelo de datos ni añade variables.
-->

## Fase A0 — Andamiaje (implementer, modo scaffold)
Solo símbolos nuevos que los tests importan. Cuerpos: `raise NotImplementedError("not implemented")` /
`throw new Error("not implemented")`, con los parámetros prefijados con `_` en TypeScript. La ruta
`POST /api/meals/restore` no necesita andamiaje (su ausencia ya es rojo legítimo) y `alert-dialog.tsx` es un envoltorio
declarativo que se hace en la fase B.

- [x] T-001 [REQ-007, NFR-002] (scaffold) Crear la clase `RestoreTokenSigner` (`__init__(secret_key)` que solo guarda la clave; `sign(user_id, payload)` y `verify(user_id, token)` lanzan "not implemented") y la constante `MAX_RESTORE_TOKEN_LENGTH = 4096` — `backend/utils/restore_token.py`
- [x] T-002 [REQ-001, REQ-007] (scaffold) Añadir a `meal_rules`: constantes `ADD_WINDOW_PAST_DAYS = 366`, `ADD_WINDOW_FUTURE_DAYS = 1`, `RESTORE_TOKEN_TTL_SECONDS = 120`; dataclass `RemovedItemSnapshot` con los campos del plan; y `epoch_seconds`, `snapshot_payload` y `parse_snapshot_payload` con su firma exacta que lanzan "not implemented" — `backend/services/meal_rules.py`
- [x] T-003 [REQ-007, NFR-002] (scaffold) Añadir el parámetro `restore_signer=None` al constructor de `MealService` (solo lo guarda) y el método `restore_item(self, user_id, data)` que lanza "not implemented" — `backend/services/meal_service.py`
- [x] T-004 [REQ-002, REQ-005, REQ-007] (scaffold) Añadir las constantes `DIARY_PAST_DAYS = 365`, `UNDO_DURATION_MS = 10_000`, `TODAY_CHECK_INTERVAL_MS = 30_000` y el tipo `RemovalUndo` — `frontend/src/features/diary/constants.ts`, `frontend/src/features/diary/types.ts`
- [x] T-005 [REQ-002, REQ-003] (scaffold) Crear `isIsoDate`, `diaryDateBounds` y `resolveDiaryDate` con su firma exacta, y añadir `formatDiaryDate(isoDate, today?)` en `format.ts`, todas lanzando "not implemented" — `frontend/src/features/diary/days.ts`, `frontend/src/features/diary/format.ts`
- [x] T-006 [REQ-007, REQ-006] (scaffold) Añadir `DELETE_MEAL_FAILED_MESSAGE`, `UNDO_FAILED_MESSAGE` y `undoErrorMessage` (lanza "not implemented") en `errors.ts`, y `removalResponseSchema` en `schemas.ts` — `frontend/src/features/diary/errors.ts`, `frontend/src/features/diary/schemas.ts`
- [x] T-007 [REQ-006, REQ-007] (scaffold) Añadir `restoreMealItem(_restoreToken)` y `deleteMeal(_mealId)` que lanzan "not implemented" — `frontend/src/features/diary/api.ts`
- [x] T-008 [REQ-005, REQ-006, REQ-007] (scaffold) Añadir `useRestoreMealItem`, `useDeleteMeal`, `useToday`, `useRemovalUndo` y el tipo `RemovalUndoState` con su firma exacta, lanzando "not implemented" — `frontend/src/features/diary/hooks.ts`
- [x] T-009 [REQ-002, REQ-006, REQ-009, NFR-001] (scaffold) Crear los componentes `DiaryDateNav`, `DeleteMealDialog` y `ConfirmDialog` con sus props exactas, lanzando "not implemented" — `frontend/src/features/diary/components/DiaryDateNav.tsx`, `frontend/src/features/diary/components/DeleteMealDialog.tsx`, `frontend/src/features/diary/components/ConfirmDialog.tsx`

## Fase A — Tests (test-author)

### Backend
- [x] T-020 [NFR-002, REQ-007, AC-N002.2] (test) `RestoreTokenSigner`: firmar y verificar devuelve el payload; con otro `user_id`, payload o firma alterados, sin punto, no texto o demasiado largo devuelve `None`; un `feedback_id` de `FeedbackTokenSigner` no se acepta — `backend/tests/test_services/test_restore_token.py`
- [x] T-021 [REQ-001, REQ-007, AC-001.1, AC-001.2, AC-007.4] (test) `check_add_window` con hoy 2026-10-21 acepta 2025-10-20, 2026-01-15, 2026-10-21 y 2026-10-22 y rechaza 2025-10-19 y 2026-10-23 con el mensaje nuevo; `snapshot_payload`/`parse_snapshot_payload` ida y vuelta (catálogo, USDA con `None`, personalizado) y `None` con payloads mal formados; actualiza los tests de la 022 que la ventana nueva sustituye (`test_check_add_window_accepts_yesterday_today_and_tomorrow`, `test_check_add_window_rejects_two_days_away`, `OUT_OF_WINDOW`) — `backend/tests/test_services/test_meal_rules.py`
- [x] T-022 [REQ-001, REQ-007, AC-001.1, AC-001.2, AC-007.2] (test) `MealService.add_items` con la ventana nueva (sustituye `test_add_items_rejects_dates_outside_the_window` y `OUT_OF_WINDOW`) y `remove_item` devuelve un token y quita el alimento de verdad — `backend/tests/test_services/test_meal_service.py`
- [x] T-023 [REQ-007, NFR-002, AC-007.3, AC-007.4, AC-007.5, AC-007.10, AC-N002.2] (test) `MealService.restore_item`: vuelve entre sus vecinos con mismos gramos, valores por 100 g y nutrientes; conserva valores aunque el catálogo falso cambie; recrea la comida borrada (`created=True`); con 50 alimentos lanza `ValidationError` con `rollback`; token de otro usuario, alterado o caducado (`FakeClock`, 121 s) lanza `ResourceNotFoundError` sin escribir; cuerpo no objeto lanza `ValidationError` «La petición no es válida.» — `backend/tests/test_services/test_meal_service.py`
- [x] T-024 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) `POST /api/meals` con las fechas de AC-001.1 (201/200) y AC-001.2 (400, nada guardado), AC-001.3 (`date` ausente, `20-10-2026`, `2026-02-30`) y PATCH/DELETE de un alimento de hace 200 días; actualiza `test_post_accepts_yesterday_today_and_tomorrow_of_the_server_clock` y `test_post_rejects_dates_outside_the_window` — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-025 [REQ-007, AC-007.2, AC-007.3, AC-007.5, AC-007.10] (test) `DELETE …/items/{id}?undo=1` → 200 con `restore_token` y sin `undo` → 204 (regresión de la 022); `POST /api/meals/restore` → 200 en la comida existente y en su posición, 201 tras quitar el único alimento, 400 con 50 alimentos — `backend/tests/test_routes/test_meal_routes.py`
- [x] T-026 [NFR-002, AC-N002.1, AC-N002.2, AC-N002.3] (test) Aislamiento y sesión: borrar la comida de B siendo A → 404 y B intacta; restaurar con el token de B siendo A → 404 sin cambios; sin sesión, `POST /api/meals`, `DELETE /api/meals/{id}`, `DELETE …/items/{id}` y `POST /api/meals/restore` → 401 — `backend/tests/test_routes/test_meal_routes.py`

### Frontend: lógica y red
- [x] T-027 [REQ-002, REQ-003, AC-002.5, AC-002.6, AC-003.1, AC-003.3] (test) `isIsoDate`, `diaryDateBounds("2026-10-26")` → 2025-10-26..2026-10-26 y `resolveDiaryDate` (válida, inválida, fuera de intervalo, `null`, con `normalize`) — `frontend/src/features/diary/days.test.ts`
- [x] T-028 [REQ-002, AC-002.1, AC-002.7] (test) `formatDiaryDate`: «domingo, 25 de octubre» sin año y «miércoles, 31 de diciembre de 2025» con hoy 2026-10-26 — `frontend/src/features/diary/format.test.ts`
- [x] T-029 [REQ-006, REQ-007, AC-006.3, AC-007.3] (test) `removeMealItem` llama a `…?undo=1` y devuelve el token (o `null` con respuesta vacía); `restoreMealItem` hace `POST /api/meals/restore`; `deleteMeal` hace `DELETE /api/meals/1` — `frontend/src/features/diary/api.test.ts`
- [x] T-030 [REQ-005, AC-005.1, AC-005.2, AC-005.4] (test) `useToday`: cambia al pasar la medianoche en ≤ 60 s, cambia con `visibilitychange`, no cambia con `paused` y cambia al quitar la pausa — `frontend/src/features/diary/hooks.test.tsx`
- [x] T-031 [REQ-007, AC-007.6, AC-007.7, AC-007.9, AC-007.10, AC-007.11] (test) `useRemovalUndo`: el aviso desaparece a los 10 s, un `offer` nuevo sustituye al anterior, error de red deja el aviso con «No se pudo deshacer. Vuelve a intentarlo.», 400 muestra «Una comida no puede tener más de 50 alimentos.», `undo` doble con la primera en curso hace una sola llamada — `frontend/src/features/diary/hooks.test.tsx`

### Frontend: componentes
- [x] T-032 [REQ-002, NFR-001, AC-002.3, AC-002.5, AC-002.6, AC-N001.1] (test) `DiaryDateNav`: «Día siguiente» deshabilitado y sin «Hoy» en hoy; «Día anterior» deshabilitado en el límite; selector con `min`/`max` y `onChange` al elegir 2026-03-10; nombres accesibles y etiqueta «Elegir día» — `frontend/src/features/diary/components/DiaryDateNav.test.tsx`
- [x] T-033 [REQ-006, NFR-001, AC-006.2, AC-006.4, AC-006.5, AC-006.6, AC-006.7, AC-N001.3] (test) `DeleteMealDialog`: títulos y textos con 3 y con 1 alimento; «Cancelar»/Escape sin petición; error → mensaje y sigue abierto; 404 → cierra sin error; «Borrar» deshabilitado durante la petición con una sola llamada; rol `alertdialog` con nombre = título y foco dentro — `frontend/src/features/diary/components/DeleteMealDialog.test.tsx`
- [x] T-034 [REQ-009, NFR-001, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6, AC-N001.3] (test) Confirmación al descartar la propuesta: «Cancelar», Escape y clic fuera piden confirmación; «Descartar» cierra sin guardar; «Seguir revisando» o Escape conservan lo editado; sin propuesta, con análisis en curso o guardando no se pide; actualiza los tests de la 025 «Cancelar» y «Escape» (REQ-013) para pasar por «Descartar» — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`

### Frontend: pantalla
- [x] T-035 [REQ-002, AC-002.1, AC-002.2, AC-002.4, AC-002.7, AC-002.8, AC-002.9, AC-002.10] (test) `DiaryPage` navegación: día anterior/siguiente, «Hoy», fecha con año, textos de día vacío, respuesta tardía de otro día (promesas diferidas en orden inverso) y controles visibles con carga pendiente o error — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-036 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4] (test) `DiaryPage` dirección: `?date=` abre ese día, la dirección con y sin parámetro, parámetros inválidos o fuera de intervalo → hoy y `/diary`, y el historial no gana una entrada por día (`createMemoryRouter`, `router.navigate(-1)`) — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-037 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4] (test) `DiaryPage` edición de un día pasado: añadir del catálogo y guardar foto llevan la fecha del día mostrado; editar y quitar cambian solo ese día; el 400 de la ventana se muestra en el diálogo sin cerrarlo — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-038 [REQ-005, AC-005.1, AC-005.3, AC-005.4] (test) `DiaryPage` medianoche: en hoy pasa al nuevo día; en otro día se queda; con el diálogo «Añadir a Cena» abierto no se cierra y guarda con la fecha en que se abrió — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-039 [REQ-006, AC-006.1, AC-006.3] (test) `DiaryPage` «Borrar comida»: solo con alimentos, nombre accesible «Borrar Cena», y tras confirmar la sección muestra «Sin alimentos.» y los totales se actualizan — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-040 [REQ-007, NFR-001, AC-007.1, AC-007.2, AC-007.3, AC-007.5, AC-007.7, AC-007.8, AC-007.10, AC-N001.2] (test) `DiaryPage` «Deshacer»: aviso «Quitaste {nombre}.» en `role="status"` sin mover el foco, el alimento sigue quitado al releer, «Deshacer» lo devuelve entre sus vecinos y restaura totales, el segundo quitar sustituye el aviso, cambiar de día lo retira y la comida llena muestra su mensaje — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-041 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (test) `DiaryPage` barras: superar el objetivo marca las cuatro barras con `data-over` y `bg-amber-500`, igualar o quedar por debajo usa `bg-primary`, y no aparece `role="alert"` ni `text-destructive` por el exceso — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [x] T-042 [REQ-009, AC-009.2] (test) Actualizar el test de la 025 «tras cerrar el diálogo con una propuesta, al volver a abrirlo empieza sin foto» para que cierre pasando por «Descartar» — `frontend/src/features/diary/pages/DiaryPage.test.tsx`

## Fase B — Implementación (implementer)

### Backend (datos y utilidades → lógica → interfaz)
- [x] T-050 [REQ-007, NFR-002, AC-N002.2] (impl) Implementar `RestoreTokenSigner.sign`/`verify` (base64url sin relleno, HMAC-SHA256 con prefijo `meal-item-restore:v1:<user_id>:`, `hmac.compare_digest`, `None` ante cualquier forma inválida) — `backend/utils/restore_token.py`
- [x] T-051 [REQ-001, REQ-007, AC-001.1, AC-001.2, AC-007.4] (impl) Implementar `check_add_window` con la ventana −366/+1 y el mensaje nuevo, `epoch_seconds`, `snapshot_payload` y `parse_snapshot_payload` con la validación del plan — `backend/services/meal_rules.py`
- [x] T-052 [REQ-007, NFR-002, AC-007.2, AC-007.3, AC-007.4, AC-007.5, AC-007.10, AC-N002.2] (impl) `remove_item` construye el snapshot y devuelve el token firmado; implementar `restore_item` (verificar, caducidad, bloqueo del usuario, límite de 50, crear comida si falta, reinsertar en su posición, `rollback` ante error) — `backend/services/meal_service.py`
- [x] T-053 [REQ-007, NFR-002, AC-007.2, AC-007.3, AC-007.5, AC-007.10, AC-N002.1, AC-N002.2, AC-N002.3] (impl) Ruta `DELETE …/items/{id}?undo=1` (200 con token, 204 sin él), nueva ruta `POST /api/meals/restore` con `@require_auth` (201/200) e inyección de `RestoreTokenSigner(SECRET_KEY)` en `_build_meal_service()` — `backend/routes/meal_routes.py`

### Frontend (lógica y red → hooks → componentes → página)
- [x] T-060 [REQ-002, REQ-003, AC-002.1, AC-002.5, AC-002.6, AC-002.7, AC-003.1, AC-003.3] (impl) Implementar `isIsoDate`, `diaryDateBounds`, `resolveDiaryDate` y `formatDiaryDate` — `frontend/src/features/diary/days.ts`, `frontend/src/features/diary/format.ts`
- [x] T-061 [REQ-006, REQ-007, AC-007.9, AC-007.10] (impl) Implementar `undoErrorMessage` (400 → mensaje del servidor; resto → `UNDO_FAILED_MESSAGE`) — `frontend/src/features/diary/errors.ts`
- [x] T-062 [REQ-006, REQ-007, AC-006.3, AC-007.3] (impl) `removeMealItem` con `?undo=1` y `removalResponseSchema.safeParse`, `restoreMealItem` y `deleteMeal` — `frontend/src/features/diary/api.ts`
- [x] T-063 [REQ-006, REQ-007, AC-006.3, AC-006.6, AC-007.3] (impl) `useRemoveMealItem` devuelve el token; `useRestoreMealItem` y `useDeleteMeal` (404 = éxito) invalidan `diaryKeys.day(date)` — `frontend/src/features/diary/hooks.ts`
- [x] T-064 [REQ-005, AC-005.1, AC-005.2, AC-005.4] (impl) Implementar `useToday` (intervalo de 30 s, `visibilitychange`, pausa y comprobación al reanudar) — `frontend/src/features/diary/hooks.ts`
- [x] T-065 [REQ-007, AC-007.6, AC-007.7, AC-007.9, AC-007.10, AC-007.11] (impl) Implementar `useRemovalUndo` (aviso de 10 s, `offer`, `undo` con protección ante doble envío, error expuesto) — `frontend/src/features/diary/hooks.ts`
- [x] T-066 [REQ-006, REQ-009, NFR-001, AC-N001.3] (impl) Crear el envoltorio shadcn `AlertDialog` e implementar `ConfirmDialog` (rol `alertdialog`, confirmar sin cierre automático, error en `role="alert"`, cancelar bloqueado con `isPending`) — `frontend/src/components/ui/alert-dialog.tsx`, `frontend/src/features/diary/components/ConfirmDialog.tsx`
- [x] T-067 [REQ-006, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-006.6, AC-006.7] (impl) Implementar `DeleteMealDialog` con los textos de la spec y el manejo de error, 404 y petición en curso — `frontend/src/features/diary/components/DeleteMealDialog.tsx`
- [x] T-068 [REQ-002, NFR-001, AC-002.3, AC-002.4, AC-002.5, AC-002.6, AC-N001.1] (impl) Implementar `DiaryDateNav` (anterior, siguiente, «Hoy», selector con etiqueta «Elegir día» y `min`/`max`) — `frontend/src/features/diary/components/DiaryDateNav.tsx`
- [x] T-069 [REQ-008, AC-008.1, AC-008.2, AC-008.3, AC-008.4] (impl) `NutrientProgress` con `over` (`data-over`, `bg-amber-500`) y `DailyTotals` que lo pasa — `frontend/src/features/diary/components/NutrientProgress.tsx`, `frontend/src/features/diary/components/DailyTotals.tsx`
- [x] T-070 [REQ-004, REQ-006, REQ-007, NFR-001, AC-006.1, AC-007.1, AC-007.3, AC-N001.2] (impl) `MealSection`: botón «Borrar comida», aviso «Quitaste {nombre}.» con «Deshacer» en `role="status"`, props `undo` y `onDialogOpenChange` — `frontend/src/features/diary/components/MealSection.tsx`
- [x] T-071 [REQ-002, REQ-004, REQ-007, AC-002.8, AC-004.1, AC-004.3, AC-007.8] (impl) Crear `DiaryDayView` (totales, secciones, texto de día vacío, `useRemovalUndo`) — `frontend/src/features/diary/components/DiaryDayView.tsx`
- [x] T-072 [REQ-002, REQ-003, REQ-004, REQ-005, AC-002.1, AC-002.2, AC-002.9, AC-002.10, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-004.2, AC-004.4, AC-005.1, AC-005.3, AC-005.4] (impl) `DiaryPage`: día desde `?date=` con `replace`, `useToday` en pausa con diálogos abiertos, cabecera y `DiaryDateNav` siempre visibles, `DiaryDayView` con `key={date}` — `frontend/src/features/diary/pages/DiaryPage.tsx`
- [x] T-073 [REQ-009, NFR-001, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-009.5, AC-009.6] (impl) `MealPhotoDialog`: `requestClose` y confirmación «¿Descartar la propuesta?» — `frontend/src/features/diary/components/MealPhotoDialog.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-021, T-022, T-024 | T-051 |
| REQ-001 | AC-001.2 | T-021, T-022, T-024 | T-051 |
| REQ-001 | AC-001.3 | T-024 | T-051 |
| REQ-001 | AC-001.4 | T-024 | T-051 |
| REQ-002 | AC-002.1 | T-028, T-035 | T-060, T-072 |
| REQ-002 | AC-002.2 | T-035 | T-072 |
| REQ-002 | AC-002.3 | T-032 | T-068 |
| REQ-002 | AC-002.4 | T-035 | T-068 |
| REQ-002 | AC-002.5 | T-027, T-032 | T-060, T-068 |
| REQ-002 | AC-002.6 | T-027, T-032 | T-060, T-068 |
| REQ-002 | AC-002.7 | T-028, T-035 | T-060 |
| REQ-002 | AC-002.8 | T-035 | T-071 |
| REQ-002 | AC-002.9 | T-035 | T-072 |
| REQ-002 | AC-002.10 | T-035 | T-072 |
| REQ-003 | AC-003.1 | T-027, T-036 | T-060, T-072 |
| REQ-003 | AC-003.2 | T-036 | T-072 |
| REQ-003 | AC-003.3 | T-027, T-036 | T-060, T-072 |
| REQ-003 | AC-003.4 | T-036 | T-072 |
| REQ-004 | AC-004.1 | T-037 | T-071 |
| REQ-004 | AC-004.2 | T-037 | T-072 |
| REQ-004 | AC-004.3 | T-037 | T-071 |
| REQ-004 | AC-004.4 | T-037 | T-072 |
| REQ-005 | AC-005.1 | T-030, T-038 | T-064, T-072 |
| REQ-005 | AC-005.2 | T-030 | T-064 |
| REQ-005 | AC-005.3 | T-038 | T-072 |
| REQ-005 | AC-005.4 | T-030, T-038 | T-064, T-072 |
| REQ-006 | AC-006.1 | T-039 | T-070 |
| REQ-006 | AC-006.2 | T-033 | T-067 |
| REQ-006 | AC-006.3 | T-029, T-039 | T-062, T-063, T-067 |
| REQ-006 | AC-006.4 | T-033 | T-067 |
| REQ-006 | AC-006.5 | T-033 | T-067 |
| REQ-006 | AC-006.6 | T-033 | T-063, T-067 |
| REQ-006 | AC-006.7 | T-033 | T-067 |
| REQ-007 | AC-007.1 | T-040 | T-070 |
| REQ-007 | AC-007.2 | T-022, T-025, T-040 | T-052, T-053 |
| REQ-007 | AC-007.3 | T-023, T-025, T-029, T-040 | T-052, T-053, T-062, T-070 |
| REQ-007 | AC-007.4 | T-021, T-023 | T-051, T-052 |
| REQ-007 | AC-007.5 | T-023, T-025, T-040 | T-052, T-053 |
| REQ-007 | AC-007.6 | T-031 | T-065 |
| REQ-007 | AC-007.7 | T-031, T-040 | T-065 |
| REQ-007 | AC-007.8 | T-040 | T-071 |
| REQ-007 | AC-007.9 | T-031 | T-061, T-065 |
| REQ-007 | AC-007.10 | T-023, T-025, T-031, T-040 | T-052, T-053, T-061, T-065 |
| REQ-007 | AC-007.11 | T-031 | T-065 |
| REQ-008 | AC-008.1 | T-041 | T-069 |
| REQ-008 | AC-008.2 | T-041 | T-069 |
| REQ-008 | AC-008.3 | T-041 | T-069 |
| REQ-008 | AC-008.4 | T-041 | T-069 |
| REQ-009 | AC-009.1 | T-034 | T-073 |
| REQ-009 | AC-009.2 | T-034, T-042 | T-073 |
| REQ-009 | AC-009.3 | T-034 | T-073 |
| REQ-009 | AC-009.4 | T-034 | T-073 |
| REQ-009 | AC-009.5 | T-034 | T-073 |
| REQ-009 | AC-009.6 | T-034 | T-073 |
| NFR-001 | AC-N001.1 | T-032 | T-068 |
| NFR-001 | AC-N001.2 | T-040 | T-070 |
| NFR-001 | AC-N001.3 | T-033, T-034 | T-066 |
| NFR-002 | AC-N002.1 | T-026 | T-053 |
| NFR-002 | AC-N002.2 | T-020, T-023, T-026 | T-050, T-052, T-053 |
| NFR-002 | AC-N002.3 | T-026 | T-053 |
