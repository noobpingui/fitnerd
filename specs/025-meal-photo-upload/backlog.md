# Backlog · 025-meal-photo-upload

## spec · spec-writer
- [ ] AC-001.3 (pantalla completa a 375 px) y AC-004.3 (orientación EXIF) pueden ser difíciles de comprobar en jsdom. Conviene que el plan defina cómo probarlos o prever una revisión manual en el gate de review.
- [ ] Prueba manual en un iPhone real (HEIC y cámara) y en Chrome Android en el gate de review.
- [ ] Mostrar cuántos análisis quedan en la hora.
- [ ] Confirmar antes de descartar una propuesta, si el usuario lo pide más adelante.
- [ ] Cerrar en el backlog del proyecto los puntos de la 022 («añadir varios de una vez») y de la 024 (privacidad, HEIC y EXIF) al cerrar esta feature.

## plan · planner
- [ ] Abortar la petición de análisis al cerrar el diálogo (con `AbortController` en `apiFetch`).
- [ ] Ofrecer «Crear alimento personalizado» también desde la búsqueda de «Añadir otro alimento».
- [ ] Volver a codificar con menos calidad si el JPEG supera los 3 MB, en lugar de mostrar el error (muy improbable a 1600 px).
- [ ] Extraer un componente de búsqueda del catálogo compartido entre `AddFoodDialog` y `ProposalSearchStep` para quitar la duplicación de JSX.

## tasks · task-breaker
- [ ] El orquestador debe quitar `backend` de los ámbitos en `state.json` con `sdd-state` (el plan ya lo indica).
- [ ] AC-004.3 (orientación EXIF), AC-004.4 (HEIC) y AC-001.3 (pantalla completa a 375 px) solo se prueban en jsdom con el doble `FakePhotoProcessor`. Necesitan comprobación manual en un navegador real durante verify o review, y `npm run build` debe confirmar el chunk de entrada ≤ 500 kB (NFR-003).
- [ ] Cerrar el diálogo durante el análisis no aborta la petición, que ya cuenta para el límite de 10 por hora (ya anotado en el plan).

## tests · test-author
- [ ] Orientación EXIF, HEIC real en Safari/Chrome, pantalla completa a 375 px y chunk de entrada ≤ 500 kB (`npm run build`) quedan para `verify` y `review`, a mano, como dice el plan.
- [ ] Cerrar el diálogo durante el análisis no aborta la petición (el plan lo deja en backlog). El test AC-005.2 solo comprueba que el resultado se descarta.
- [ ] `state.json` sigue listando `backend` en los ámbitos y debe corregirlo el orquestador.

## tests (red) · verifier
- [ ] Quitar `backend` de `scope` en `state.json` (Q8): la CLI no lo permite; hay que decidirlo al cerrar.
- [ ] Decidir si F4 y F5 son guardas de regresión declaradas; si lo son, el test-author las marca así y el modo red puede pasar.
- [ ] Comprobación manual de los AC de navegador (AC-001.3, AC-002.1, AC-003.3, AC-004.3, AC-004.4) en verify o review.

## tests (red, iteración 2) · verifier
- [ ] Ámbito backend en state.json.scope sin archivos tocados: en full, o se ejecuta su suite o se corrige el alcance con la CLI.
- [ ] Contadores inconsistentes: tasks.md dice «58+7 AC» y spec.md tiene 61 AC reales.

## tests (iteración 3) · test-author
- [ ] Que el verify confirme que AC-004.1 queda cubierto por los tests de FormData restantes de `apiClient.test.ts`.

## tests (red PASS, iteración 3) · verifier
- [ ] `state.json.scope` sigue listando `backend` (Q8 lo quita en la spec, pero `sdd-state` no permite quitarlo). Revisar en verify.
- [ ] PrivacyPolicyPage.test.tsx sustituye un test existente de la 023 (AC-012.3, fecha del 21 de octubre) por el del 22 de octubre; es lo que exige AC-014.3, anotado para la revisión.

## implement · implementer
- [ ] Cerrar el diálogo con el análisis pendiente no aborta la petición, pero el análisis ya cuenta para el límite de 10 por hora (ya anotado en el plan).
- [ ] Comprobación manual en un navegador real: orientación EXIF (AC-004.3), HEIC en Safari y Chrome (AC-003.3 y AC-004.4), y pantalla completa a 375 px (AC-001.3).
- [ ] `ProposalSearchStep` no ofrece «Crear alimento personalizado», porque REQ-009 no lo pide.
- [ ] `state.json` aún lista `backend` en `scope`. Lo corrige el orquestador con `sdd-state`.
- [ ] Warning de lint nuevo `react(incompatible-library)` por `form.watch` en `PhotoReview.tsx` (se usa `form.watch` porque `useWatch` devolvía valores obsoletos tras `update()`).

