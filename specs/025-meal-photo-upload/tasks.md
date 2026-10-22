# Tareas 025 — Registro de una comida con foto desde el diario

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-22)
- **Ámbito:** solo `frontend` (Q8). Los AC que el navegador real decide (orientación EXIF, HEIC, pantalla completa a
  375 px) se prueban en jsdom con el doble `FakePhotoProcessor` y, además, tienen comprobación manual en `verify`/`review`.

## Fase A0 — Andamiaje (implementer, modo scaffold)
Símbolos nuevos que los tests importan. Funciones y métodos lanzan `new Error("not implemented")` con parámetros
prefijados con `_`; los esquemas zod se crean con `z.custom` cuyo validador lanza, para que el import no falle y cada
test falle al validar. Las constantes con valor y las clases de error vacías (`PhotoReadError`, `UploadTooLargeError`)
no tienen lógica y se crean completas. `apiClient.ts`, `CustomFoodForm.tsx`, `MealSection.tsx` y
`PrivacyPolicyPage.tsx` ya existen: su ausencia de comportamiento ya es rojo legítimo, sin scaffold.

- [ ] T-001 [REQ-004, REQ-006, REQ-009] (scaffold) Añadir los tipos `AnalysisConfidence`, `ProposedFood`, `UnmatchedFood`, `MealPhotoAnalysis`, `ProposalEntry`, `ProposalFormValues` y `SavableItemPayload` (solo tipos) y los esqueletos `mealPhotoAnalysisSchema` y `proposalFormSchema` (`z.custom` que lanza "not implemented"); exportar `gramsError` — `frontend/src/features/diary/types.ts`, `frontend/src/features/diary/schemas.ts`
- [ ] T-002 [REQ-002, REQ-003, REQ-004, NFR-001] (scaffold) Crear `photo.ts` con las constantes del plan (`MAX_PHOTO_BYTES`, `MAX_UPLOAD_BYTES`, `MAX_UPLOAD_SIDE`, `JPEG_QUALITY`, `PHOTO_ACCEPT` y los cuatro mensajes), el tipo `PhotoSize`, la interfaz `PhotoProcessor`, las clases `PhotoReadError` y `UploadTooLargeError`, y los esqueletos `photoFileError`, `scaledSize`, `checkPhotoReadable`, `preparePhotoUpload` y `browserPhotoProcessor` (sus métodos lanzan "not implemented") — `frontend/src/features/diary/photo.ts`
- [ ] T-003 [REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011] (scaffold) Crear `proposal.ts` con los esqueletos `proposalFromAnalysis`, `catalogEntry`, `customEntry`, `isSavable`, `entryNutrients`, `proposalTotals`, `proposalItems`, `confidenceLabel`, `entryTag` y `formatProposalTotal` — `frontend/src/features/diary/proposal.ts`
- [ ] T-004 [REQ-012] (scaffold) Añadir a `errors.ts` las constantes `ANALYSIS_FAILED_MESSAGE` y `NO_FOODS_MESSAGE`, el tipo `AnalysisErrorView` y el esqueleto `analysisErrorView` — `frontend/src/features/diary/errors.ts`
- [ ] T-005 [REQ-004, REQ-005] (scaffold) Añadir los esqueletos `analyzeMealPhoto(_image)` y `useAnalyzeMealPhoto()` — `frontend/src/features/diary/api.ts`, `frontend/src/features/diary/hooks.ts`
- [ ] T-006 [REQ-001, REQ-002, REQ-012] (scaffold) Crear `MealPhotoDialog` con las props del plan, cuyo cuerpo lanza "not implemented" — `frontend/src/features/diary/components/MealPhotoDialog.tsx`

## Fase A — Tests (test-author)
Marcadores `// SDD: 025 REQ-… AC-…` en la línea anterior a cada test; nombres en español.

