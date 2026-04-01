import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { normalizeTeamName, normalizeScore, fetchExternal } from "../../utils/utils.js";
import { normalizeTeamConference } from "@/app/utils/teamConference";
import { resolveTeamDivision } from "@/app/utils/teamDivision.js";
import { getFullTeamName } from "@/app/utils/teamNames.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const STANDINGS_PAGE_SIZE = 64;
const MAX_STANDINGS_PAGES = 5;
const CONFERENCE_BY_ABBREVIATION = {
  EAST: "Eastern Conference",
  WEST: "Western Conference",
};
const EASTERN_DIVISIONS = new Set(["Atlantic", "Central", "Southeast"]);
const WESTERN_DIVISIONS = new Set(["Northwest", "Pacific", "Southwest"]);
const DIVISION_ALIASES = {
  atlantic: "Atlantic",
  central: "Central",
  southeast: "Southeast",
  northwest: "Northwest",
  pacific: "Pacific",
  southwest: "Southwest",
  atlanticdivision: "Atlantic",
  centraldivision: "Central",
  southeastdivision: "Southeast",
  northwestdivision: "Northwest",
  pacificdivision: "Pacific",
  southwestdivision: "Southwest",
};

const DEFAULT_SEASON_TYPE = "Regular Season";

function getCurrentSeasonYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return String(month >= 8 ? year + 1 : year);
}

function getCurrentSeasonStartYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return String(month >= 8 ? year : year - 1);
}

function buildSeasonYearCandidates(requestedYear, hasExplicitYear) {
  if (hasExplicitYear) {
    return [String(requestedYear)];
  }

  return [...new Set([getCurrentSeasonYear(), getCurrentSeasonStartYear()])];
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalizeTeamName(name) {
  const normalizedName = normalizeTeamName(name);
  if (!normalizedName) {
    return null;
  }

  return getFullTeamName(normalizedName);
}

function parseRecord(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    wins: Number(match[1]),
    losses: Number(match[2]),
  };
}

function normalizeDivisionName(division, teamName) {
  const normalizedDivision = DIVISION_ALIASES[normalizeKey(division)];
  if (normalizedDivision) {
    return normalizedDivision;
  }

  const resolvedDivision = resolveTeamDivision(teamName, division);
  return resolvedDivision !== "Unknown" ? resolvedDivision : null;
}

function inferConferenceFromDivision(division) {
  if (EASTERN_DIVISIONS.has(division)) {
    return "Eastern Conference";
  }
  if (WESTERN_DIVISIONS.has(division)) {
    return "Western Conference";
  }

  return null;
}

function normalizeConferenceName(conference, division, fallbackConference) {
  return (
    normalizeTeamConference(conference) ||
    inferConferenceFromDivision(division) ||
    normalizeTeamConference(fallbackConference) ||
    null
  );
}

function findStatValue(statistics, keyPatterns) {
  if (!Array.isArray(statistics)) {
    return null;
  }

  const normalizedStats = statistics.map((entry) => ({
    name: normalizeKey(entry?.name || entry?.displayName),
    value: entry?.value,
  }));

  for (const pattern of keyPatterns) {
    const exact = normalizedStats.find((entry) => entry.name === pattern);
    if (exact) {
      return exact.value;
    }
  }

  const match = normalizedStats.find((entry) => keyPatterns.some((pattern) => entry.name.includes(pattern)));
  return match ? match.value : null;
}

function getNumericFromStats(statistics, keyPatterns) {
  const value = findStatValue(statistics, keyPatterns);
  const parsed = normalizeScore(value);
  return parsed === null ? null : parsed;
}

function getTextFromStats(statistics, keyPatterns) {
  const value = findStatValue(statistics, keyPatterns);
  return value === null || value === undefined ? null : String(value);
}

