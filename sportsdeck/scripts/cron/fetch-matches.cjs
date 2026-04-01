#!/usr/bin/env node

/*
 * Cron job: fetch NBA matches by calling the existing app endpoint.
 * This reuses the API route logic for validation, upsert, and thread sync.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

function toIsoDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const baseUrl = (process.env.CRON_BASE_URL || process.env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const now = new Date();
  const pastStart = new Date(now.getTime());
  pastStart.setUTCDate(pastStart.getUTCDate() - 13);
  const pastFromDate = toIsoDate(pastStart);
  const pastToDate = toIsoDate(now);

  const headers = { 'content-type': 'application/json' };

  // Optional shared secret header if you later secure cron-triggered routes.
  if (process.env.CRON_SECRET) {
    headers['x-cron-secret'] = process.env.CRON_SECRET;
  }

  const futureEnd = new Date(now.getTime());
  futureEnd.setUTCDate(futureEnd.getUTCDate() + 13);
  const futureFromDate = toIsoDate(now);
  const futureToDate = toIsoDate(futureEnd);

  const windows = [
    { label: 'past', fromDate: pastFromDate, toDate: pastToDate },
    { label: 'future', fromDate: futureFromDate, toDate: futureToDate },
  ];

  const start = Date.now();
  const results = [];

  for (const window of windows) {
    const params = new URLSearchParams({
      fromDate: window.fromDate,
      toDate: window.toDate,
      stage: 'regular',
      limit: '100',
    });
    const endpoint = `${baseUrl}/api/matches?${params.toString()}`;
    const response = await fetch(endpoint, { headers, method: 'GET' });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = body?.error || `Request failed with status ${response.status}`;
      throw new Error(`Match sync failed for ${window.label} window: ${errorMessage}`);
    }

    results.push({
      label: window.label,
      endpoint,
      fromDate: window.fromDate,
      toDate: window.toDate,
      count: Number(body?.count) || 0,
      source: body?.dataSource || 'unknown',
    });
  }

  const elapsedMs = Date.now() - start;

  console.log(
    JSON.stringify({
      job: 'fetch-matches',
      ok: true,
      windows: results,
      elapsedMs,
      at: new Date().toISOString(),
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      job: 'fetch-matches',
      ok: false,
      error: error?.message || String(error),
      at: new Date().toISOString(),
    }),
  );
  process.exit(1);
});
