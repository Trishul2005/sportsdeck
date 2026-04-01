#!/usr/bin/env bash
set -euo pipefail

docker compose build --no-cache import-data
docker compose run --rm import-data