function normalizeTeamStanding(row, fallbackConference) {
  const team = row?.team || row;
  const stats = row?.statistics || row?.stats || [];
  const name = canonicalizeTeamName(team);
  if (!name) {
    return null;
  }

  const rawRecord =
    getTextFromStats(stats, ["record", "overallrecord", "overall"]) ||
    (typeof row?.record === "string" ? row.record : null);
  const parsedRecord = parseRecord(rawRecord);

  const wins =
    normalizeScore(row?.wins ?? row?.win ?? row?.w) ??
    getNumericFromStats(stats, ["wins", "totalwins", "conferencewins"]) ??
    parsedRecord?.wins;
  const losses =
    normalizeScore(row?.losses ?? row?.loss ?? row?.l) ??
    getNumericFromStats(stats, ["losses", "totallosses", "conferencelosses"]) ??
    parsedRecord?.losses;

  const rank =
    normalizeScore(row?.rank ?? row?.position ?? row?.place) ??
    getNumericFromStats(stats, ["rank", "position", "place", "conferencerank"]);

  const pct =
    normalizeScore(row?.winPercentage ?? row?.pct ?? row?.percentage) ??
    normalizeScore(getTextFromStats(stats, ["winpercentage", "winningpercentage", "percentage", "pct"]));

  const gamesBack =
    normalizeScore(row?.gamesBack ?? row?.gb) ??
    normalizeScore(getTextFromStats(stats, ["gamesback", "gb", "conferencegamesback"]));

  const division = normalizeDivisionName(
    row?.division ||
      row?.divisionName ||
      team?.division,
    name,
  );
  const conference = normalizeConferenceName(
    row?.conference ||
      row?.conferenceName ||
      team?.conference ||
      fallbackConference,
    division,
    fallbackConference,
  );

  return {
    name,
    logoUrl: team?.logo || team?.logoUrl || null,
    abbreviation: team?.abbreviation || null,
    teamId: team?.id ? String(team.id) : null,
    wins: wins ?? 0,
    losses: losses ?? 0,
    rank,
    winPct: pct,
    gamesBack,
    streak: getTextFromStats(stats, ["streak"]),
    homeRecord: getTextFromStats(stats, ["homerecord", "home", "homegames", "homerecords"]),
    awayRecord: getTextFromStats(stats, ["awayrecord", "away", "road", "roadrecord"]),
    lastTenRecord: getTextFromStats(stats, ["last10", "last10games", "lastten", "lasttengames"]),
    pointsFor: getNumericFromStats(stats, ["pointsfor", "pf"]),
    pointsAgainst: getNumericFromStats(stats, ["pointsagainst", "pa"]),
    conference: conference || "Unknown",
    division: division || "Unknown",
    stats,
  };
}

function normalizeApiGroups(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload?.data)) {
    const firstItem = payload.data[0];

    // Some upstream responses are a single season/conference group object:
    // { leagueName, seasonType, data: [{ team, statistics }, ...] }
    // In that case the payload itself is the group we want to normalize.
    if (
      firstItem &&
      (firstItem.team || firstItem.statistics || firstItem.stats)
    ) {
      return [payload];
    }

    // Other upstream responses wrap multiple groups in payload.data.
    return payload.data;
  }

  return [];
}

function pickSeasonGroup(groups, requestedSeasonType) {
  if (!groups.length) {
    return null;
  }

  const requested = normalizeKey(requestedSeasonType || DEFAULT_SEASON_TYPE);

  const exactMatch = groups.find((group) => normalizeKey(group?.seasonType) === requested);
  if (exactMatch) {
    return exactMatch;
  }

  const regularMatch = groups.find((group) => normalizeKey(group?.seasonType) === normalizeKey(DEFAULT_SEASON_TYPE));
  if (regularMatch) {
    return regularMatch;
  }

  return groups[0];
}

export function normalizeStandingsFromPayload(payload, requestedSeasonType) {
  const groups = normalizeApiGroups(payload);
  const selectedGroup = pickSeasonGroup(groups, requestedSeasonType);

  if (!selectedGroup) {
    return {
      selectedGroup: null,
      standings: [],
    };
  }

  const selectedSeasonKey = normalizeKey(selectedGroup?.seasonType || requestedSeasonType || DEFAULT_SEASON_TYPE);
  const groupsForSeason = groups.filter(
    (group) => normalizeKey(group?.seasonType || DEFAULT_SEASON_TYPE) === selectedSeasonKey,
  );
  const sourceGroups = groupsForSeason.length > 0 ? groupsForSeason : [selectedGroup];

  const standings = sourceGroups
    .flatMap((group) => {
      const rows = Array.isArray(group?.data) ? group.data : [];
      return rows.map((row) => normalizeTeamStanding(row, group?.leagueName, group?.leagueName));
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aRank = Number.isFinite(a.rank) ? a.rank : Number.POSITIVE_INFINITY;
      const bRank = Number.isFinite(b.rank) ? b.rank : Number.POSITIVE_INFINITY;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }
      return a.name.localeCompare(b.name);
    });

  return {
    selectedGroup,
    standings,
  };
}

