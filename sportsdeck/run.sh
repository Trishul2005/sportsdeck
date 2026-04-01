#!/usr/bin/env bash
set -euo pipefail

ENABLE_CRON_JOBS="${ENABLE_CRON_JOBS:-true}"
CRON_MATCHES_INTERVAL_SECONDS="${CRON_MATCHES_INTERVAL_SECONDS:-3600}"
CRON_SENTIMENT_INTERVAL_SECONDS="${CRON_SENTIMENT_INTERVAL_SECONDS:-3600}"

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
	echo "Stopping background cron loops..."
	jobs -p | xargs -r kill
}

trap cleanup EXIT INT TERM

if [ "$ENABLE_CRON_JOBS" = "true" ]; then
	echo "Starting background cron loops..."
	run_loop "cron:matches" "$CRON_MATCHES_INTERVAL_SECONDS" "npm run cron:matches" &

	if [ "${MOCK_EXTERNAL_APIS:-false}" = "true" ] || [ -n "${HF_TOKEN:-}" ]; then
		run_loop "cron:sentiment" "$CRON_SENTIMENT_INTERVAL_SECONDS" "npm run cron:sentiment" &
	else
		echo "Skipping cron:sentiment loop (HF_TOKEN is not set)."
	fi
else
	echo "Background cron loops are disabled (ENABLE_CRON_JOBS=$ENABLE_CRON_JOBS)."
fi

echo "Starting app in dev mode..."
npm run dev &
DEV_PID=$!

cleanup() {
  if kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Waiting for app to be ready at ${BASE_URL}..."
READY=0
for _ in $(seq 1 90); do
  if curl -fsS "${BASE_URL}/landing" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 1 ]; then
  TODAY_UTC="$(date -u +%F)"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    MATCH_FROM_DATE="$(date -u -v-1d +%F)"
    MATCH_TO_DATE="$(date -u -v+7d +%F)"
  else
    MATCH_FROM_DATE="$(date -u -d '1 day ago' +%F)"
    MATCH_TO_DATE="$(date -u -d '7 days' +%F)"
  fi

  echo "Warming shared Redis-backed API caches..."
  ENDPOINTS=(
    "/api"
    "/api/teams?limit=15"
    "/api/teams/1"
    "/api/threads?includeMeta=true&page=1&pageSize=12"
    "/api/threads/1"
    "/api/threads/1/sentiment"
    "/api/matches?fromDate=${MATCH_FROM_DATE}&toDate=${MATCH_TO_DATE}&limit=12"
    "/api/matches/1"
    "/api/standings?abbreviation=EAST"
    "/api/digest/daily?date=${TODAY_UTC}"
    "/api/poll?page=1&pageSize=10"
    "/api/post?id=1"
    "/api/post/1"
  )

  for endpoint in "${ENDPOINTS[@]}"; do
    echo "  warming ${endpoint}"
    curl -fsS "${BASE_URL}${endpoint}" >/dev/null || true
  done

  echo "Cache warm complete."
else
  echo "App did not become ready in time. Skipping cache warm."
fi

wait "$DEV_PID"
