# Review 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Iteración:** 2 de 4
- **Diff revisado:** `git diff main...feat/026-diary-days-and-editing` @ `16215b2` (+ cambios sin commitear en `specs/026-diary-days-and-editing/`: `state.json`, `verify-report.md`)
- **Veredicto:** APPROVED

## 1. Resumen
La 026 amplía la ventana de `POST /api/meals` a [−366, +1] días y añade «Deshacer» sin estado, con un token HMAC ligado al
usuario (ADR-0035). También trae navegación por días con `?date=`, cambio de día a medianoche, «Borrar comida», barras en
ámbar y confirmación al descartar la propuesta de foto. En la iteración 1 quedó abierto F1 (MAYOR): la confirmación de
descarte podía quedar fuera de la vista. El commit `16215b2` lo corrige quitando el transform del diálogo de foto, y solo
cambia `MealPhotoDialog.tsx`. Los tests siguen idénticos al snapshot autorizado. No veo regresiones de maquetación, y
F2 a F7 siguen igual que en la iteración 1, como MENOR/NIT de backlog.

He vuelto a ejecutar `MealPhotoDialog.test.tsx`: 105 passed. La iteración 1 ya cubrió las suites completas de la feature,
y el verify tras F1 da backend 2108 y frontend 1388.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1 a AC-001.4 | Sí | `backend/services/meal_rules.py:13,39-40,200-203`; `test_meal_routes.py::test_post_rejects_dates_outside_the_window`; PATCH y DELETE sin ventana (`test_meal_routes.py:638`) |
| AC-002.1 a AC-002.10 | Sí | `DiaryDateNav.tsx`; `format.ts:646-649`; `DiaryDayView.tsx:31`; `useDiary(date)` con `key={date}`; `DiaryPage.test.tsx:974,992` |
| AC-003.1 a AC-003.4 | Sí | `days.ts::resolveDiaryDate`; `DiaryPage.tsx:25,29` (`replace: true`) |
| AC-004.1 a AC-004.4 | Sí | `date` llega a `MealSection`, a los diálogos y a los hooks, que invalidan `diaryKeys.day(date)` |
| AC-005.1 a AC-005.4 | Sí | `hooks.ts::useToday`; `DiaryPage.tsx:17` |
| AC-006.1 a AC-006.7 | Sí | `MealSection.tsx:72`; `DeleteMealDialog.tsx`; `hooks.ts:79` |
| AC-007.1 a AC-007.11 | Sí | `meal_service.py:207-286`; `hooks.ts::useRemovalUndo`; aviso en `MealSection.tsx:106` |
| AC-008.1 a AC-008.4 | Sí, automático | `NutrientProgress.tsx:23`; el color se revisa a mano (verify-report) |
| AC-009.1 a AC-009.6 | Sí | La lógica está en `MealPhotoDialog.tsx:161-165` y la confirmación en `MealPhotoDialog.tsx:286-295`. F1 está resuelto (detalle abajo). La posición visual queda para la comprobación manual del verify-report. |
| AC-N001.1 a AC-N001.3 | Sí | `aria-label` de la navegación, `Label` «Elegir día», `role="status"` y `AlertDialog` de Radix |
| AC-N002.1 a AC-N002.3 | Sí | `delete_meal` filtra por `user_id`; firma `meal-item-restore:v1:<user_id>:<payload>` con `compare_digest` (`restore_token.py:24-27,44`); `@require_auth` en `/restore`; `test_meal_routes.py:1656,1670,1692`; `test_restore_token.py:80` |

**Comprobación de F1 (`frontend/src/features/diary/components/MealPhotoDialog.tsx:177-180`):**
- **Transform.** `translate-none!` genera `translate: none !important` en el CSS compilado
  (`dist/assets/index-B0QxSWU6.css`). Eso anula `translate-x/y-[-50%]` de la base de `DialogContent`
  (`components/ui/dialog.tsx:61`), que `twMerge` no elimina pero quedan sin efecto. Ya no hay `max-sm:translate-*-0`.
- **Animaciones.** Las de `tw-animate-css` (`zoom-in-95`) aplican `transform` y `filter` solo en el `from` de `@keyframes enter`,
  con `animation-fill-mode: none`. Al terminar los 200 ms de entrada, el contenedor no conserva transform ni filtro. La
  confirmación solo se abre por una acción del usuario, después de la entrada.
- **Bloque contenedor.** Ningún otro ancestro entre `DialogContent` y el portal crea un bloque contenedor para `fixed`: no hay
  `filter`, `backdrop-filter`, `contain` ni `will-change`. El overlay (`fixed inset-0`) y el contenido de la confirmación
  (`fixed top-[50%] left-[50%]`) se miden ahora respecto a la ventana. Como `DialogContent` ya no es su bloque contenedor,
  `overflow-y-auto` no los recorta ni los desplaza.
- **Apilamiento.** `DialogContent` (`fixed z-50`) crea su propio contexto de apilamiento, y la confirmación (`z-50` dentro de
  él) queda por encima del diálogo de foto. Sigue montada dentro de `DialogContent` (`container={contentElement}`), así que se
  conserva la razón de la iteración 1 (Radix no oculta el diálogo padre a las tecnologías de apoyo).
- **Escritorio.** `top-[5vh] right-0 left-0 mx-auto` con `w-full`, `max-w-[calc(100%-2rem)]` y `sm:max-w-lg`. `twMerge` quita
  `top-[50%]` y `left-[50%]`, y el diálogo queda centrado en horizontal y a 5vh del borde superior, con `max-h-[90vh]` y
  scroll interno.
- **Móvil.** `max-sm:top-0`, `h-dvh`, `max-h-none`, `w-full` y `max-w-none` están dentro de la media query, que en el CSS va
  después de `top-[5vh]` y gana. Con `left-0 right-0`, el diálogo ocupa la pantalla completa, sin borde ni radio.