function getExpectedStandingCount(abbreviation) {
  return abbreviation && CONFERENCE_BY_ABBREVIATION[abbreviation] ? 15 : 30;
}

function scoreStandingsCandidate({ selectedGroup, standings }, requestedSeasonType, abbreviation) {
  if (!standings.length) {
    return Number.NEGATIVE_INFINITY;
  }

  const requestedSeasonKey = normalizeKey(requestedSeasonType || DEFAULT_SEASON_TYPE);
  const selectedSeasonKey = normalizeKey(selectedGroup?.seasonType || DEFAULT_SEASON_TYPE);
  const expectedCount = getExpectedStandingCount(abbreviation);
  const leaderGames = standings.reduce(
    (maxGames, row) => Math.max(maxGames, (row?.wins || 0) + (row?.losses || 0)),
    0,
  );
  const totalGames = standings.reduce(
    (sum, row) => sum + Math.max(0, row?.wins || 0) + Math.max(0, row?.losses || 0),
    0,
  );

  let score = standings.length * 100;
  score += totalGames;
  score += leaderGames * 20;

  if (selectedSeasonKey === requestedSeasonKey) {
    score += 10_000;
  }
  if (selectedSeasonKey === normalizeKey(DEFAULT_SEASON_TYPE)) {
    score += 5_000;
  }
  if (standings.length >= expectedCount) {
    score += 1_000;
  }

  return score;
}

function getWinPctFromRecord(wins, losses) {
  const totalGames = wins + losses;
  if (totalGames <= 0) {
    return null;
  }

  return Number((wins / totalGames).toFixed(3));
}

function getGamesBackFromLeader(team, leader) {
  if (!leader) {
    return 0;
  }

  return Number((((leader.wins - team.wins) + (team.losses - leader.losses)) / 2).toFixed(1));
}

function mapStandingForResponse(team, leader, rank) {
  return {
    id: team.id,
    teamId: String(team.id),
    name: team.name,
    logoUrl: team.logoUrl,
    abbreviation: null,
    wins: team.wins,
    losses: team.losses,
    rank,
    winPct: getWinPctFromRecord(team.wins, team.losses),
    gamesBack: getGamesBackFromLeader(team, leader),
    streak: null,
    homeRecord: null,
    awayRecord: null,
    lastTenRecord: null,
    pointsFor: null,
    pointsAgainst: null,
    conference: team.conference,
    division: team.division,
    stats: [],
    refreshedAt: team.createdAt,
  };
}

function resolveConferenceFilter({ abbreviation, leagueName }) {
  if (abbreviation && CONFERENCE_BY_ABBREVIATION[abbreviation]) {
    return CONFERENCE_BY_ABBREVIATION[abbreviation];
  }

  if (leagueName && /conference/i.test(leagueName)) {
    return leagueName;
  }

  return null;
}

async function readStandingsFromDb({ abbreviation, leagueName }) {
  const conferenceFilter = resolveConferenceFilter({ abbreviation, leagueName });
  const where = conferenceFilter ? { conference: conferenceFilter } : {};

  const rows = await prisma.team.findMany({
    where,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      wins: true,
      losses: true,
      conference: true,
      division: true,
      createdAt: true,
    },
    orderBy: [{ wins: "desc" }, { losses: "asc" }, { name: "asc" }],
    take: 64,
  });

  const leader = rows[0] || null;
  return rows.map((row, index) => mapStandingForResponse(row, leader, index + 1));
}

function isFreshCache(rows) {
  if (!rows.length) {
    return false;
  }

  const latestUpdatedAt = rows.reduce((latest, row) => {
    const rowTime = new Date(row.refreshedAt || row.updatedAt || row.createdAt).getTime();
    return Number.isFinite(rowTime) && rowTime > latest ? rowTime : latest;
  }, 0);

  if (!latestUpdatedAt) {
    return false;
  }

  return Date.now() - latestUpdatedAt < CACHE_TTL_MS;
}

