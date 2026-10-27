# ADR-0035: Deshacer «Quitar» con un token de restauración firmado, sin estado en el servidor

- **Estado:** Aceptada · 2026-10-26 (plan de la feature `026-diary-days-and-editing`; aceptada por el usuario)
- **Decidido por:** el planner lo propone; lo acepta o rechaza el usuario en el gate del plan (Art. P5.2).

## Contexto
La spec 026 (REQ-007) pide que, tras quitar un alimento del diario, el usuario pueda pulsar «Deshacer» durante 10
segundos y recuperar el alimento en la misma comida, día y posición, con el mismo nombre, origen, gramos, valores por
100 g y nutrientes, aunque el catálogo haya cambiado (AC-007.4) y aunque la comida se haya borrado al quedarse vacía
(AC-007.5). El alimento se quita de verdad al pulsar «Quitar» (AC-007.2). Además, un usuario no puede restaurar en las
comidas de otro: debe recibir 404 (NFR-002, AC-N002.2). La spec prohíbe migraciones y deja al plan el contrato de la API
(sección 6).

Restricciones del contrato vigente:
- `DELETE /api/meals/{id}/items/{item_id}` responde 204 sin cuerpo (spec 022, AC-007.1 y AC-007.2, que la 026 no
  sustituye).
- El frontend en Vercel y el backend en EC2 no se despliegan a la vez.

Opciones consideradas:
1. **Borrado lógico** (`deleted_at` en `meal_items`). Necesita migración, filtros en todas las consultas y limpieza.
   La spec excluye migraciones.
2. **Restaurar desde una copia que envía el cliente** (`POST` con nombre, origen, gramos y valores por 100 g). Sin
   estado, pero la petición no se puede ligar a una comida ajena: no hay forma de responder 404 a AC-N002.2 sin exponer
   si una comida de otro existe. Además, permitiría guardar un alimento «del catálogo» con valores inventados.
3. **Token de restauración firmado**: al quitar, el servidor devuelve una copia del alimento firmada con HMAC y ligada
   al usuario; para deshacer, el cliente devuelve el token tal cual.

## Decisión
1. **Petición opcional.** `DELETE /api/meals/{id}/items/{item_id}?undo=1` responde **200** con
   `{"restore_token": "<token>"}`. Sin `undo=1` sigue respondiendo **204** sin cuerpo (contrato de la 022 intacto).
2. **Formato.** `token = "<payload>.<firma>"`:
   - `payload = base64url_sin_relleno(JSON compacto)` con versión, fecha y tipo de la comida, posición, origen,
     `catalog_id`, `fdc_id`, nombre, `data_type`, gramos (texto decimal), los cuatro valores por 100 g (o `null`) y la
     caducidad `exp` (segundos desde 1970, UTC);
   - `firma = base64url_sin_relleno(HMAC-SHA256(SECRET_KEY, "meal-item-restore:v1:<user_id>:<payload>"))`.
   - El prefijo `meal-item-restore:v1` separa este uso del `feedback_id` del coach (ADR-0018) aunque compartan clave.
3. **Firmante.** `RestoreTokenSigner` (`backend/utils/restore_token.py`), genérico sobre un diccionario, inyectado en
   `MealService` por constructor. Comprueba longitud máxima (4096) y forma, recalcula la firma con el `user_id` del
   token de sesión y compara con `hmac.compare_digest`.
4. **Restaurar.** `POST /api/meals/restore` con `{"restore_token": "…"}`. El servicio verifica la firma y la
   caducidad (120 s desde que se quitó, con el reloj de la app de ADR-0028), bloquea la fila del usuario (ADR-0020),
   busca o crea la comida por usuario, fecha y tipo, aplica el límite de 50 alimentos, crea el alimento con la posición,
   la identidad y los valores por 100 g del token y recalcula los nutrientes con `portion_nutrients` (la misma función
   que los calculó al guardarlo). Responde 201 si creó la comida y 200 si ya existía, con la comida serializada como
   `POST /api/meals`. Token ausente, alterado, caducado o de otro usuario: 404. No aplica la ventana de fechas de
   `POST /api/meals`, igual que editar o quitar.
5. **Sin estado.** No hay tabla, migración ni clave en Redis.

## Consecuencias
- (+) Sin migración ni limpieza; el alimento se quita de verdad al pulsar «Quitar».
- (+) La copia restaurada es exactamente la que estaba guardada: el cliente no puede alterar los valores.
- (+) Un usuario no puede restaurar con el token de otro (404). Aunque `SECRET_KEY` se filtrara, el alimento siempre se
  restaura en las comidas del usuario de la sesión, nunca en las de otro.
- (+) Compatible en los dos sentidos del despliegue: el frontend antiguo no envía `undo=1` y sigue recibiendo 204; el
  frontend nuevo contra un backend antiguo recibe 204 sin token y no ofrece «Deshacer».
- (−) El mismo token se puede usar más de una vez dentro de los 120 s y duplicaría el alimento. Solo afecta al diario
  del propio usuario; el frontend deshabilita «Deshacer» mientras hay una petición en curso y lo retira al terminar.
- (−) Rotar `SECRET_KEY` invalida los tokens emitidos en los últimos 120 s. Aceptable.
- (−) El token viaja al navegador con el nombre y los valores del alimento: son datos del propio usuario, que ya
  recibe en `GET /api/meals`.
