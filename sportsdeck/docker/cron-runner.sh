#!/usr/bin/env bash
set -euo pipefail

ENABLE_CRON_JOBS="${ENABLE_CRON_JOBS:-true}"
CRON_MATCHES_INTERVAL_SECONDS="${CRON_MATCHES_INTERVAL_SECONDS:-3600}"
CRON_SENTIMENT_INTERVAL_SECONDS="${CRON_SENTIMENT_INTERVAL_SECONDS:-3600}"
APP_BASE_URL="${APP_BASE_URL:-http://app:3000}"

run_loop() {
	local name="$1"
	local interval_seconds="$2"
	local command="$3"

	while true; do
		echo "[$name] Running at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
		if ! eval "$command"; then
			echo "[$name] Warning: run failed; retrying after interval."
		fi
		sleep "$interval_seconds"
	done
}

cleanup() {
	jobs -p | xargs -r kill || true
}

trap cleanup EXIT INT TERM

echo "Waiting for app at ${APP_BASE_URL}..."
for _ in $(seq 1 90); do
	if curl -fsS "${APP_BASE_URL}/landing" >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

if [ "$ENABLE_CRON_JOBS" != "true" ]; then
	echo "Background cron loops are disabled."
	tail -f /dev/null
fi

run_loop "cron:matches" "$CRON_MATCHES_INTERVAL_SECONDS" "npm run cron:matches" &

if [ "${MOCK_EXTERNAL_APIS:-false}" = "true" ] || [ -n "${HF_TOKEN:-}" ]; then
	echo "[cron:sentiment] Running one startup pass before background loop..."
	if ! npm run cron:sentiment; then
		echo "[cron:sentiment] Warning: startup pass failed; continuing with background loop."
	fi
	run_loop "cron:sentiment" "$CRON_SENTIMENT_INTERVAL_SECONDS" "npm run cron:sentiment" &
else
	echo "Skipping cron:sentiment loop (HF_TOKEN is not set)."
fi

wait
