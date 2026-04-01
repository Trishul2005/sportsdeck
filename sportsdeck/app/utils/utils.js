function parseDateInput(date) {
  if (!date) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    isoDate: date,
    year: String(parsed.getUTCFullYear()),
  };
}

function normalizeTeamName(team) {
  if (!team) {
    return null;
  }
  if (typeof team === "string") {
    return team;
  }
  return team.name || team.displayName || team.teamName || team.nickname || null;
}

function normalizeScore(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStageFromGame(game) {
  const raw = String(
    game.stage ||
      game?.state?.name ||
      game?.state?.description ||
      game?.state?.type ||
      game.seasonType ||
      game.season_type ||
      game.phase ||
      "",
  ).toLowerCase();

  if (raw.includes("preseason") || raw === "2") {
    return "preseason";
  }
  if (raw.includes("playoff") || raw === "3") {
    return "playoffs";
  }
  return "regular";
}

function extractGames(payload) {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.data,
    payload.games,
    payload.events,
    payload.response,
    payload.results,
    payload.data?.games,
    payload.data?.events,
    payload.result,
    payload.result?.games,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function matchPassesFilters(match, { parsedDate, stage, teamId }) {
  const onDate = !parsedDate?.isoDate || !match.tipOff || String(match.tipOff).slice(0, 10) === parsedDate.isoDate;
  const onStage = !stage || match.stage === stage;
  const onTeam =
    !teamId ||
    match.homeTeamExternalId === String(teamId) ||
    match.awayTeamExternalId === String(teamId);

  return onDate && onStage && onTeam;
}

function isExternalMockEnabled() {
  return process.env.MOCK_EXTERNAL_APIS === "true";
}

function getMockExternalResponse(path) {
  if (path.startsWith("/teams")) {
    return [];
  }
  if (path.startsWith("/matches")) {
    return { data: [] };
  }
  return {};
}

async function fetchExternal(path, params = {}) {
  if (isExternalMockEnabled()) {
    return getMockExternalResponse(path);
  }

  const baseUrl = process.env.NBA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NBA_API_BASE_URL is not configured.");
  }

  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const headers = {};
  if (process.env.NBA_API_KEY) {
    headers["x-rapidapi-key"] = process.env.NBA_API_KEY;
  }
  if (process.env.NBA_API_HOST) {
    headers["x-rapidapi-host"] = process.env.NBA_API_HOST;
  }

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    const error = new Error(`Upstream API error: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}


export {
    parseDateInput,
    normalizeTeamName,
    normalizeScore,
    parseStageFromGame,
    extractGames,
    matchPassesFilters,
    fetchExternal,
    isExternalMockEnabled,
}