## implement (confirmación) · implementer
- [ ] El aviso de oxlint `react(incompatible-library)` en PhotoReview.tsx:57 viene de usar `watch` de react-hook-form. Se puede cambiar por `useWatch` más adelante.

## verify · verifier
- [ ] Corregir state.json.scope para quitar backend cuando la CLI lo permita (Q8).
- [ ] Warning de React Compiler (incompatible-library) en PhotoReview.tsx:57; revisar en review si conviene silenciarlo o cambiar la API usada.
- [ ] Cuatro tests (errors, schemas, DiaryPage, PrivacyPolicyPage) tienen CRLF en el disco y LF en el repo; el verifier reporta que el hash de tests_snapshot no coincide por ese motivo. Normalizar finales de línea antes de cerrar (el `snapshot --check` del orquestador dio idéntico).
- [ ] node_modules/ sin seguimiento en git status: añadirlo a .gitignore o ignorarlo al hacer commit.

## review · reviewer
- [ ] F1 (MENOR): comprobar que el diálogo sigue montado (o usar `AbortController`) después de cada `await` en `MealPhotoDialog`, antes de llamar a `analyze.mutate` y a `createPreviewUrl`. Si se cierra mientras se prepara el JPEG, la foto se envía igualmente a Bedrock y gasta un análisis; si se cierra mientras se comprueba si se puede leer, la URL de la vista previa no se libera (`MealPhotoDialog.tsx:87-118`).
- [ ] F2 (MENOR): usar `canChangePhoto` para mostrar «Cambiar foto» o quitar el campo de `AnalysisErrorView`; hoy aparece también con los errores 429 y 503.
- [ ] F3 (NIT): ocultar «Analizar foto» cuando aparece el error de 3 MB.
- [ ] F4 (NIT): dejar fija la región `role="status"` de «Analizando la foto…», como hace `ProposalSearchStep`.
- [ ] F5 (NIT): decodificar la foto una sola vez y rellenar el fondo del canvas para los PNG con transparencia.
- [ ] Comprobación manual en navegador real de AC-001.3, AC-002.1, AC-003.3, AC-004.3 y AC-004.4 (iPhone real y Chrome Android).
- [ ] ADR-0033 sigue en estado «Propuesta»: confirmarlo (Aceptada) en el gate.
- [ ] Commits: la implementación está en `207687a` y no en `fcf9f0a`; tenerlo en cuenta en el historial del PR.

## review (2.ª) · reviewer
- [ ] N1 (NIT, implementer): MealPhotoDialog.tsx:83-104. Si el usuario elige dos fotos seguidas mientras se comprueba la primera, la URL blob: de la primera vista previa no se libera nunca. Se corrige con un contador de selección.
- [ ] N2 (NIT, test-author): en el test «… la URL de vista previa no queda sin liberar», el bucle de aserciones queda vacío una vez aplicada la corrección. Añadir expect.hasAssertions() o una aserción explícita sobre processor.created.
- [ ] N3 (NIT, implementer): photo.ts:65-76. La caché WeakMap mantiene la imagen decodificada en memoria mientras el File siga vivo (unos 48 MB en una foto de 12 MP). Valorar liberar la entrada después de toJpeg.
- [ ] Comprobación manual en navegador real, además de los 5 AC: el fondo blanco de un PNG con transparencia (F5).

## tests (N1-N3) · test-author
- [ ] N3 (liberar la caché de decodificación tras `toJpeg`) queda sin test automático: revisar a mano en un navegador.

## verify (N1-N3) · verifier
- [ ] Vigilar el timeout de 5 s en router.test.tsx y lazyRoutes.test.tsx (ruta /body-metrics) si vuelve a fallar con la suite completa; posible subida de testTimeout para esos archivos. En la primera ejecución fallaron 2 por timeout; pasaron solos y en la repetición.

## review (3.ª) · reviewer
- [ ] R1 (NIT, test-author): el test de N1 (MealPhotoDialog.test.tsx:1561-1562) no afirma que se cree una sola URL ni que la vista previa final sea la de la segunda foto.
- [ ] Comprobar en un navegador real, además de los AC manuales y el PNG con transparencia: que analizar dos veces la misma foto funciona tras liberar la caché (N3).

## docs · doc-keeper
- [ ] docs/backlog.md: marcar como hechos «Actualizar la Política de privacidad (las fotos van a Amazon Web Services) en la 025», «Admitir HEIC si la 025 no lo convierte en el cliente» y «guardar varios alimentos de una vez» (lo hace el orquestador en close). El paso 7 del caso 024 del runbook (revisión manual de precisión con fotos reales) sigue pendiente.
