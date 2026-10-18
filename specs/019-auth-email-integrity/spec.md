# Spec 019 — Integridad de los correos guardados: recorte de espacios y garantía en la base

- **Feature:** `019-auth-email-integrity` · **Tipo:** fix
- **Ámbitos:** backend

## 1. Contexto y problema
Desde la spec 014 (ADR-0025), el correo de una cuenta tiene una forma canónica: sin espacios al principio ni al final y en minúsculas. El registro, el login, Google Sign-In y la solicitud de restablecimiento ya calculan esa forma antes de guardar o buscar. Pero la actualización de datos de la 014 solo pasó a minúsculas los correos que ya estaban guardados, sin recortar los espacios. Una cuenta antigua guardada como `" ana@example.com"` no se encuentra al entrar con `ana@example.com`: su dueña no puede iniciar sesión ni pedir un enlace de restablecimiento.

Además, la forma canónica solo la garantiza la aplicación. La base acepta cualquier correo que le llegue por otra vía, como un script, una corrección a mano o un error futuro, así que la integridad conseguida con la migración puede volver a perderse sin que nadie lo note.

Por último, en la tabla de solicitudes de restablecimiento quedan filas anteriores a la 014 con correos en mayúsculas o con espacios. Hoy son inofensivas, porque solo cuentan para el límite de una solicitud cada 2 minutos, pero son la única forma no canónica del correo que queda en la base.

## 2. Historia de usuario
Como **titular de una cuenta antigua de fitnerd**, quiero **poder entrar y recuperar mi contraseña escribiendo mi correo con normalidad** para **no quedarme fuera de mi cuenta por unos espacios que se guardaron hace tiempo**.

Como **responsable del servicio**, quiero **que la base de datos rechace cualquier correo que no esté en su forma canónica** para **que la integridad de los correos no dependa solo de que la aplicación no tenga errores**.

## 3. Alcance
**Incluye:**
- Una actualización de datos que convierte a la forma canónica (sin espacios al principio ni al final y en minúsculas) los correos guardados de las cuentas.
- La misma conversión para las filas de la tabla de solicitudes de restablecimiento.
- Si hay cuentas que tras la conversión compartirían el mismo correo, la actualización falla sin modificar nada y lista los correos en conflicto.
- Una garantía en la base de datos que, una vez convertidos los datos, rechaza guardar un correo que no esté en forma canónica, en las cuentas y en las solicitudes de restablecimiento.
- La marcha atrás de la actualización, que retira la garantía sin tocar los correos.
- Mantener sin cambios el comportamiento visible del registro, el login, Google Sign-In y el restablecimiento de contraseña con correos escritos en mayúsculas o con espacios.

**Fuera de alcance:**
- Resolver automáticamente los conflictos de correos: se resuelven a mano, como en la 014.
- Cambiar las reglas de validación del correo (formato admitido, letras no ASCII) o los mensajes de error de autenticación. Se acepta el riesgo de que un correo con letras no ASCII, que la aplicación y la base pasan a minúsculas de forma distinta (ADR-0025), sea rechazado por la garantía de REQ-004; queda anotado para el backlog (Q2).
- Cambios en el frontend.
- Recuperar las mayúsculas o los espacios originales con la marcha atrás: solo es posible desde el volcado previo.
- Aplicar la actualización en producción: es un paso manual del despliegue (volcado completo previo y `flask db upgrade`) que documenta la etapa docs (Art. P4).

## 4. Requisitos funcionales

### REQ-001 — Correos de las cuentas en forma canónica
WHEN se aplica la actualización de datos THE SYSTEM SHALL dejar el correo de cada cuenta sin espacios al principio ni al final y en minúsculas, sin modificar ningún otro dato de la cuenta. La conversión trata a la vez los espacios y las mayúsculas, así que funciona tanto si la actualización de la 014 se aplicó antes como si no (Q3).

- **AC-001.1:** Given una cuenta guardada con el correo `"  ana@example.com "`, When se aplica la actualización, Then su correo pasa a ser `"ana@example.com"`.
- **AC-001.2:** Given una cuenta guardada con el correo `" Ana@Example.COM"`, When se aplica la actualización, Then su correo pasa a ser `"ana@example.com"`.
- **AC-001.3:** Given una cuenta cuyo correo ya está en forma canónica, When se aplica la actualización, Then su correo y el resto de sus datos (identificador, nombre, contraseña, vínculo con Google, fechas) quedan iguales.
- **AC-001.4:** Given una cuenta con contraseña guardada antes de la actualización con el correo `" ana@example.com"`, When se aplica la actualización y después se inicia sesión con `ana@example.com` y la contraseña correcta, Then el login responde 200 con un token de esa cuenta.

