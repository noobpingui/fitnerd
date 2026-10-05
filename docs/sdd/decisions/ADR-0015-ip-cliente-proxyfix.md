# ADR-0015: IP del cliente detrás de Caddy con `ProxyFix` configurable

- **Estado:** Aceptada · 2026-10-05
- **Decidido por:** planner de la feature `002-forgot-password` (REQ-012); el usuario la aprobó en el gate de plan (iteración 2, 2026-10-05)

## Contexto
La spec 002 (REQ-012, AC-012.9) limita las solicitudes de restablecimiento a 3 cada 10 minutos por **IP del cliente original**, aunque la petición pase por el proxy inverso de producción. Es la primera vez que la app necesita la IP del cliente: hoy ningún código usa `request.remote_addr`.

En producción la cadena es cliente → Caddy (contenedor `caddy`, `reverse_proxy backend:5000`) → gunicorn. Sin más, `request.remote_addr` es la IP de Caddy dentro de la red de Docker, la misma para todos los clientes.

`reverse_proxy` de Caddy 2, sin `trusted_proxies` configurado, ignora el `X-Forwarded-For` que envía el cliente y lo sustituye por la IP real de la conexión. Por tanto, el último valor de esa cabecera es de fiar.

Alternativas evaluadas:
- **Leer `X-Forwarded-For` a mano en cada ruta:** repite lógica de seguridad y es fácil equivocarse con el orden de los valores.
- **`request.access_route[0]`:** toma el primer valor, que en otras configuraciones de proxy puede falsear el cliente.
- **`werkzeug.middleware.proxy_fix.ProxyFix`:** estándar de Flask; confía solo en los `N` últimos saltos y deja la IP correcta en `request.remote_addr` para toda la app.

## Decisión
- En `create_app()`, si `app.config["PROXY_FIX_X_FOR"] > 0`, se envuelve `app.wsgi_app` con `ProxyFix(app.wsgi_app, x_for=PROXY_FIX_X_FOR)`. Solo `x_for`; `x_proto`, `x_host` y el resto no se activan.
- `PROXY_FIX_X_FOR` (entero) se lee del entorno:
  - `Config` (desarrollo): `0` por defecto, porque no hay proxy y no se debe confiar en la cabecera;
  - `ProductionConfig`: `1` por defecto (un único proxy de confianza, Caddy);
  - `TestingConfig`: `1` **fijo**, para que los tests de integración simulen a Caddy enviando `X-Forwarded-For` desde el test client (`127.0.0.1`).
- El código de negocio no lee cabeceras: las rutas pasan `request.remote_addr` al servicio.

## Consecuencias
- (+) Una única pieza decide de qué proxy se fía la app; cualquier feature futura que necesite la IP del cliente usa `request.remote_addr` sin más.
- (+) No hace falta cambiar `Caddyfile` ni `docker-compose.prod.yml`.
- (−) Si cambia la infraestructura (se quita Caddy, se añade un CDN o un balanceador delante, o se configura `trusted_proxies` en Caddy), hay que ajustar `PROXY_FIX_X_FOR`. Con un valor demasiado bajo todos los clientes compartirían la IP del proxy; con uno demasiado alto un cliente podría falsear su IP.
- (−) Una petición directa a `127.0.0.1:5000` desde la propia instancia con un `X-Forwarded-For` inventado se trata como si viniera de esa IP. Se acepta: ese puerto solo escucha en el loopback de la instancia.
