# Spec 017 — Pulido de frontend: mensaje de pulgadas, inRange compartido, warnings de lint y tests

- **Feature:** `017-frontend-polish` · **Tipo:** feature
- **Ámbitos:** frontend

## 1. Contexto y problema

Las specs 014, 015 y 016 dejaron en el backlog del proyecto (`docs/backlog.md`) varios puntos menores del frontend.
Esta feature recoge un subconjunto acotado, solo de frontend, sin migraciones ni cambios de API:

1. **Mensaje de pulgadas en el perfil.** Hoy, en «Datos físicos» con la unidad ft / in, cualquier altura no válida
   muestra «Entre 3 y 8 ft», también cuando los pies son correctos y lo que falla son las pulgadas (p. ej. 5 ft 12 in
   o 5 ft 2.5 in). El usuario no sabe qué campo corregir.
2. **Regla de rango compartida.** La comprobación de rango numérico (`inRange`) vive en el esquema del onboarding,
   que la documenta como regla del onboarding, pero también la usan el perfil y las métricas corporales.
3. **Warnings de lint previos.** `npm run lint` avisa de `only-export-components` en `components/ui/form.tsx` y
   `components/ui/button.tsx`, componentes generados por shadcn.
4. **Textos sin tilde en tests.** Los comentarios y nombres de los tests de `LoginForm` y `ForgotPasswordForm` tienen
   palabras sin tilde («validacion», «exito», «peticion»…) y algún regionalismo («aca»), en contra del Art. P2
   (General).
5. **Tests duplicados de fecha en el onboarding.** `OnboardingPage.test.tsx` comprueba dos veces la fecha
   prerrellenada válida (1995-05-20) y la de más de 100 años (1900-01-01): una con el marcador de la spec 006 y otra
   con el de la 015.
6. **Tamaño del paquete inicial.** El build genera un único chunk de unos 1 087 kB, por encima del aviso
   de 500 kB de Vite: quien abre la app descarga el código de todas las pantallas aunque solo vaya al login.

El punto 1 cambia parcialmente lo que fijaban los AC-003.4 y AC-003.5 de la spec 015 para el perfil (los casos de
pies válidos con pulgadas no válidas) y, por tanto, las expectativas de los tests existentes de esos casos.

## 2. Historia de usuario

Como **usuario que edita sus datos físicos en pies y pulgadas**, quiero **que el aviso me diga qué campo de la altura
está mal** para **corregirlo sin adivinar**; y como **mantenedor del proyecto**, quiero **cerrar los pendientes menores
del frontend (regla de rango compartida, lint limpio en los componentes de UI, tests en español correcto y sin
duplicados, y un paquete inicial más ligero)** para **que el código sea más fácil de mantener y la app cargue antes**.

## 3. Alcance

**Incluye:**
- Mensaje «Entre 0 y 11 in» en la altura del perfil cuando los pies son válidos y las pulgadas no (REQ-001).
- Actualizar las expectativas de los tests existentes de la spec 015 que cubren esos casos en el perfil y en el
  esquema de datos físicos (REQ-001).
- Mover la regla de rango numérico a un módulo compartido de `src/lib` y hacer que onboarding, perfil y métricas
  corporales la importen de ahí (NFR-001).
- Eliminar los warnings `only-export-components` de `components/ui/form.tsx` y `components/ui/button.tsx` sin cambiar
  lo que exportan esos módulos (NFR-002).
- Corregir tildes y regionalismos en comentarios y nombres de test de `LoginForm.test.tsx` y
  `ForgotPasswordForm.test.tsx` (NFR-003).
- Consolidar los tests duplicados de fecha prerrellenada de `OnboardingPage.test.tsx` (NFR-004).
- Cargar cada pantalla bajo demanda por ruta, con un aviso de carga y un aviso de error de descarga, para que el
  chunk de entrada quede en 500 kB o menos (REQ-002, REQ-003, NFR-005).