- [ ] T-010 [REQ-004, AC-004.1] (test) `apiFetch` con `FormData` no envía `Content-Type: application/json`, conserva `Authorization` y pasa el `FormData` como `body`; con un objeto sigue serializando JSON (regresión) — `frontend/src/lib/apiClient.test.ts`
- [ ] T-011 [REQ-002, REQ-003, REQ-004, REQ-006, NFR-001] (test) Dobles y fábricas: `FakePhotoProcessor` (`size`, `unreadable`, `jpegBytes`, `readCalls`, `jpegCalls`, `created`, `revoked`), `makePhotoFile` y `makeAnalysis`, `RICE`, `CHICKEN`, `TOMATO_SAUCE` — `frontend/src/test/photoFixtures.ts`, `frontend/src/test/analysisFixtures.ts`
- [ ] T-012 [REQ-003, AC-003.1, AC-003.2, AC-003.3] (test) `photoFileError` (PDF y GIF, tipo vacío con extensión `.heic`, 20 MB exactos válidos y +1 byte no) y `checkPhotoReadable` con foto ilegible — `frontend/src/features/diary/photo.test.ts`
- [ ] T-013 [REQ-004, AC-004.1, AC-004.2, AC-004.3, AC-004.4, AC-004.5] (test) `scaledSize` y `preparePhotoUpload` con el doble: 4000×3000 a 1600×1200, 800×600 sin agrandar, 3000×4000 orientada a 1200×1600, HEIC a JPEG y JPEG de más de 3 MB lanza `UploadTooLargeError` — `frontend/src/features/diary/photo.test.ts`
- [ ] T-014 [REQ-006, REQ-007, REQ-008, REQ-010, AC-006.1, AC-006.2, AC-006.4, AC-007.1, AC-008.1, AC-010.3] (test) Vista previa, confianza y totales de la propuesta (sin contar `unmatched`) — `frontend/src/features/diary/proposal.test.ts`
- [ ] T-015 [REQ-007, REQ-009, REQ-011, AC-007.2, AC-009.4, AC-011.1, AC-011.2, AC-N001.1] (test) `proposalItems`: orden, sin `unmatched`, 150.5 desde «150,5», personalizado con `per_100g`, duplicados y carga sin datos de imagen — `frontend/src/features/diary/proposal.test.ts`
- [ ] T-016 [REQ-006, REQ-007, AC-006.1, AC-007.3] (test) `proposalFormSchema` con gramos vacío, 0, 2001 y «150,25»; `mealPhotoAnalysisSchema` acepta la respuesta de la 024 y rechaza una `confidence` desconocida — `frontend/src/features/diary/schemas.test.ts`
- [ ] T-017 [REQ-012, AC-012.1, AC-012.3, AC-012.4, AC-012.6] (test) `analysisErrorView` para 503, 429, 400, 413, red y otros errores — `frontend/src/features/diary/errors.test.ts`
- [ ] T-018 [REQ-004, AC-004.1, AC-004.4] (test) `analyzeMealPhoto` llama a `/api/meals/analyze` con POST y un `FormData` con un único valor en `image` que es el `Blob` JPEG — `frontend/src/features/diary/api.test.ts`
- [ ] T-019 [REQ-001, REQ-002, AC-001.2, AC-001.3, AC-001.4, AC-002.1, AC-002.2, AC-002.3] (test) Diálogo: inicio, clases de pantalla completa, cancelar sin peticiones, atributos de los selectores, vista previa y cambio de foto — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-020 [REQ-003, REQ-004, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-004.5] (test) Diálogo: mensajes de validación sin vista previa ni peticiones, borrado del mensaje al elegir una válida y límite de 3 MB — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-021 [REQ-005, REQ-012, AC-005.1, AC-012.1, AC-012.2, AC-012.3, AC-012.4, AC-012.5, AC-012.6, AC-012.8] (test) Diálogo: «Analizando la foto…», errores 503, 429, 400, red y vacío con sus acciones, reintento con la misma imagen y propuesta solo con `unmatched` — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-022 [REQ-006, REQ-007, REQ-008, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-006.5, AC-007.1, AC-007.3, AC-008.1, AC-008.2] (test) Diálogo: propuesta, confianza, sin coincidencia, total, edición de gramos con avisos y quitar alimentos — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-023 [REQ-009, REQ-010, AC-009.1, AC-009.2, AC-009.3, AC-009.4, AC-010.1, AC-010.2, AC-010.3, AC-010.4, AC-010.5] (test) Diálogo: añadir otro alimento, resolver un sin coincidencia por catálogo o personalizado, volver a la propuesta y duplicados — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-024 [REQ-007, REQ-011, REQ-013, AC-007.2, AC-011.1, AC-011.2, AC-011.4, AC-011.5, AC-011.6, AC-013.1] (test) Diálogo: guardado en una sola petición, «Guardando…» y cierre bloqueado, errores 400 y otros, guardar desactivado sin alimentos y cancelar sin guardar — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-025 [NFR-001, NFR-002, AC-N001.1, AC-N001.2, AC-N002.1, AC-N002.2] (test) Diálogo: sin claves nuevas en el almacenamiento, vista previa liberada al cambiar y desmontar, nombres accesibles y regiones `status`/`alert` — `frontend/src/features/diary/components/MealPhotoDialog.test.tsx`
- [ ] T-026 [REQ-001, REQ-005, REQ-011, REQ-012, REQ-013, AC-001.1, AC-005.2, AC-011.3, AC-012.7, AC-013.2] (test) Pantalla Diario: cuatro botones «Cargar imagen en {sección}», cierre con análisis pendiente, tres alimentos tras guardar, «Registrar a mano» abre «Añadir a Cena» y reabrir empieza sin foto — `frontend/src/features/diary/pages/DiaryPage.test.tsx`
- [ ] T-027 [REQ-014, AC-014.1, AC-014.2, AC-014.3] (test) Política de privacidad: punto de Amazon Bedrock, frase de Langfuse y fecha del 22 de octubre de 2026 (actualiza el test de la 023 AC-012.3, exigido por la spec) — `frontend/src/features/legal/pages/PrivacyPolicyPage.test.tsx`
- [ ] T-028 [NFR-003, AC-N003.1] (test) Visitar `/home` no evalúa el módulo del diálogo de la foto — `frontend/src/app/mealPhotoRoute.test.tsx`