function hasUsableStandingsCache(rows) {
  if (rows.length === 0) {
    return false;
  }

  return rows.some((row) => {
    const wins = Number(row?.wins ?? 0);
    const losses = Number(row?.losses ?? 0);
    return wins > 0 || losses > 0;
  });
}

async function fetchStandingsFromApi({ leagueType, abbreviation, leagueName, year, limit, offset }) {
  return fetchExternal("/standings", {
    leagueType,
    abbreviation,
    leagueName,
    year,
    limit: String(limit),
    offset: String(offset),
  });
}

function mergeStandingsPayloadPages(payloadPages) {
  if (!payloadPages.length) {
    return { data: [] };
  }

  const mergedByKey = new Map();
  for (const payload of payloadPages) {
    for (const group of normalizeApiGroups(payload)) {
      const key = [
        normalizeKey(group?.seasonType),
        normalizeKey(group?.abbreviation),
        normalizeKey(group?.leagueName),
        String(group?.year || ""),
      ].join("|");

      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, {
          ...group,
          data: Array.isArray(group?.data) ? [...group.data] : [],
        });
        continue;
      }

      const existing = mergedByKey.get(key);
      const nextRows = Array.isArray(group?.data) ? group.data : [];
      existing.data.push(...nextRows);
    }
  }

  const firstPayload = payloadPages[0];
  const lastPayload = payloadPages[payloadPages.length - 1];

  return {
    ...firstPayload,
    data: [...mergedByKey.values()],
    pagination: {
      ...(lastPayload?.pagination || {}),
      fetchedPages: payloadPages.length,
      pageSize: STANDINGS_PAGE_SIZE,
    },
  };
}

export async function fetchAllStandingsPages({ leagueType, abbreviation, leagueName, year }) {
  const payloadPages = [];

  for (let page = 0; page < MAX_STANDINGS_PAGES; page += 1) {
    const offset = page * STANDINGS_PAGE_SIZE;
    const payload = await fetchStandingsFromApi({
      leagueType,
      abbreviation,
      leagueName,
      year,
      limit: STANDINGS_PAGE_SIZE,
      offset,
    });

    payloadPages.push(payload);

    const groups = normalizeApiGroups(payload);
    const rowsInPage = groups.reduce(
      (sum, group) => sum + (Array.isArray(group?.data) ? group.data.length : 0),
      0,
    );

    if (rowsInPage === 0 || rowsInPage < STANDINGS_PAGE_SIZE) {
      break;
    }
  }

  return mergeStandingsPayloadPages(payloadPages);
}

async function fetchBestStandingsCandidate({
  leagueType,
  abbreviation,
  leagueName,
  year,
  requestedSeasonType,
  hasExplicitYear,
}) {
  const candidateYears = buildSeasonYearCandidates(year, hasExplicitYear);
  let bestCandidate = null;
  let lastError = null;

  for (const candidateYear of candidateYears) {
    try {
      const apiPayload = await fetchAllStandingsPages({
        leagueType,
        abbreviation,
        leagueName,
        year: candidateYear,
      });
      const normalized = normalizeStandingsFromPayload(apiPayload, requestedSeasonType);
      const candidate = {
        apiPayload,
        requestedYear: candidateYear,
        ...normalized,
      };
      const score = scoreStandingsCandidate(candidate, requestedSeasonType, abbreviation);

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          ...candidate,
          score,
        };
      }

      const selectedSeasonKey = normalizeKey(candidate.selectedGroup?.seasonType || DEFAULT_SEASON_TYPE);
      if (
        selectedSeasonKey === normalizeKey(requestedSeasonType || DEFAULT_SEASON_TYPE) &&
        candidate.standings.length > 0
      ) {
        return bestCandidate;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }
  if (lastError) {
    throw lastError;
  }

  return {
    apiPayload: { data: [] },
    requestedYear: year,
    selectedGroup: null,
    standings: [],
    score: Number.NEGATIVE_INFINITY,
  };
}

