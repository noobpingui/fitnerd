# Review 025 — Registro de una comida con foto desde el diario

- **Iteración:** 3 de 4
- **Diff revisado:** `git diff main...feat/025-meal-photo-upload` @ `356157f`, con foco en `git diff 3e4a4a0 356157f` (test de `d83a5d9` y correcciones de `356157f`). Sin commitear: solo `backlog.md`, `state.json`, `verify-report.md` y este `review.md` de la feature; `node_modules/` sin seguimiento no forma parte del cambio.
- **Veredicto:** APPROVED

## 1. Resumen
Tercera review, tras corregir N1, N2 y N3 de la segunda a petición del usuario. Las tres correcciones están hechas
y coinciden con lo que se pedía. N1: un contador de selección (`pickCounterRef`) hace que solo la última foto elegida
cree la URL de vista previa. N2: el test del cierre durante la comprobación ya afirma algo aunque no se cree ninguna
URL. N3: la caché de decodificación se libera en `toJpeg`. El test nuevo de `d83a5d9` es legítimo y el refuerzo de N2
no debilita nada. `snapshot --check` da idéntico y la implementación (`356157f`) no toca tests. No hay regresiones: los
360 tests de `src/features/diary` pasan, `tsc -b` está limpio y oxlint no da errores, con el mismo warning ya admitido.
Queda un NIT nuevo que no bloquea.

## 2. Cumplimiento de la spec
Lo aprobado en las iteraciones 1 y 2 sigue vigente: esta iteración solo toca `MealPhotoDialog.tsx`, `photo.ts` y
`MealPhotoDialog.test.tsx`. Estos son los AC afectados.

| REQ / AC | ¿Implementado como se especificó? | Evidencia (archivo:línea o test) |
|---|---|---|
| AC-N001.2 (dos selecciones durante la comprobación) | Sí | `MealPhotoDialog.tsx:55` (`pickCounterRef`), `:86` (id de la selección), `:95` y `:101`: una selección superada no crea URL ni muestra error. Test «si se eligen dos fotos seguidas mientras se comprueba la primera, la URL de vista previa de la primera se libera» |
| AC-N001.2 (cierre durante la comprobación) | Sí, sin regresión | `MealPhotoDialog.tsx:101` conserva la guarda de `mountedRef`; test «… la URL de vista previa no queda sin liberar», ahora con `expect.hasAssertions()` y `revoked.length === created.length` |
| REQ-003 / AC-012.x (foto no legible o no válida tras otra selección) | Sí, sin regresión | `MealPhotoDialog.tsx:87-90`: una segunda foto no válida incrementa el contador antes de volver, así que la comprobación pendiente de la primera ya no pisa el error ni crea la vista previa |
| AC-004.1 a AC-004.4 | Sí, sin regresión | `photo.ts:97-100`: `toJpeg` usa la imagen decodificada y borra la entrada del `WeakMap`. Volver a pulsar «Analizar foto» decodifica otra vez; «Reintentar» reutiliza el JPEG ya preparado (`MealPhotoDialog.tsx:132-134`) y no decodifica |

## 3. Cumplimiento del plan
- Las correcciones no se apartan del plan ni del ADR-0033: no hay dependencias nuevas y el contrato de `PhotoProcessor`
  no cambia.
- El orden de commits es correcto: test en rojo (`d83a5d9`; el red check confirmó que fallaba por aserción con
  `blob:preview-1` sin liberar) y después la implementación (`356157f`). `git diff d83a5d9 356157f --stat` solo muestra
  `MealPhotoDialog.tsx`, `photo.ts` y `state.json`.

## 4. Checklist de la constitución
### Parte I (base)
- [x] B2: cada agente se mantuvo en su rol. `snapshot --check` da idéntico (snapshot de `19:24:06`, con `rework tests`
  del usuario «Arreglemos N1,N2 y N3 de una vez» en `history` a las `19:20:37`). Entre `3e4a4a0` y `d83a5d9` el único
  test modificado es `MealPhotoDialog.test.tsx`, con 21 líneas añadidas y ninguna borrada. Entre `d83a5d9` y `HEAD` no
  cambia ningún test.