**Fuera de alcance:**
- Registrar mediciones con fecha pasada desde el perfil.
- El ADR del patrón de `fieldMessages` síncrono.
- El test de escaneo que impida reintroducir `validation.ts` o `useState` en los formularios del onboarding y del
  perfil.
- Todo lo de backend (textos sin tilde en tests de backend, mensajes «Wrong Credentials» y «Email already registered»,
  etc.).
- Cambiar los mensajes visibles del onboarding: en el asistente la altura sigue sin mostrar mensajes de rango.
- Los textos visibles de los formularios de autenticación (p. ej. la etiqueta «Password»): solo se tocan los tests.
- Subir el umbral de aviso de tamaño de chunk de Vite.
- Partir en trozos más pequeños el chunk propio de una pantalla concreta (p. ej. Métricas con sus gráficas) si
  supera 500 kB por sí solo: no bloquea la feature y se anota en el backlog.

## 4. Requisitos funcionales

### REQ-001 — Mensaje específico para pulgadas fuera de rango en el perfil

IF en el formulario de datos físicos del perfil la unidad de altura es ft / in, los pies son un entero entre 3 y 8 y
las pulgadas no son un entero entre 0 y 11 THEN THE SYSTEM SHALL mostrar «Entre 0 y 11 in» como mensaje de la altura
(en lugar de «Entre 3 y 8 ft»), marcar como no válido el campo de pulgadas y deshabilitar «Guardar».

Si los pies no son válidos, el mensaje sigue siendo «Entre 3 y 8 ft», con independencia de las pulgadas. Las pulgadas
vacías siguen contando como 0.

- **AC-001.1:** Given el perfil cargado en ft / lb con 5 ft, When el usuario escribe 12 en las pulgadas, Then se
  muestra «Entre 0 y 11 in», no se muestra «Entre 3 y 8 ft», el campo de pulgadas tiene `aria-invalid="true"`, el de
  pies no lo tiene y «Guardar» está deshabilitado.
- **AC-001.2:** Given el perfil cargado en ft / lb con 5 ft, When el usuario escribe 2.5 o -1 en las pulgadas, Then se
  muestra «Entre 0 y 11 in», no se muestra «Entre 3 y 8 ft» y «Guardar» está deshabilitado.
- **AC-001.3:** Given el perfil en ft / lb con 5 ft y 12 in (mensaje «Entre 0 y 11 in» visible), When el usuario
  cambia las pulgadas a 11 o las deja vacías, Then desaparece el mensaje, ningún campo de la altura tiene
  `aria-invalid="true"` y «Guardar» está habilitado.
- **AC-001.4:** Given el perfil cargado en ft / lb, When el usuario escribe 2 ft, 9 ft o 5.5 ft con 9 o 12 in, Then se
  muestra «Entre 3 y 8 ft», no se muestra «Entre 0 y 11 in», los dos campos de la altura tienen
  `aria-invalid="true"` y «Guardar» está deshabilitado.
- **AC-001.5:** Given el esquema de validación de datos físicos compartido por onboarding y perfil, When se valida
  ft / in con 5 ft y 12 in, y con 5 ft y 2.5 in, Then el mensaje de la altura es «Entre 0 y 11 in»; y When se valida
  con 9 ft y 12 in, o con 5.5 ft y pulgadas vacías, Then el mensaje es «Entre 3 y 8 ft».
- **AC-001.6:** Given el paso de altura del onboarding en ft / in, When el usuario escribe 5 ft y 12 in, Then
  «Siguiente» está deshabilitado y no se muestra ningún mensaje que empiece por «Entre».

### REQ-002 — Carga de cada pantalla bajo demanda

WHEN el usuario navega a una ruta cuya pantalla aún no se ha descargado THE
SYSTEM SHALL mostrar el aviso «Cargando…» mientras se descarga y, al terminar, la misma pantalla que antes de esta
feature.

- **AC-002.1:** Given una pantalla cuya descarga aún no ha terminado, When el usuario navega a su ruta, Then se
  muestra el texto «Cargando…» y, cuando la descarga termina, el aviso desaparece y se muestra la pantalla.