## 3. Cumplimiento del plan
- Siguen las desviaciones aceptadas en la iteración 1: las props `destructive` y `container` de `ConfirmDialog` y
  `AlertDialogContent`, `mutate(..., { onSuccess })` en `DeleteMealDialog`, `formatDiaryDate(isoDate, today?)` y la firma del
  token aunque no se pida `undo=1`.
- La corrección de F1 no aparece en el plan, pero está justificada por el hallazgo y lleva un comentario en el código. El
  cambio visible es que el diálogo de foto en escritorio queda arriba (5vh) y ya no centrado en vertical (NIT F8).

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: `snapshot --check` da `identical: true` en los 12 archivos. `16215b2` no toca ningún test, y la única modificación posterior a `fde125d` es la corrección autorizada (`rework tests` y `snapshot` de 03:45:24).
- [x] B4: todos los AC tienen marcador. Siguen los marcadores laxos de F4 y F5.
- [x] B5: no se borraron, saltaron ni debilitaron tests, y no hay llamadas externas.
- [x] B5.7: ratchet de ruff OK, lint con 0 errores, `tsc -b` y build OK (verify-report, iteración 2).
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: marcadores `026`, fakes a mano y Vitest con la red simulada.
- [x] P2.1 a P2.3: capas respetadas; solo `UnitOfWork` hace commit; errores con las excepciones del proyecto.
- [x] P2.4 y P4: no hay cambios de modelo ni hace falta migración.
- [x] P2.5: reutiliza las utilidades existentes. El firmante nuevo está justificado.
- [x] P2 (frontend): organización por feature, `apiFetch`, TanStack Query y componentes de `components/ui/` sin dependencias nuevas. El parche de F1 solo usa clases de Tailwind.
- [x] P2 (general): textos en español correcto.
- [x] P3.1 a P3.4: autorización por `user_id` del JWT, validación en el servicio, sin IA en `/restore` y sin SQL a mano.
- [x] P5.1: LF en los archivos nuevos.
- [x] P5.2: la ADR-0035 se aceptó de forma explícita en el gate del plan. Queda el NIT F7.
- [x] P5.3: no se tocó `backend/scripts/data/**`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | RESUELTO | `frontend/src/features/diary/components/MealPhotoDialog.tsx:177-180` | El diálogo de foto ya no tiene transform (`translate-none!`) y se coloca con `top`/`left`/`right` y `mx-auto`. Ver §2. Falta la comprobación manual en un navegador (escritorio y móvil, con la lista desplazada hasta abajo), que ya está en el verify-report y en el backlog. | implementer |
| F2 | MENOR | `backend/config.py:47` | `SECRET_KEY` vale `"DEFAULT SECRET"` por defecto y `ProductionConfig` no exige un valor propio. Con la clave por defecto se pueden fabricar `restore_token` para la propia cuenta: `source="catalog"` con valores inventados, fechas fuera de la ventana o `position` arbitraria, y ≥ 2^31 da 500. Propuesta: que `ProductionConfig` falle al arrancar sin una clave propia, como con `FRONTEND_BASE_URL` (ADR-0028). Sin cambios. | planner |
| F3 | MENOR | `backend/services/meal_rules.py:136,157` | `parse_snapshot_payload` acepta `v == 1.0` y no pone tope a `position` (`MAX_DB_INTEGER`). Solo se alcanza con un token firmado. Sin cambios. | implementer |
| F4 | NIT | `frontend/src/features/diary/pages/DiaryPage.test.tsx:154,665`; `backend/tests/test_routes/test_meal_routes.py:1625,1646` | Hay marcadores `AC-002.10` y `AC-007.3` en tests que no prueban ese AC. Sin cambios. | test-author |
| F5 | NIT | `backend/tests/test_services/test_meal_service.py` (`test_remove_item_without_a_signer_returns_none`); `backend/tests/test_routes/test_meal_routes.py:1656` | Marcador `026` con un comentario de guarda de la 022. Sin cambios. | test-author |
| F6 | NIT | `frontend/src/features/diary/components/MealSection.tsx:106` | Hay cuatro regiones `role="status"` vacías, una por sección; se podrían unificar en una por día. Sin cambios. | implementer |
| F7 | NIT | `docs/sdd/decisions/ADR-0035-deshacer-con-token-de-restauracion-firmado.md:4` | «Decidido por» habla del gate de review, pero la ADR se aceptó en el gate del plan. La corrige la sesión principal (P5.2). Sin cambios. | planner |
| F8 | NIT | `frontend/src/features/diary/components/MealPhotoDialog.tsx:180` | En escritorio, el diálogo de foto queda pegado arriba (5vh) también cuando tiene poco contenido (elegir foto, analizando o error), donde antes salía centrado en vertical. Es coherente con el resto de la app y no rompe nada. Si se quiere centrar sin transform, se puede usar un contenedor flex o `inset-0 m-auto h-fit`; el `max-h` y el scroll se mantienen. | implementer |

## 6. Decisión
**APPROVED.** F1 está resuelto: sin transform en el diálogo de foto, la confirmación de descarte y su overlay se colocan
respecto a la ventana y no se desplazan con el scroll del diálogo. No hay regresiones en escritorio (5vh, centrado en
horizontal, `max-h-[90vh]` con scroll) ni en móvil (pantalla completa). No quedan hallazgos BLOQUEANTES ni MAYORES. F2 y
F3 (MENOR) y F4 a F8 (NIT) pasan al backlog con la aprobación del usuario. Antes del gate de `close` queda la comprobación
manual en un navegador de AC-009.1, AC-009.3 y AC-009.4.
