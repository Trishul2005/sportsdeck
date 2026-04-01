#!/usr/bin/env bash
set -euo pipefail

docker compose down --remove-orphans
docker compose build --no-cache app cron
docker compose up -d --force-recreate --remove-orphans db redis app cron nginx