export async function upsertStandingsIntoDb(rows) {
  const now = new Date();
  const names = [...new Set(rows.map((row) => canonicalizeTeamName(row?.name)).filter(Boolean))];

  if (names.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existingTeams = await tx.team.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
        conference: true,
        division: true,
      },
    });

    const existingByName = new Map(existingTeams.map((team) => [canonicalizeTeamName(team.name), team]));

    for (const row of rows) {
      const canonicalName = canonicalizeTeamName(row.name);
      if (!canonicalName) {
        continue;
      }

      const existingTeam = existingByName.get(canonicalName);
      const resolvedDivision = normalizeDivisionName(row.division, canonicalName);
      const resolvedConference = normalizeConferenceName(
        row.conference,
        resolvedDivision,
        existingTeam?.conference,
      );
      const data = {
        name: canonicalName,
        logoUrl: row.logoUrl || existingTeam?.logoUrl || null,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        conference: resolvedConference || "Unknown",
        division: resolvedDivision || existingTeam?.division || "Unknown",
        createdAt: now,
      };

      if (existingTeam) {
        await tx.team.update({
          where: { id: existingTeam.id },
          data,
        });
        continue;
      }

      const created = await tx.team.create({ data });
      existingByName.set(canonicalName, {
        id: created.id,
        name: canonicalName,
        logoUrl: data.logoUrl,
        conference: data.conference,
        division: data.division,
      });
    }
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leagueType = (searchParams.get("leagueType") || "NBA").toUpperCase();
  const abbreviation = searchParams.get("abbreviation");
  const leagueName = searchParams.get("leagueName");
  const hasExplicitYear = searchParams.has("year");
  const year = searchParams.get("year") || getCurrentSeasonYear();
  const seasonType = searchParams.get("seasonType") || DEFAULT_SEASON_TYPE;
  const forceRefresh = searchParams.get("refresh") === "true";

  if (leagueType !== "NBA") {
    return NextResponse.json({ error: "Only leagueType=NBA is supported by this endpoint." }, { status: 400 });
  }

  const filters = {
    leagueType,
    abbreviation: abbreviation || null,
    leagueName: leagueName || null,
    year,
    seasonType,
  };

  try {
    const dbStandings = await readStandingsFromDb({ abbreviation, leagueName });
    const canServeDbCache = hasUsableStandingsCache(dbStandings) && isFreshCache(dbStandings);

    if (!forceRefresh && canServeDbCache) {
      return NextResponse.json({
        filters,
        leagueName: resolveConferenceFilter({ abbreviation, leagueName }),
        abbreviation: abbreviation || null,
        year,
        seasonType,
        count: dbStandings.length,
        standings: dbStandings,
        dataSource: "database-cache",
      });
    }

    const { apiPayload, requestedYear, selectedGroup, standings } = await fetchBestStandingsCandidate({
      leagueType,
      abbreviation,
      leagueName,
      year,
      requestedSeasonType: seasonType,
      hasExplicitYear,
    });

    await upsertStandingsIntoDb(standings);
    const refreshedStandings = await readStandingsFromDb({ abbreviation, leagueName });
    const responseStandings = refreshedStandings.length > 0 ? refreshedStandings : standings;

    return NextResponse.json({
      filters,
      leagueName: selectedGroup?.leagueName || null,
      abbreviation: selectedGroup?.abbreviation || abbreviation || null,
      year: selectedGroup?.year || requestedYear || year,
      seasonType: selectedGroup?.seasonType || seasonType,
      startDate: selectedGroup?.startDate || null,
      endDate: selectedGroup?.endDate || null,
      count: responseStandings.length,
      standings: responseStandings,
      dataSource: "external-api",
      pagination: apiPayload?.pagination || null,
      plan: apiPayload?.plan || null,
    });
  } catch (error) {
    try {
      const staleStandings = await readStandingsFromDb({ abbreviation, leagueName });
      if (hasUsableStandingsCache(staleStandings)) {
        return NextResponse.json({
          filters,
          leagueName: resolveConferenceFilter({ abbreviation, leagueName }),
          abbreviation: abbreviation || null,
          year,
          seasonType,
          count: staleStandings.length,
          standings: staleStandings,
          dataSource: "database-fallback",
          stale: true,
          warning: "Serving stale standings cache because upstream refresh failed.",
        });
      }
    } catch (fallbackError) {
      console.error("Standings DB fallback failed:", fallbackError);
    }

    console.error("Error fetching standings:", error);
    return NextResponse.json({ error: "Failed to fetch standings." }, { status: 500 });
  }
}
