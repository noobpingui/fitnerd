# ADR-0016: Despliegue continuo del backend con AWS SSM y OIDC

- **Estado:** Aceptada · 2026-10-06
- **Decidido por:** el usuario, en la sesión principal, fuera del flujo SDD (ver "Proceso")

## Contexto
El backend se despliega a mano: se entra por SSH en la instancia EC2 y se ejecuta `git pull` y después `docker compose -f docker-compose.prod.yml up -d --build`. El CI (`backend-tests.yml`) ya ejecuta pytest en cada push a `main`, pero nada conecta "los tests pasan" con "se despliega". Es fácil olvidar un despliegue o desplegar un commit con los tests en rojo.

Alternativas evaluadas para que GitHub Actions llegue a la instancia:
- **SSH con una clave guardada en GitHub Secrets:** es lo más habitual, pero obliga a abrir el puerto 22 a las IPs de los runners de GitHub, que son muchas y cambian. Además, deja en GitHub una clave de larga duración con acceso de shell a producción.
- **Que la instancia consulte cambios por su cuenta (pull con cron):** no necesita credenciales en GitHub, pero desacopla el despliegue del resultado de los tests y no da un resultado visible en GitHub.
- **AWS Systems Manager (SSM) Run Command con OIDC:** GitHub obtiene credenciales temporales de AWS presentando un token OIDC firmado para este repositorio. No hay claves de AWS fijas en GitHub y no hace falta abrir ningún puerto de entrada. Amazon Linux 2023 trae el agente de SSM instalado.

## Decisión
1. **Disparo:** un job `deploy` en `backend-tests.yml` con `needs: test`, que solo corre en `push` a `main` y en `workflow_dispatch` (para volver a desplegar a mano). No se ejecuta nunca en pull requests ni si los tests fallan. Los `paths` del workflow incluyen también `docker-compose.prod.yml` y `Caddyfile`, porque un cambio en ellos también requiere desplegar.
2. **Autenticación:** el job usa `aws-actions/configure-aws-credentials` con `permissions: id-token: write` y asume un rol IAM dedicado. El job declara `environment: production` y la política de confianza del rol solo acepta un `sub` concreto. GitHub lo envía con el formato de IDs inmutables, `repo:noobpingui@174681027/fitnerd@1314535581:environment:production`, y no con el clásico `repo:<owner>/fitnerd:environment:production`. Con el formato clásico, AWS responde `Not authorized to perform sts:AssumeRoleWithWebIdentity`. Si hay que recrear el rol, el `sub` real aparece en CloudTrail: evento `AssumeRoleWithWebIdentity`, campo `userIdentity.userName`. Así, ninguna otra rama, PR ni repositorio puede asumirlo, y el environment permite añadir más adelante una aprobación manual desde la configuración de GitHub sin tocar el workflow.
3. **Permisos mínimos del rol:** `ssm:SendCommand` sobre la instancia concreta y el documento `AWS-RunShellScript`, y `ssm:GetCommandInvocation` para leer el resultado. Nada más.
4. **Ejecución en la instancia:** `aws ssm send-command` con `AWS-RunShellScript`. SSM ejecuta como `root`, así que el script cambia a `ec2-user` (`runuser -l ec2-user`), que es el dueño del repositorio y el que tiene los plugins `compose` y `buildx` en `~/.docker/cli-plugins/`. El script hace `git pull --ff-only` (falla si alguien tocó el repositorio del servidor en lugar de sobrescribirlo), registra el commit desplegado y ejecuta `docker compose -f docker-compose.prod.yml up -d --build`. El workflow consulta el resultado hasta que termina y falla si el comando falla.
5. **Comprobación posterior:** el workflow hace `GET https://api.fitnerd.betofallas.dev/api/health` con reintentos durante un minuto y falla si no responde 200.
6. **Migraciones manuales:** el CD **no** ejecuta `flask db upgrade`. Si el push incluye cambios en `backend/migrations/`, el resumen del job muestra un aviso con el comando para aplicarlas a mano. Se revisará cuando haya más experiencia con el pipeline.
7. **Concurrencia:** `concurrency: deploy-backend` con `cancel-in-progress: false`, para que dos despliegues nunca se pisen y ninguno se corte a medias.
8. **Configuración:** el ARN del rol, el ID de la instancia, la región y la ruta del repositorio en la instancia van como *variables* del environment `production` de GitHub, no como secrets: ninguno da acceso por sí solo.
9. **Proceso:** los cambios de CI/CD no alteran el comportamiento de la app, así que no son "cambios funcionales" según el Art. 1 de la constitución y no pasan por el flujo SDD completo. Van en ramas `chore/…`, con un ADR cuando introducen una decisión nueva, y con las aprobaciones de commit y push de siempre. Esta ADR amplía la convención de ramas de `CLAUDE.md` en ese sentido.

## Consecuencias
- (+) Cada push a `main` con cambios en el backend se despliega solo, y únicamente si los tests pasan. El resultado (commit desplegado, salud y avisos de migración) queda visible en GitHub.
- (+) No hay claves de AWS ni de SSH en GitHub, y el puerto 22 puede quedarse cerrado al exterior.
- (−) Hay piezas fuera del repositorio que se configuran a mano en AWS (proveedor OIDC, rol IAM y perfil de instancia con `AmazonSSMManagedInstanceCore`) y en GitHub (environment y variables). Si se recrea la instancia, hay que actualizar su ID.
- (−) Un despliegue con una migración pendiente deja el código nuevo corriendo contra el esquema viejo hasta que se aplica a mano. El aviso del resumen lo mitiga, pero no lo evita.
- (−) `docker compose up --build` compila en la propia instancia t3.micro. Un build lento o sin memoria hará fallar el job; el swap de 1 GB lo mitiga.
- (−) No hay rollback automático. Para volver atrás se revierte el commit en `main` (lo que dispara un nuevo despliegue) o se hace `git checkout` del commit anterior en la instancia.
