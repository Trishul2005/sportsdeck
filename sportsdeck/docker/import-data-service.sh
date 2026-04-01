#!/usr/bin/env bash
set -euo pipefail

echo "Preparing Prisma schema..."
node ./setup-prisma.js

echo "Applying database schema before import..."
npx prisma migrate deploy || npx prisma db push
npx prisma generate

APP_BASE_URL="${APP_BASE_URL:-http://app:3000}"
echo "Waiting for app at ${APP_BASE_URL}..."
for _ in $(seq 1 90); do
	if curl -fsS "${APP_BASE_URL}/landing" >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

echo "Importing initial SportsDeck data..."
node ./lib/startup.js

if [ -n "${REDIS_URL:-}" ]; then
	echo "Clearing sports data caches..."
	node --input-type=module - <<'EOF'
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
	process.exit(0);
}

const client = createClient({ url: redisUrl });
await client.connect();

for (const pattern of ['teams:*', 'matches:*', 'standings:*', 'digest:*', 'route-cache:*']) {
	const keys = await client.keys(pattern);
	if (keys.length > 0) {
		await client.del(keys);
	}
}

await client.quit();
EOF
fi

echo "Import complete."
