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
