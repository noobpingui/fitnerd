
## spec-writer · backlog
- [ ] Si algún chunk de pantalla (por ejemplo Métricas, con las gráficas) sigue pasando de 500 kB, partirlo más.

## plan · planner
- [ ] Si el chunk propio de Métricas (recharts) supera 500 kB, partirlo (fuera de alcance según la spec).
- [ ] Distinguir en el boundary un error de render de un fallo de descarga, si hiciera falta.
- [ ] Comentarios sin tilde y con voseo en router.tsx, router.test.tsx, AppLayout.tsx, ProtectedRoute.tsx y setup.ts (fuera de alcance; solo se corrigen los que se toquen).
- [ ] Valorar LazyMotion de motion si el chunk de entrada vuelve a crecer.

## tasks · task-breaker
- [ ] Si el chunk de entrada sigue por encima de 500 kB tras T-039, el implementer no debe tocar `vite.config.ts`. Debe informar del desglose y el orquestador lo escala (riesgo recogido en el plan).
- [ ] Anotar en el backlog, si hace falta, la separación del mensaje del error boundary entre fallo de descarga y error de render.

## tests · test-author
- [ ] Cuando se implemente el lazy loading, conviene repasar si `router.test.tsx` y `accountSwitch.test.tsx` necesitan algún ajuste. El `asyncUtilTimeout` de 3 s ya está en `setup.ts`.

## tests · verifier (red)
- [ ] Si se mantienen como guardas de regresión, los tests de lazyRoutes y de AC-N005.1 no prueban la carga diferida; conviene añadir una comprobación de que el chunk no se carga antes de navegar.
- [ ] Los tests de NFR-003 y NFR-004 dependen de cambios de texto en los propios archivos de test; no son verificables como rojo y conviene anotarlo en el backlog de la feature.

## tests · test-author (iteración 2)
- [ ] Añadir AC-001.4 a la lista de guardas de regresión de plan.md sección 5 ("Rojo esperado").
- [ ] Si la implementación cambia el orden de los tests de lazyRoutes.test.tsx, el test de "Cargando…" debe seguir siendo el primero (cache de React.lazy).

## tests · verifier (red, iteración 3)
- [ ] Añadir AC-001.5 (caso «pies no válidos manda Entre 3 y 8 ft») y AC-N002.4 (configuración de lint) a plan.md, sección 5, «Pasan ya en verde», para que el registro coincida con la aceptación del usuario.
- [ ] Los tests de AC-002.2 a AC-002.4 (lazyRoutes) siguen verdes antes de la carga diferida y no prueban que el chunk no se descargue hasta navegar: añadir esa comprobación en verify o en tests.
- [ ] En verify (full): medir el chunk de entrada con `npm run build` (AC-N005.1), comprobar lint sin only-export-components (AC-N002.1) y revisar a mano AC-002.1 y AC-003.1 si el usuario lo pide.

## implement · implementer
- [ ] El error boundary muestra «No se pudo cargar la página.» también ante un error de render real de una pantalla (riesgo ya anotado en el plan). Valorar distinguir los mensajes más adelante.
- [ ] Falta la revisión manual de la transición login a registro en `npm run dev`, que pide el plan antes de la review.

## verify · verifier (full)
- [ ] Plan.md sección 5 no lista AC-001.5 y AC-N002.4 como verdes justificados (aceptados por el usuario en red); conviene añadirlos al registro.
- [ ] Chunk de Métricas (BodyMetricsPage) de 364 kB: por debajo de 500 kB, no bloquea (Q6).
- [ ] Prueba manual pendiente: recarga real con «Recargar» tras un fallo de descarga de chunk (AC-003.2).

## verify · verifier (full, iteración 2)
- [ ] ResetPasswordForm.test.tsx (fuera del alcance de la 017, que solo cubre LoginForm y ForgotPasswordForm) tiene «boton», «peticion» y «esta en curso» en comentarios o nombres de test (Art. P2 General).
- [ ] El marcador de AC-N004.3 está en un test de escaneo que comprueba el contenido de OnboardingPage.test.tsx; el AC queda cubierto en la práctica por la ejecución completa de npm test, no por un test que ejecute ese archivo.

## review · reviewer
- [ ] F1 (test-author): en `LoginForm.test.tsx:6` y `:133` quedan «todavia» y «COMO se llamó» sin tilde (NFR-003).
- [ ] F2 (test-author): el escaneo de AC-N002.3 en `sourceCleanup017.test.ts:122-134` no incluye el test del formulario de feedback.
- [ ] F5 (implementer/usuario): falta la prueba manual de la transición login ↔ registro en `npm run dev` y la de «Recargar» tras un fallo real de descarga de un chunk (AC-003.2).
- [ ] F3 (implementer): unificar la indentación de los `element={…}` en `router.tsx:104-165`.
- [ ] F4 (test-author): el marcador de AC-N004.3 está en un test que solo comprueba el texto del archivo; lo cubre de verdad la suite.
- [ ] F6 (implementer): «Cargando…» y el aviso de error usan `min-h-dvh` dentro de `AppLayout`, y la primera visita a una ruta protegida encadena hasta tres «Cargando…» (guard, layout y pantalla); valorar pasar `className` o precargar el layout.
- [ ] F7 (planner): pasar el ADR-0026 de «Propuesta» a «Aceptada», en el ADR y en `docs/sdd/decisions/README.md`, cuando se apruebe el gate.
- [ ] La sección 5 de `plan.md` no lista AC-001.5 ni AC-N002.4 entre los tests que pasan ya en verde, aunque el usuario los aceptó como guardas en el red check.

## tests · test-author (correcciones de review)
- [ ] Si se quiere cubrir de verdad AC-N002.3 para feedback, hay que escribir un test de comportamiento de `FeedbackForm` (hoy no existe).
