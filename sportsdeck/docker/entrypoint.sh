#!/usr/bin/env bash
set -euo pipefail

echo "Preparing Prisma schema..."
node ./setup-prisma.js

echo "Applying database schema..."
for attempt in $(seq 1 20); do
	if npx prisma migrate deploy >/dev/null 2>&1; then
		break
	fi

	if npx prisma db push >/dev/null 2>&1; then
		break
	fi

	if [ "$attempt" -eq 20 ]; then
		echo "Database schema sync failed after ${attempt} attempts."
		exit 1
	fi

	echo "Database not ready yet. Retrying in 3s..."
	sleep 3
done

npx prisma generate >/dev/null 2>&1 || true

echo "Starting Next.js in production mode..."
exec npm run start -- --hostname 0.0.0.0 --port "${PORT:-3000}"