### REQ-002 — Conflictos al convertir los correos de las cuentas
IF dos o más cuentas compartirían el mismo correo tras convertirlo a la forma canónica THEN THE SYSTEM SHALL hacer fallar la actualización sin modificar ningún dato ni crear la garantía de REQ-004, con un mensaje que liste los correos en conflicto agrupados por su forma canónica.

- **AC-002.1:** Given dos cuentas con los correos `"ana@example.com"` y `" ana@example.com"`, When se aplica la actualización, Then falla, los dos correos y los de las demás cuentas siguen como estaban, y el mensaje de error contiene los dos correos tal como están guardados, cada uno entre comillas.
- **AC-002.2:** Given dos cuentas con los correos `"Ana@Example.com "` y `"ana@example.com"`, When se aplica la actualización, Then falla sin modificar ningún correo y el mensaje los lista en el mismo grupo.
- **AC-002.3:** Given un conflicto de correos como el de AC-002.1, When falla la actualización, Then la base sigue aceptando guardar un correo que no está en forma canónica, porque la garantía no se ha creado, y las solicitudes de restablecimiento tampoco se han modificado.

### REQ-003 — Correos de las solicitudes de restablecimiento en forma canónica
WHEN se aplica la actualización de datos THE SYSTEM SHALL dejar el correo de cada solicitud de restablecimiento sin espacios al principio ni al final y en minúsculas, sin modificar ningún otro dato de la solicitud. Como las solicitudes no exigen correos distintos entre sí, su conversión nunca produce conflictos (Q1).

- **AC-003.1:** Given una solicitud de restablecimiento guardada con el correo `" Ana@Example.com"`, When se aplica la actualización, Then su correo pasa a ser `"ana@example.com"` y su fecha de creación, su enlace y su estado (usado o invalidado) quedan iguales.
- **AC-003.2:** Given dos solicitudes con los correos `"ANA@example.com"` y `"ana@example.com"`, When se aplica la actualización, Then las dos se conservan con el correo `"ana@example.com"`, sin que eso cuente como conflicto.

### REQ-004 — Garantía de forma canónica en la base de datos
WHILE la actualización de datos está aplicada THE SYSTEM SHALL rechazar en la propia base de datos guardar o cambiar un correo de una cuenta o de una solicitud de restablecimiento que no esté sin espacios al principio ni al final y en minúsculas, aunque la escritura no pase por la aplicación.

- **AC-004.1:** Given la actualización aplicada, When se intenta guardar directamente en la base una cuenta con el correo `"Ana@example.com"`, Then la base rechaza la escritura y la cuenta no se crea.
- **AC-004.2:** Given la actualización aplicada, When se intenta guardar directamente en la base una cuenta con el correo `" ana@example.com"`, Then la base rechaza la escritura.
- **AC-004.3:** Given la actualización aplicada y una cuenta con el correo `"ana@example.com"`, When se intenta cambiar directamente en la base su correo a `"ANA@example.com"`, Then la base rechaza el cambio y el correo sigue siendo `"ana@example.com"`.
- **AC-004.4:** Given la actualización aplicada, When se intenta guardar directamente en la base una solicitud de restablecimiento con el correo `"Ana@example.com "`, Then la base rechaza la escritura.
- **AC-004.5:** Given la actualización aplicada, When se guarda directamente en la base una cuenta con el correo `"ana@example.com"`, Then la escritura se acepta.

### REQ-005 — Comportamiento visible de la autenticación sin cambios
WHILE la garantía de REQ-004 está activa THE SYSTEM SHALL seguir aceptando en el registro, el login, Google Sign-In y la solicitud de restablecimiento correos escritos con mayúsculas o con espacios al principio o al final, y guardarlos en forma canónica.

- **AC-005.1:** Given la garantía activa, When alguien se registra con el correo `" Ana@Example.com "` y datos válidos, Then el registro responde 201 y la cuenta queda guardada con el correo `"ana@example.com"`.
- **AC-005.2:** Given una cuenta registrada con `ana@example.com`, When se inicia sesión con `" ANA@example.com"` y la contraseña correcta, Then el login responde 200 con un token de esa cuenta.
- **AC-005.3:** Given una cuenta registrada con `ana@example.com`, When alguien intenta registrarse con `"Ana@Example.com"`, Then el registro responde 409 con `{"error": "Ya existe una cuenta con este correo"}` y no se crea otra cuenta.
- **AC-005.4:** Given la garantía activa, When se entra por primera vez con Google y el token trae el correo `"Ana@Example.com"`, Then se crea la cuenta con el correo `"ana@example.com"`.
- **AC-005.5:** Given una cuenta registrada con `ana@example.com`, When se solicita un restablecimiento con `" ANA@example.com "`, Then la solicitud responde como hoy, se envía el correo a esa cuenta y la solicitud queda guardada con `"ana@example.com"`.