- [x] B4: el marcador `// SDD: 025 NFR-001 AC-N001.2` del test nuevo coincide con lo que prueba.
- [x] B5: ningún test borrado, saltado ni debilitado. N2 solo añade aserciones (`expect.hasAssertions()` y la igualdad
  de longitudes) y conserva el bucle original. El test de N1 falla sin el contador: las dos selecciones crean URL y la
  primera no se revoca nunca.
- [x] B5.7: oxlint sin errores; sigue el warning admitido en `PhotoReview.tsx:57`. `tsc -b` sin errores.
- [x] B6.5: sin secretos ni variables nuevas.

### Parte II (proyecto)
- [x] P1 frontend: el test nuevo está junto al archivo, en español, con `vitest` y el navegador simulado
  (`GatedPhotoProcessor`).
- [x] P1.1: marcador con el número de spec (`SDD: 025`).
- [x] P2.1 a P2.5: los cambios se quedan en `src/features/diary/`, sin dependencias nuevas ni llamadas HTTP.
- [x] P2 General: no hay textos visibles nuevos.
- [x] P3, P4: no aplican (sin backend, endpoints, migraciones ni variables).

## 5. Hallazgos
Estado de los hallazgos de la iteración 2:

| # | Estado | Evidencia |
|---|---|---|
| N1 | Resuelto | `MealPhotoDialog.tsx:55, 86, 95, 101` y el test «si se eligen dos fotos seguidas…» |
| N2 | Resuelto | `MealPhotoDialog.test.tsx:1541-1543` (`expect.hasAssertions()` y `revoked.length === created.length`) |
| N3 | Resuelto (sin test, depende de la memoria del navegador, como acordó el usuario) | `photo.ts:99-100` |

Hallazgos nuevos:

| # | Severidad | Archivo:línea | Hallazgo | Responsable |
|---|---|---|---|---|
| R1 | NIT | `frontend/src/features/diary/components/MealPhotoDialog.test.tsx:1561-1562` | El test de N1 afirma `created.length > 0` y que todas las URL creadas se revocan al desmontar. Pero no comprueba que solo se cree una URL ni que la vista previa final sea la de la segunda foto («la última selección gana»). Una implementación que creara y revocara también la URL de la primera pasaría igual. No es un fallo, porque NFR-001 solo exige liberar las URL. Afirmar `created.length === 1`, o que la vista previa visible usa la URL de `segunda.jpg`, lo haría más preciso. | test-author |

Sin hallazgos BLOQUEANTES ni MAYORES.

## 6. Decisión
**APPROVED.** N1 a N3 están resueltos sin regresiones. El test nuevo de N1 es legítimo, y el refuerzo de N2 añade
aserciones sin quitar ninguna. Los tests no cambiaron tras la etapa `tests` (snapshot idéntico, y cada corrección de
tests está autorizada en `history`). Se cumplen la constitución base y la del proyecto. R1 es NIT y puede pasar al
backlog. Antes de cerrar siguen pendientes:
- las comprobaciones manuales en un navegador real: AC-001.3, AC-002.1, AC-003.3, AC-004.3 y AC-004.4, el fondo blanco
  de un PNG con transparencia y, ahora, que analizar dos veces la misma foto sigue funcionando tras liberar la caché;
- aceptar el ADR-0033, que sigue en estado «Propuesta».

## Comentarios del usuario

## Comentarios del usuario

Indicación del usuario (literal): «Vamos a resolver F1 a F5»

Cómo se aplica: F1 a F5 son los hallazgos MENOR y NIT de esta review, todos del implementer. Se corrigen ahora, con tests nuevos que fallen primero para el comportamiento que se pueda probar en jsdom (F1 a F4); F5 (decodificar una vez y fondo del canvas en PNG con transparencia) depende del navegador y no se prueba en jsdom. Los tests existentes no se debilitan.

Indicación del usuario (literal, 2.ª review): «Arreglemos N1,N2 y N3 de una vez»

Cómo se aplica: N1 (contador de selección para liberar la URL de la primera vista previa) lleva un test nuevo que debe fallar primero; N2 es una mejora de un test existente que hoy no afirma nada (se refuerza sin debilitarlo); N3 (liberar la caché de decodificación tras `toJpeg`) depende de la memoria del navegador y no se prueba en jsdom.
