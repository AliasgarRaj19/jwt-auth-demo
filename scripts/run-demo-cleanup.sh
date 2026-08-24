#!/bin/sh
set -eu

cd /opt/general-system/jwt-auth-demo
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm server npm run demo:cleanup -- "$@"