## Fase B — Implementación (implementer)
Orden: HTTP y datos → reglas puras → piezas de UI → ensamblado → legal.

- [ ] T-030 [REQ-004] (impl) `apiFetch` envía `FormData` tal cual y sin `Content-Type` JSON — `frontend/src/lib/apiClient.ts`
- [ ] T-031 [REQ-006, REQ-007] (impl) Implementar `mealPhotoAnalysisSchema` y `proposalFormSchema` (gramos validados con `gramsError` en `entries.i.grams`, sin validar `unmatched`) — `frontend/src/features/diary/schemas.ts`
- [ ] T-032 [REQ-012] (impl) Implementar `analysisErrorView` (400 y 413, 429, 503 y resto) — `frontend/src/features/diary/errors.ts`
- [ ] T-033 [REQ-004, REQ-005] (impl) Implementar `analyzeMealPhoto` (FormData con `image`, nombre `comida.jpg`, respuesta validada) y `useAnalyzeMealPhoto` sin reintentos — `frontend/src/features/diary/api.ts`, `frontend/src/features/diary/hooks.ts`
- [ ] T-034 [REQ-003, REQ-004] (impl) Implementar `photoFileError`, `scaledSize`, `checkPhotoReadable` y `preparePhotoUpload` — `frontend/src/features/diary/photo.ts`
- [ ] T-035 [REQ-002, REQ-004, NFR-001] (impl) Implementar `browserPhotoProcessor` (`HTMLImageElement` y `decode()` desde URL `blob:` revocada, canvas con orientación aplicada, `toBlob` JPEG, vista previa y su revocación; ADR-0033) — `frontend/src/features/diary/photo.ts`
- [ ] T-036 [REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011] (impl) Implementar las funciones de `proposal.ts` — `frontend/src/features/diary/proposal.ts`
- [ ] T-037 [REQ-010] (impl) `CustomFoodForm` admite `defaultGrams` y `submitLabel` sin cambiar su comportamiento actual — `frontend/src/features/diary/components/CustomFoodForm.tsx`
- [ ] T-038 [REQ-009, REQ-010] (impl) Crear `ProposalSearchStep` (búsqueda del catálogo con texto inicial, mismos estados que `AddFoodDialog`, «Volver a la propuesta») — `frontend/src/features/diary/components/ProposalSearchStep.tsx`
- [ ] T-039 [REQ-002, NFR-002] (impl) Crear `PhotoPicker` («Hacer una foto» con `capture="environment"` y «Elegir una foto», inputs sin `multiple` con `data-testid`) — `frontend/src/features/diary/components/PhotoPicker.tsx`
- [ ] T-040 [REQ-006, REQ-007, REQ-008, REQ-010, NFR-002] (impl) Crear `ProposalEntryRow` (nombre, etiqueta, gramos, vista previa, sin coincidencia y botones con nombre accesible) — `frontend/src/features/diary/components/ProposalEntryRow.tsx`
- [ ] T-041 [REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011] (impl) Crear `PhotoReview` (formulario con `useFieldArray`, total, avisos, vistas de búsqueda y personalizado, guardar) — `frontend/src/features/diary/components/PhotoReview.tsx`
- [ ] T-042 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-011, REQ-012, REQ-013, NFR-001, NFR-002] (impl) Implementar `MealPhotoDialog`: fases foto, análisis y revisión, validación, vista previa y su liberación, errores, guardado con `useAddMealItems` y cierre — `frontend/src/features/diary/components/MealPhotoDialog.tsx`
- [ ] T-043 [REQ-001, REQ-012, REQ-013, NFR-003] (impl) Botón «Cargar imagen en {sección}», estado `photoOpen` y paso a «Añadir a {sección}» — `frontend/src/features/diary/components/MealSection.tsx`
- [ ] T-044 [REQ-014] (impl) Punto de Amazon Bedrock, frase de Langfuse y fecha «22 de octubre de 2026» — `frontend/src/features/legal/pages/PrivacyPolicyPage.tsx`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-026 | T-043 |
| REQ-001 | AC-001.2 | T-019 | T-042 |
| REQ-001 | AC-001.3 | T-019 | T-042 |
| REQ-001 | AC-001.4 | T-019 | T-042 |
| REQ-002 | AC-002.1 | T-019 | T-039, T-042 |
| REQ-002 | AC-002.2 | T-019 | T-035, T-042 |
| REQ-002 | AC-002.3 | T-019 | T-035, T-042 |
| REQ-003 | AC-003.1 | T-012, T-020 | T-034, T-042 |
| REQ-003 | AC-003.2 | T-012, T-020 | T-034, T-042 |
| REQ-003 | AC-003.3 | T-012, T-020 | T-034, T-035, T-042 |
| REQ-003 | AC-003.4 | T-020 | T-042 |
| REQ-004 | AC-004.1 | T-010, T-013, T-018 | T-030, T-033, T-034 |
| REQ-004 | AC-004.2 | T-013 | T-034 |
| REQ-004 | AC-004.3 | T-013 | T-034, T-035 |
| REQ-004 | AC-004.4 | T-013, T-018 | T-034, T-035 |
| REQ-004 | AC-004.5 | T-013, T-020 | T-034, T-042 |
| REQ-005 | AC-005.1 | T-021 | T-033, T-042 |
| REQ-005 | AC-005.2 | T-026 | T-042, T-043 |
| REQ-006 | AC-006.1 | T-014, T-016, T-022 | T-031, T-036, T-040, T-041 |
| REQ-006 | AC-006.2 | T-014, T-022 | T-036, T-040 |
| REQ-006 | AC-006.3 | T-022 | T-040, T-041 |
| REQ-006 | AC-006.4 | T-014, T-022 | T-036, T-041 |
| REQ-006 | AC-006.5 | T-022 | T-041 |
| REQ-007 | AC-007.1 | T-014, T-022 | T-036, T-041 |
| REQ-007 | AC-007.2 | T-015, T-024 | T-036, T-041 |
| REQ-007 | AC-007.3 | T-016, T-022 | T-031, T-040, T-041 |
| REQ-008 | AC-008.1 | T-014, T-022 | T-040, T-041 |
| REQ-008 | AC-008.2 | T-022 | T-041 |
| REQ-009 | AC-009.1 | T-023 | T-038, T-041 |
| REQ-009 | AC-009.2 | T-023 | T-036, T-038, T-041 |
| REQ-009 | AC-009.3 | T-023 | T-041 |
| REQ-009 | AC-009.4 | T-015, T-023 | T-036, T-041 |
| REQ-010 | AC-010.1 | T-023 | T-036, T-038, T-041 |
| REQ-010 | AC-010.2 | T-023 | T-037, T-041 |
| REQ-010 | AC-010.3 | T-014, T-023 | T-036, T-037, T-041 |
| REQ-010 | AC-010.4 | T-023 | T-037, T-041 |
| REQ-010 | AC-010.5 | T-023 | T-041 |
| REQ-011 | AC-011.1 | T-015, T-024 | T-036, T-041, T-042 |
| REQ-011 | AC-011.2 | T-015, T-024 | T-036, T-041, T-042 |
| REQ-011 | AC-011.3 | T-026 | T-042, T-043 |
| REQ-011 | AC-011.4 | T-024 | T-041 |
| REQ-011 | AC-011.5 | T-024 | T-042 |
| REQ-011 | AC-011.6 | T-024 | T-042 |
| REQ-012 | AC-012.1 | T-017, T-021 | T-032, T-042 |
| REQ-012 | AC-012.2 | T-021 | T-042 |
| REQ-012 | AC-012.3 | T-017, T-021 | T-032, T-042 |
| REQ-012 | AC-012.4 | T-017, T-021 | T-032, T-042 |
| REQ-012 | AC-012.5 | T-021 | T-042 |
| REQ-012 | AC-012.6 | T-017, T-021 | T-032, T-042 |
| REQ-012 | AC-012.7 | T-026 | T-042, T-043 |
| REQ-012 | AC-012.8 | T-021 | T-042 |
| REQ-013 | AC-013.1 | T-024 | T-042 |
| REQ-013 | AC-013.2 | T-026 | T-043 |
| REQ-014 | AC-014.1 | T-027 | T-044 |
| REQ-014 | AC-014.2 | T-027 | T-044 |
| REQ-014 | AC-014.3 | T-027 | T-044 |
| NFR-001 | AC-N001.1 | T-015, T-025 | T-036, T-042 |
| NFR-001 | AC-N001.2 | T-025 | T-035, T-042 |
| NFR-002 | AC-N002.1 | T-025 | T-039, T-040, T-042 |
| NFR-002 | AC-N002.2 | T-025 | T-042 |
| NFR-003 | AC-N003.1 | T-028 | T-043 |