- **AC-002.2:** Given un usuario sin sesión, When abre /login, /register, /forgot-password, /reset-password, /privacy
  y /terms, Then cada ruta termina mostrando su pantalla (el formulario o el texto legal correspondiente) sin
  redirigir a otra ruta.
- **AC-002.3:** Given un usuario con sesión y el onboarding completado, When abre /home, /macros, /body-metrics,
  /coach, /store y /profile, Then cada ruta termina mostrando su pantalla dentro de la navegación de la app.
- **AC-002.4:** Given un usuario con sesión y el onboarding pendiente, When abre /onboarding, Then termina mostrando
  la primera pregunta del asistente.

### REQ-003 — Error al descargar una pantalla

IF la descarga de una pantalla falla (p. ej. tras un despliegue nuevo con la
pestaña abierta) THEN THE SYSTEM SHALL mostrar «No se pudo cargar la página.» y un botón «Recargar» que vuelve a
cargar la app en la misma ruta.

- **AC-003.1:** Given una pantalla cuya descarga falla, When el usuario navega a su ruta, Then se muestra «No se pudo
  cargar la página.» y un botón «Recargar», y no se muestra «Cargando…».
- **AC-003.2:** Given el aviso de error de descarga visible, When el usuario pulsa «Recargar», Then el navegador
  recarga la página actual.

## 5. Requisitos no funcionales

### NFR-001 — Regla de rango numérico compartida

THE SYSTEM SHALL tener una única regla de rango numérico en un módulo compartido de `src/lib`, con el mismo
comportamiento que la actual, y onboarding, perfil y métricas corporales SHALL usarla desde ese módulo.

- **AC-N001.1:** Given la regla compartida con un rango de 3 a 8, When se evalúa, Then devuelve verdadero para «3»,
  «8» y «5.5», y falso para «», «   », «2.9», «8.1» y «abc».
- **AC-N001.2:** Given la regla compartida con un rango de 3 a 8 y la opción de solo enteros, When se evalúa, Then
  devuelve verdadero para «5» y falso para «5.5».
- **AC-N001.3:** Given el código fuente de `src`, When se escanea, Then `features/onboarding/schemas.ts` no define ni
  reexporta `inRange`, ningún archivo importa `inRange` desde `@/features/onboarding/schemas`, y los esquemas de
  onboarding, perfil y métricas corporales la importan del módulo compartido de `src/lib`.
- **AC-N001.4:** Given los tests existentes de los esquemas y páginas de onboarding, perfil y métricas corporales,
  When se ejecutan, Then pasan sin cambiar sus aserciones (salvo las de los casos que modifica REQ-001).

### NFR-002 — Componentes de UI sin warnings de `only-export-components`

THE SYSTEM SHALL pasar `npm run lint` sin warnings `only-export-components` en `components/ui/form.tsx` y
`components/ui/button.tsx`, conservando los nombres que exportan esos módulos y su ubicación. Como los exports que no
son componentes (`buttonVariants`, `useFormField`) se quedan donde están, el warning se suprime solo en la línea de
cada uno de esos exports, con un comentario que explique el motivo; la regla sigue activa en el resto del proyecto.

- **AC-N002.1:** Given el frontend, When se ejecuta `npm run lint`, Then la salida no contiene ningún warning
  `only-export-components` para `src/components/ui/form.tsx` ni para `src/components/ui/button.tsx`, y no hay errores.
- **AC-N002.2:** Given los módulos `@/components/ui/button` y `@/components/ui/form`, When se importan, Then el primero
  sigue exportando `Button` y `buttonVariants`, y el segundo `useFormField`, `Form`, `FormItem`, `FormLabel`,
  `FormControl`, `FormDescription`, `FormMessage` y `FormField`.
- **AC-N002.3:** Given los formularios que usan esos componentes (login, registro, recuperación y restablecimiento de
  contraseña, y feedback), When se ejecutan sus tests existentes, Then pasan sin cambios.