### REQ-006 — Marcha atrás de la actualización
WHEN se revierte la actualización de datos THE SYSTEM SHALL retirar la garantía de REQ-004 sin modificar ningún correo guardado.

- **AC-006.1:** Given la actualización aplicada y una cuenta con el correo `"ana@example.com"` que antes era `" Ana@example.com"`, When se revierte, Then el correo sigue siendo `"ana@example.com"` y la base vuelve a aceptar guardar una cuenta con el correo `"Bea@example.com"`.
- **AC-006.2:** Given la actualización revertida, When se vuelve a aplicar sobre datos ya canónicos, Then termina sin error, no modifica ningún correo y la garantía vuelve a estar activa.

## 5. Requisitos no funcionales
No aplican requisitos no funcionales propios: la atomicidad de la actualización está en REQ-002, y el procedimiento manual de despliegue (volcado completo previo y aplicación a mano) es un punto de la definición de hecho (Art. P4), no un requisito comprobable con tests.

## 6. Datos y contratos visibles
- **Forma canónica del correo:** el correo sin espacios al principio ni al final y en minúsculas, la misma de ADR-0025. Aplica a las cuentas y a las solicitudes de restablecimiento.
- **Mensaje de fallo de la actualización por conflictos** (lo ve quien aplica la migración, no el usuario final), en español:
  `Hay cuentas cuyos correos coinciden al quitar espacios y mayúsculas; resuélvelas a mano antes de migrar: "<correo 1>", "<correo 2>"; "<correo 3>", "<correo 4>"`
  Los grupos van separados por `; ` y, dentro de cada grupo, cada correo va entre comillas y tal como está guardado, para que se vean los espacios.
- **Respuestas de la API:** no cambian. El registro, el login, Google Sign-In y el restablecimiento mantienen sus códigos y mensajes actuales (`"Email inválido"`, `"Correo o contraseña incorrectos"`, `"Ya existe una cuenta con este correo"`…).
- **Datos existentes:** la actualización modifica los correos no canónicos de las cuentas y de las solicitudes de restablecimiento, y no se puede deshacer más que desde el volcado previo.

## 7. Preguntas abiertas
| # | Pregunta | Propuesta por defecto | Respuesta del usuario |
|---|---|---|---|
| Q1 | ¿Qué se hace con las filas antiguas de la tabla de solicitudes de restablecimiento con correos en mayúsculas o con espacios? | Convertirlas también a forma canónica y aplicarles la misma garantía en la base (REQ-003 y AC-004.4). No hay restricción de unicidad en esa tabla, así que no pueden producir conflictos. La alternativa es dejarlas como están y no ponerles garantía. |  Sí, acepto la respuesta propuesta. |
| Q2 | Las letras no ASCII se pasan a minúsculas de forma distinta en la aplicación y en la base (ADR-0025). Con la garantía activa, un registro con un correo de ese tipo podría ser rechazado por la base y acabar en un error 500. ¿Qué se hace? | Aceptar el riesgo sin cambiar la validación del correo, porque los correos reales son ASCII, y anotarlo en el backlog. Si se quiere evitar, la alternativa es rechazar en el registro, con `"Email inválido"`, los correos con letras no ASCII, lo que cambia la validación y amplía el alcance. |  Sí, acepto la respuesta propuesta. |
| Q3 | ¿La actualización debe convertir también los correos de las cuentas que solo tienen mayúsculas, como `"Ana@example.com"`, por si en algún entorno no se aplicó la migración de la 014? | Sí: la conversión trata a la vez los espacios y las mayúsculas (AC-001.2), así que funciona tanto si la migración de la 014 está aplicada como si no. |  Sí, acepto la respuesta propuesta. |

**Estado:** Q1, Q2 y Q3 resueltas; se aceptan las tres propuestas por defecto. Q1 queda en REQ-003 y AC-004.4; Q2, en "Fuera de alcance" (riesgo aceptado y anotado para el backlog); Q3, en REQ-001 y AC-001.2. No quedan preguntas abiertas.

## 8. Glosario
- **Forma canónica del correo:** el correo sin espacios al principio ni al final y en minúsculas.
- **Actualización de datos:** el cambio de esquema y datos versionado que se aplica a mano en producción con `flask db upgrade`, y se revierte con su marcha atrás.
- **Garantía en la base:** una regla de la propia base de datos que rechaza las escrituras que la incumplen, vengan de donde vengan.
- **Conflicto de correos:** dos o más cuentas cuyos correos coinciden al convertirlos a la forma canónica.
