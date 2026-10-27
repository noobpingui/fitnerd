# Review 026 — Diario: navegar entre días, editar días pasados y pulir la edición

- **Iteración:** 1 de 4
- **Diff revisado:** `git diff main...feat/026-diary-days-and-editing` @ `0dfdddf` (+ cambios sin commitear en `specs/026-diary-days-and-editing/`: `backlog.md`, `state.json`, `verify-report.md`)
- **Veredicto:** CHANGES_REQUESTED

## 1. Resumen
La 026 amplía la ventana de `POST /api/meals` a [−366, +1] días, añade «Deshacer» sin estado con un token HMAC ligado al
usuario (ADR-0035), navegación por días con `?date=`, cambio de día a medianoche, «Borrar comida», barras en ámbar y
confirmación al descartar la propuesta de foto. El backend está bien estructurado y el token de restauración es
correcto: está ligado al `user_id` del JWT, caduca, se compara en tiempo constante y no expone datos de otros usuarios.
Los tests no cambiaron desde la corrección autorizada. Queda un problema de maquetación en la confirmación de descarte:
el diálogo se monta dentro de un contenedor transformado y con scroll, y puede quedar fuera de la vista.

He vuelto a ejecutar las suites de la feature: backend 456 passed (`test_restore_token`, `test_meal_rules`,
`test_meal_service`, `test_meal_routes`) y frontend `src/features/diary` 506 passed.

## 2. Cumplimiento de la spec
| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-001.1, AC-001.2 | Sí | `backend/services/meal_rules.py:39-40,200-203`; mensaje en `meal_rules.py:13`; `test_meal_routes.py::test_post_rejects_dates_outside_the_window` |
| AC-001.3 | Sí | `parse_meal_date` se sigue llamando antes de `check_add_window` (orden sin cambios en `add_items`) |
| AC-001.4 | Sí | PATCH y DELETE sin ventana; `test_meal_routes.py:638` |
| AC-002.1 a AC-002.7 | Sí | `DiaryDateNav.tsx` (límites `date <= min` / `date >= today`, «Hoy» solo fuera de hoy, `min`/`max` en el selector); `format.ts:646-649` (año solo si no es el de hoy) |
| AC-002.8 | Sí | `DiaryDayView.tsx:31` |
| AC-002.9 | Sí | `useDiary(date)` con clave `["diary", date]` y sin `placeholderData`; `DiaryDayView` con `key={date}` |
| AC-002.10 | Sí | `DiaryPage.tsx`: cabecera y `DiaryDateNav` fuera del condicional; tests `DiaryPage.test.tsx:974,992` |
| AC-003.1 a AC-003.4 | Sí | `days.ts::resolveDiaryDate`; `DiaryPage.tsx:25,29` (`replace: true`) |
| AC-004.1 a AC-004.4 | Sí | `date` se propaga a `MealSection`, a los diálogos y a los hooks, que invalidan `diaryKeys.day(date)` |
| AC-005.1 a AC-005.3 | Sí | `hooks.ts::useToday` (intervalo de 30 s y `visibilitychange`) |
| AC-005.4 | Sí | `DiaryPage.tsx:17` (`useToday(openDialogs.size > 0)`); `MealSection` informa de los diálogos abiertos |
| AC-006.1 a AC-006.7 | Sí | `MealSection.tsx:72`; `DeleteMealDialog.tsx`; `ConfirmDialog` (botón deshabilitado con `isPending`); `hooks.ts:79` (un 404 cuenta como éxito) |
| AC-007.1, AC-007.2 | Sí | `meal_service.py:207-235` (el alimento se quita de verdad y después se firma); aviso en `MealSection.tsx:106` |
| AC-007.3 a AC-007.5 | Sí | `meal_service.py:237-286` (posición por índice; valores por 100 g del token; la comida se recrea con `created=True`) |
| AC-007.6 a AC-007.11 | Sí | `hooks.ts::useRemovalUndo` (temporizador, sustitución, `inFlightRef`, error ligado al token del aviso) |
| AC-008.1 a AC-008.4 | Sí, automático | `NutrientProgress.tsx:23`; el color real queda para la revisión manual (verify-report §3) |
| AC-009.1 a AC-009.6 | Parcial | La lógica es correcta (`MealPhotoDialog.tsx:161`), pero en el navegador la confirmación puede quedar fuera de la vista (F1) |
| AC-N001.1 a AC-N001.3 | Sí | `aria-label` de la navegación, `Label` «Elegir día», `role="status"` y `AlertDialog` de Radix |
| AC-N002.1 | Sí | `delete_meal` filtra por `user_id` (sin cambios de la 022); `test_meal_routes.py:1656` |
| AC-N002.2 | Sí | Firma `meal-item-restore:v1:<user_id>:<payload>` (`restore_token.py:24-27`), `compare_digest` (`restore_token.py:44`), comida buscada por el `user_id` del JWT (`meal_service.py`); `test_meal_routes.py:1670`, `test_restore_token.py:80` |
| AC-N002.3 | Sí | `@require_auth` en `/restore`; `test_meal_routes.py:1692` (5 × 401 y nada cambia) |