- **AC-N002.4:** Given `src/components/ui/form.tsx` y `src/components/ui/button.tsx`, When se escanean, Then cada uno
  contiene como mucho una supresión de `only-export-components`, que va acompañada de un comentario con el motivo, y
  la configuración de lint del proyecto no desactiva esa regla.

### NFR-003 — Tests de autenticación en español correcto

THE SYSTEM SHALL tener los comentarios y nombres de test de `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx` en
español correcto, con tildes y sin regionalismos, sin cambiar lo que prueban.

- **AC-N003.1:** Given `LoginForm.test.tsx` y `ForgotPasswordForm.test.tsx`, When se escanean como palabras completas,
  Then no contienen ninguna de estas formas: «validacion», «vacio», «implementacion», «funcion», «podria», «asi»,
  «aca», «proximo», «redireccion», «redirigio», «despues», «Tambien», «recuperacion», «exito», «envia», «peticion»,
  «limite», «envio», «boton», «esta en curso», «SI hay», «via».
- **AC-N003.2:** Given esos dos archivos, When se ejecutan, Then conservan el mismo número de tests (14 en
  `LoginForm.test.tsx` y 8 en `ForgotPasswordForm.test.tsx`), los mismos marcadores `SDD:` y pasan.

### NFR-004 — Sin tests duplicados de fecha prerrellenada en el onboarding

THE SYSTEM SHALL comprobar cada escenario de fecha prerrellenada de `OnboardingPage.test.tsx` en un solo test, sin
dejar ningún AC de las specs 006 y 015 sin su marcador. Se conservan los tests de la spec 006 (AC-009.1 y AC-009.4)
y se eliminan los dos duplicados de la spec 015; el marcador de cada test conservado añade `AC-007.5` de la 015:
`// SDD: REQ-009 AC-009.1 · 015 REQ-007 AC-007.5` y `// SDD: REQ-009 AC-009.4 · 015 REQ-007 AC-007.5`.

- **AC-N004.1:** Given `OnboardingPage.test.tsx`, When se escanea, Then hay exactamente un test que comprueba que la
  fecha prerrellenada 1995-05-20 deja «Siguiente» habilitado y exactamente uno que comprueba que la fecha prerrellenada
  1900-01-01 muestra el aviso de rango.
- **AC-N004.2:** Given `OnboardingPage.test.tsx`, When se escanea, Then siguen apareciendo en algún marcador `SDD:` los
  AC `AC-009.1` y `AC-009.4` (spec 006) y `AC-007.5` (spec 015), y el marcador del test de 1995-05-20 es
  `// SDD: REQ-009 AC-009.1 · 015 REQ-007 AC-007.5` y el del test de 1900-01-01 es
  `// SDD: REQ-009 AC-009.4 · 015 REQ-007 AC-007.5`.
- **AC-N004.3:** Given `OnboardingPage.test.tsx`, When se ejecuta, Then todos sus tests pasan.

### NFR-005 — Paquete inicial por debajo de 500 kB

THE SYSTEM SHALL producir en el build un chunk de entrada de 500 kB o menos
(tamaño minificado que informa Vite), sin cambiar el umbral de aviso de tamaño. Los chunks propios de cada pantalla
no tienen límite en esta feature.

- **AC-N005.1:** Given el frontend, When se ejecuta `npm run build`, Then el chunk JavaScript de entrada mide 500 kB o
  menos y la configuración de Vite no cambia el umbral de aviso de tamaño de chunk.
- **AC-N005.2:** Given el módulo de rutas de la app, When se escanea, Then no importa de forma estática ningún módulo
  de `features/*/pages/`.

## 6. Datos y contratos visibles

- **Sin cambios de API ni de datos:** ningún endpoint, cuerpo de petición o respuesta cambia; no hay migraciones.
- **Mensajes de la altura en el perfil (unidad ft / in):**

  | Pies | Pulgadas | Mensaje | Campos marcados como no válidos |
  |---|---|---|---|
  | entero de 3 a 8 | vacías o entero de 0 a 11 | ninguno | ninguno |
  | entero de 3 a 8 | fuera de 0–11, negativas o con decimales | «Entre 0 y 11 in» | solo pulgadas |
  | vacíos, fuera de 3–8 o con decimales | cualquiera | «Entre 3 y 8 ft» | pies y pulgadas |

