#!/usr/bin/env bash
# Despliega el backend en la instancia EC2 mediante AWS SSM Run Command
# (ADR-0016). Lo ejecuta el job "deploy" de backend-tests.yml, ya con
# credenciales temporales de AWS obtenidas por OIDC.
#
# Variables de entorno que necesita:
#   EC2_INSTANCE_ID  ID de la instancia (i-...)
#   DEPLOY_PATH      ruta del repositorio en la instancia
#   GITHUB_SHA       commit que disparó el workflow (lo pone Actions)
#
# Deja en GITHUB_OUTPUT "deployed_sha" con el commit que quedó desplegado.
set -euo pipefail

: "${EC2_INSTANCE_ID:?Falta EC2_INSTANCE_ID}"
: "${DEPLOY_PATH:?Falta DEPLOY_PATH}"

# Tiempo máximo esperando a que termine el comando en la instancia. El build
# de la imagen en la t3.micro puede tardar varios minutos.
MAX_WAIT_SECONDS=1200
POLL_SECONDS=10

# SSM ejecuta como root, pero el repositorio y los plugins de Docker
# (compose y buildx en ~/.docker/cli-plugins/) son de ec2-user, así que
# todo se ejecuta como ec2-user con "runuser -l".
# - git pull --ff-only: falla si alguien tocó el repositorio del servidor,
#   en lugar de sobrescribir esos cambios.
# - La línea DEPLOYED_SHA= la lee este script para saber qué quedó
#   desplegado.
# - Nunca "docker compose config": imprime los secretos de backend/.env.
remote_script=$(cat <<EOF
set -eu
runuser -l ec2-user -c 'set -eu
cd "${DEPLOY_PATH}"
git pull --ff-only
echo "DEPLOYED_SHA=\$(git rev-parse HEAD)"
docker compose -f docker-compose.prod.yml up -d --build'
EOF
)

parameters=$(jq -n --arg script "$remote_script" \
  '{commands: [$script], executionTimeout: ["1800"]}')

command_id=$(aws ssm send-command \
  --instance-ids "$EC2_INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "fitnerd deploy ${GITHUB_SHA:0:7}" \
  --parameters "$parameters" \
  --query "Command.CommandId" \
  --output text)

echo "Comando SSM enviado: $command_id"

# Justo después de enviarlo, get-command-invocation puede responder
# InvocationDoesNotExist durante unos segundos; se trata como pendiente.
status="Pending"
elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
  sleep "$POLL_SECONDS"
  elapsed=$((elapsed + POLL_SECONDS))
  status=$(aws ssm get-command-invocation \
    --command-id "$command_id" \
    --instance-id "$EC2_INSTANCE_ID" \
    --query "Status" \
    --output text 2>/dev/null || echo "Pending")
  echo "Estado tras ${elapsed}s: $status"
  case "$status" in
    Pending|InProgress|Delayed) ;;
    *) break ;;
  esac
done

invocation=$(aws ssm get-command-invocation \
  --command-id "$command_id" \
  --instance-id "$EC2_INSTANCE_ID" \
  --output json 2>/dev/null || echo '{}')
stdout=$(jq -r '.StandardOutputContent // ""' <<<"$invocation")
stderr=$(jq -r '.StandardErrorContent // ""' <<<"$invocation")

# Docker escribe el progreso del build en stderr, así que se muestran las
# dos salidas aunque el comando haya ido bien. SSM las recorta a 24 000
# caracteres.
echo "::group::Salida del comando en la instancia"
echo "$stdout"
echo "--- stderr ---"
echo "$stderr"
echo "::endgroup::"

if [ "$status" != "Success" ]; then
  echo "::error::El despliegue terminó con estado '$status'."
  exit 1
fi

deployed_sha=$(grep -o 'DEPLOYED_SHA=[0-9a-f]*' <<<"$stdout" | head -1 | cut -d= -f2 || true)
echo "deployed_sha=$deployed_sha" >> "$GITHUB_OUTPUT"

# Si entre el push y el despliegue llegó otro commit a main, la instancia
# queda en ese commit más reciente. No es un error: su propio workflow lo
# volverá a desplegar.
if [ -n "$deployed_sha" ] && [ "$deployed_sha" != "$GITHUB_SHA" ]; then
  echo "::notice::La instancia quedó en $deployed_sha, más reciente que $GITHUB_SHA."
fi