**Token de restauración (ADR-0035), comprobado a fondo:**
- Está ligado al usuario: el `user_id` entra en el mensaje del HMAC y se recalcula con el del JWT. Con el token de otro usuario, la respuesta es 404 sin tocar nada.
- Caduca: `exp = epoch_seconds(clock) + 120` y se comprueba con el reloj de la app antes de bloquear y escribir (`meal_service.py:243`). Hay test de servicio con `FakeClock.advance(seconds=121)`.
- Formato: comprueba el tipo, la longitud máxima (4096), que tenga exactamente un punto y las dos partes no vacías, compara la firma con `hmac.compare_digest` y solo después decodifica el payload. Las excepciones se capturan como `ValueError`/`binascii.Error`, que cubren `JSONDecodeError`, `UnicodeDecodeError` y `UnicodeEncodeError`.
- Separación de dominio: el prefijo es distinto del `feedback_id` y hay tests cruzados en los dos sentidos (`test_restore_token.py:144,152`).
- Aislamiento de datos: el token solo lleva datos del propio usuario, la restauración nunca escribe en comidas de otro y no hay forma de averiguar si existe una comida ajena.
- Riesgos que la ADR acepta: el mismo token se puede reutilizar dentro de los 120 s (está en el backlog) y la restauración no aplica la ventana de fechas.

## 3. Cumplimiento del plan
- `ConfirmDialog` añade las props `destructive` y `container`, y `AlertDialogContent` acepta `container`. El plan no las incluye. `destructive` está justificada (el botón «Borrar» es destructivo y «Descartar» no). `container` es el origen de F1.
- `DeleteMealDialog` usa `mutate(..., { onSuccess })` en lugar de `mutateAsync`. El efecto es el mismo y es aceptable.
- `formatDiaryDate(isoDate, today?)` mantiene la implementación de la 022. La desviación ya se aceptó en el red check.
- La ruta `DELETE …/items/{id}` firma el token aunque no se pida `undo=1` (`meal_routes.py:146-147`). Es un coste despreciable y no expone nada.
- Por lo demás, firmas, capas, inyección de `RestoreTokenSigner` desde `_build_meal_service()` y la ausencia de migración coinciden con el plan.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: los roles se respetaron. `snapshot --check` da `identical: true` (12 archivos). `git diff 0b17e2a HEAD` no toca ningún test. La única modificación posterior a `fde125d` es la corrección autorizada (`rework tests` y el `snapshot` de 03:45:24). Esa corrección solo da formato ruff a dos aserciones, reordena un import y añade dos esperas (`findByText`) en DiaryPage, sin debilitar nada.
- [x] B4: todos los AC tienen marcador. Algunos marcadores son laxos (F4).
- [x] B5: no se borraron, saltaron ni debilitaron tests, y no hay llamadas externas. Los esqueletos se sustituyeron por la implementación. Los tests de la 022 y la 025 sustituidos se actualizaron como pedía el plan.
- [x] B5.7: el ratchet de ruff está OK, oxlint da 0 errores y `tsc -b` está OK (verify-report).
- [x] B6.5: no hay secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1: marcadores con `026`, fakes a mano por constructor, sin `unittest.mock` ni `monkeypatch`, Vitest con imports explícitos y la red simulada en `api.ts`/`apiClient`.
- [x] P2.1 a P2.3 (backend): la ruta solo parsea y serializa, el servicio contiene la lógica, solo `UnitOfWork` hace commit o rollback y los errores salen como `ValidationError` o `ResourceNotFoundError`.
- [x] P2.4 y P4: no hay cambios de modelo, así que no hace falta migración (comprobado: el diff no toca `models/` ni `migrations/`).
- [x] P2.5: reutiliza `require_json_object`, `_lock_user`, `_new_item`, `portion_nutrients`, `_serialize_meal` y el reloj. El firmante nuevo está justificado frente a `FeedbackTokenSigner`, y su generalización está en el backlog.
- [x] P2 (frontend): organización por feature, HTTP solo por `apiFetch`, TanStack Query con claves en `hooks.ts` y `alert-dialog.tsx` en `components/ui/` sobre `radix-ui`, ya instalado (`package.json` no cambia).
- [x] P2 (general): textos en español correcto, con tildes y sin voseo.
- [x] P3.1: `/restore` lleva `@require_auth` y filtra por el `user_id` del JWT.
- [x] P3.2: el token y el cuerpo se validan en el servicio (`require_json_object` y `parse_snapshot_payload`). Las fechas del frontend se validan con `isIsoDate` y el intervalo. No hay formularios nuevos.
- [x] P3.3: no aplica, porque `/restore` no llama a IA.
- [x] P3.4: sin SQL a mano.
- [x] P5.1: los archivos nuevos están en LF (`git ls-files --eol`).
- [x] P5.2: la ADR-0035 entró como «Aceptada» en el commit del plan. El usuario la aceptó de forma explícita en el gate del plan («Aprobado, acepto la ADR»), así que se cumple el espíritu del artículo. La línea «Decidido por» sigue hablando del gate de review (NIT F7).
- [x] P5.3: no se tocó ningún archivo de `backend/scripts/data/**`.