- **Onboarding:** sin cambios visibles; la altura no muestra mensajes de rango en el asistente.
- **Carga por ruta:** aviso «Cargando…» mientras se descarga una pantalla; si la descarga falla, «No se
  pudo cargar la página.» con el botón «Recargar».

## 7. Preguntas abiertas

| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué mensaje se muestra cuando fallan pies y pulgadas a la vez, y qué cuenta como pulgadas no válidas? | Si los pies no son válidos, manda «Entre 3 y 8 ft» (como hoy). «Entre 0 y 11 in» solo con pies válidos y pulgadas fuera de 0–11, negativas o con decimales. Se actualizan los casos 5 ft 12 in y 5 ft 2.5 in de los tests de la 015 (perfil y esquema), que hoy esperan «Entre 3 y 8 ft». | ok a todas |
| Q2 | Con el mensaje de pulgadas, ¿se marca como no válido solo el campo de pulgadas o los dos de la altura? | Solo el de pulgadas; con el mensaje de pies se siguen marcando los dos, como hoy. | ok a todas |
| Q3 | Los dos warnings de `only-export-components` salen porque los archivos de shadcn exportan algo que no es un componente (`buttonVariants`, `useFormField`), y otros componentes de shadcn que se añadan después los importan de ahí. ¿Se acepta suprimir la regla en esa línea con un comentario justificado, si sacar el export a otro archivo rompe esa convención? | Sí: se conservan los exports donde están (AC-N002.2) y se suprime el warning solo en esas dos líneas, con un comentario que explique el motivo. | ok a todas |
| Q4 | Al consolidar los tests duplicados de fecha prerrellenada, ¿cuál se conserva y cómo queda el marcador? | Se conservan los tests de la spec 006 (AC-009.1 y AC-009.4, el de 1900-01-01) y se borran los dos de la 015 con AC-007.5. El marcador de cada test conservado lista los dos: `// SDD: REQ-009 AC-009.1 · 015 REQ-007 AC-007.5` y `// SDD: REQ-009 AC-009.4 · 015 REQ-007 AC-007.5`. | ok a todas |
| Q5 | ¿Se incluye en esta feature el punto opcional de cargar las pantallas bajo demanda (REQ-002, REQ-003 y NFR-005)? | Sí, con el aviso «Cargando…» y, si falla la descarga, «No se pudo cargar la página.» con el botón «Recargar». Si se excluye, esos tres requisitos se quitan de la spec y el punto vuelve al backlog. | ok a todas |
| Q6 | Si tras partir por rutas algún chunk propio de una pantalla (p. ej. Métricas, con las gráficas) sigue por encima de 500 kB, ¿bloquea la feature? | No: solo se exige que el chunk de entrada quede en 500 kB o menos; un chunk de pantalla mayor se anota en el backlog. | ok a todas |

Todas las preguntas están resueltas: el usuario aceptó las propuestas por defecto de Q1 a Q6. Q1 y Q2 están en
REQ-001 y en la tabla de la sección 6; Q3, en NFR-002 (AC-N002.4); Q4, en NFR-004 (AC-N004.2); Q5 incluye REQ-002,
REQ-003 y NFR-005 como obligatorios; y Q6, en NFR-005 y en «Fuera de alcance».

## 8. Glosario

- **Chunk:** archivo JavaScript que genera el build; el navegador descarga el de entrada al abrir la app y los demás
  cuando hacen falta.
- **Carga bajo demanda por ruta:** descargar el código de una pantalla solo cuando el usuario navega a ella.
- **Marcador `SDD:`:** comentario en la línea anterior a un test que indica qué AC cubre (Art. B4.3 y Art. P1.1).