## 5. Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| F1 | MAYOR | `frontend/src/features/diary/components/MealPhotoDialog.tsx:175,291`; `frontend/src/components/ui/alert-dialog.tsx:36-55` | La confirmación «¿Descartar la propuesta?» se monta (`container={contentElement}`) dentro de `DialogContent`. Ese contenedor tiene `translate-x/y-[-50%]` en escritorio, `translate-*-0` en móvil (en Tailwind v4 sigue siendo un `translate` distinto de `none`) y animaciones `zoom`, además de `overflow-y-auto`. Un ancestro transformado se convierte en el bloque contenedor de los `position: fixed`, así que el overlay (`fixed inset-0`) y el contenido (`fixed top-[50%] left-[50%]`) se colocan respecto al contenedor con scroll y se desplazan con su contenido. Radix enfoca con `focus({ preventScroll: true })` (`@radix-ui/react-focus-scope`), así que no hace scroll hasta la confirmación. Reproducción: en móvil (`h-dvh`) o en escritorio con una propuesta lo bastante larga para hacer scroll, ir hasta el final y pulsar «Cancelar» (`PhotoReview.tsx:152`). La confirmación y su overlay quedan arriba, fuera de la vista, y la interacción con el diálogo de foto queda bloqueada sin pista visible (solo Escape la saca). jsdom no lo detecta. El propio implementer lo anotó en el backlog. Corrección esperada: montar la confirmación en el `body` (portal por defecto) y comprobar que Escape y el clic fuera solo cierran la capa de arriba (AC-009.3 y AC-009.4), o bien mantener el contenedor pero sin un ancestro transformado o con scroll. En los dos casos, verificar en un navegador real (escritorio y móvil) con la lista desplazada hasta abajo. | implementer |
| F2 | MENOR | `backend/config.py:47` | `SECRET_KEY` tiene el valor por defecto `"DEFAULT SECRET"` y `ProductionConfig` no exige uno propio. Viene de antes, pero la 026 amplía su uso: con la clave por defecto, cualquiera puede fabricar `restore_token` válidos para su propia cuenta. Eso le permite insertar alimentos con `source="catalog"` y valores inventados, fechas fuera de la ventana de `POST /api/meals` o `position` arbitraria; una `position` ≥ 2^31 daría 500. El impacto se limita a su propio diario (lo dice la ADR-0035). Propuesta para el backlog: que `ProductionConfig` falle al arrancar sin `SECRET_KEY` propia, como ya se hace con `FRONTEND_BASE_URL` (ADR-0028). | planner |
| F3 | MENOR | `backend/services/meal_rules.py:136,157` | `parse_snapshot_payload` acepta `v == 1.0` (solo excluye `True`) y no pone tope a `position`, cuando `MAX_DB_INTEGER` ya existe. Solo es alcanzable con un token firmado (ver F2). Sugerencia: `is_int(v) and v == 1` y `position <= MAX_DB_INTEGER`. | implementer |
| F4 | NIT | `frontend/src/features/diary/pages/DiaryPage.test.tsx:154,665`; `backend/tests/test_routes/test_meal_routes.py:1625,1646` | Hay marcadores que no prueban el AC que citan. Los dos tests de la 022 y la 025 marcados con `AC-002.10` comprueban el título y las secciones con datos, no la navegación durante la carga o el error (que sí cubren los tests de las líneas 974 y 992). Los tests de token inválido o ausente y de cuerpo que no es objeto llevan `AC-007.3`, cuando prueban robustez o `AC-N002.2`. Hay que alinearlos cuando se toquen esos archivos, con autorización. | test-author |
| F5 | NIT | `backend/tests/test_services/test_meal_service.py` (`test_remove_item_without_a_signer_returns_none`); `backend/tests/test_routes/test_meal_routes.py:1656` | Marcador `026` con un comentario de guarda de la 022. Ya está en el backlog de verify. | test-author |
| F6 | NIT | `frontend/src/features/diary/components/MealSection.tsx:106` | Hay cuatro regiones `role="status"` vacías siempre presentes, una por sección. Funciona y cumple AC-N001.2. Unificarlas en una sola región del día reduciría el ruido de los lectores de pantalla. Ya está en el backlog del implementer. | implementer |
| F7 | NIT | `docs/sdd/decisions/ADR-0035-deshacer-con-token-de-restauracion-firmado.md:4` | «Decidido por» dice que el usuario la acepta «en el gate de review», pero la aceptó en el gate del plan. Lo corrige la sesión principal (P5.2). | planner |

## 6. Decisión
**CHANGES_REQUESTED.** F1 (MAYOR) se devuelve al implementer: la confirmación de descarte puede quedar invisible cuando el
diálogo de foto tiene scroll, que es justo el caso habitual en móvil con una propuesta de varios alimentos. Tras
corregirlo, hay que comprobarlo a mano en un navegador. F2 y F3 (MENOR) y F4 a F7 (NIT) pueden pasar al backlog con la
aprobación del usuario. El resto de la feature, y en particular la seguridad del token de restauración y la integridad
de los tests, es correcto.
