import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { getRedisClient } from "@/app/utils/redis";
import {
  parseDateInput,
  extractGames,
  matchPassesFilters,
  fetchExternal,
  normalizeScore,
  parseStageFromGame,
} from "../../utils/utils.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_ORDER = ["preseason", "regular", "playoffs"];
const VALID_STAGES = new Set(["regular", "preseason", "playoffs"]);
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const REDIS_MATCHES_DEFAULT_TTL_SECONDS = 60 * 60;
const REDIS_MATCHES_LIVE_TTL_SECONDS = 60 * 60;
const REDIS_MATCHES_PAST_TTL_SECONDS = 60 * 60;
const TEAM_HOME_CITY_LABELS = {
  "Atlanta Hawks": "Atlanta, GA",
  "Hawks": "Atlanta, GA",
  "Boston Celtics": "Boston, MA",
  "Celtics": "Boston, MA",
  "Brooklyn Nets": "Brooklyn, NY",
  "Nets": "Brooklyn, NY",
  "Charlotte Hornets": "Charlotte, NC",
  "Hornets": "Charlotte, NC",
  "Chicago Bulls": "Chicago, IL",
  "Bulls": "Chicago, IL",
  "Cleveland Cavaliers": "Cleveland, OH",
  "Cavaliers": "Cleveland, OH",
  "Cavs": "Cleveland, OH",
  "Dallas Mavericks": "Dallas, TX",
  "Mavericks": "Dallas, TX",
  "Mavs": "Dallas, TX",
  "Denver Nuggets": "Denver, CO",
  "Nuggets": "Denver, CO",
  "Detroit Pistons": "Detroit, MI",
  "Pistons": "Detroit, MI",
  "Golden State Warriors": "San Francisco, CA",
  "Warriors": "San Francisco, CA",
  "Houston Rockets": "Houston, TX",
  "Rockets": "Houston, TX",
  "Indiana Pacers": "Indianapolis, IN",
  "Pacers": "Indianapolis, IN",
  "LA Clippers": "Los Angeles, CA",
  "Los Angeles Clippers": "Los Angeles, CA",
  "Clippers": "Los Angeles, CA",
  "Los Angeles Lakers": "Los Angeles, CA",
  "Lakers": "Los Angeles, CA",
  "Memphis Grizzlies": "Memphis, TN",
  "Grizzlies": "Memphis, TN",
  "Miami Heat": "Miami, FL",
  "Heat": "Miami, FL",
  "Milwaukee Bucks": "Milwaukee, WI",
  "Bucks": "Milwaukee, WI",
  "Minnesota Timberwolves": "Minneapolis, MN",
  "Timberwolves": "Minneapolis, MN",
  "Wolves": "Minneapolis, MN",
  "New Orleans Pelicans": "New Orleans, LA",
  "Pelicans": "New Orleans, LA",
  "New York Knicks": "New York, NY",
  "Knicks": "New York, NY",
  "Oklahoma City Thunder": "Oklahoma City, OK",
  "Thunder": "Oklahoma City, OK",
  "Orlando Magic": "Orlando, FL",
  "Magic": "Orlando, FL",
  "Philadelphia 76ers": "Philadelphia, PA",
  "76ers": "Philadelphia, PA",
  "Sixers": "Philadelphia, PA",
  "Phoenix Suns": "Phoenix, AZ",
  "Suns": "Phoenix, AZ",
  "Portland Trail Blazers": "Portland, OR",
  "Trail Blazers": "Portland, OR",
  "Blazers": "Portland, OR",
  "Sacramento Kings": "Sacramento, CA",
  "Kings": "Sacramento, CA",
  "San Antonio Spurs": "San Antonio, TX",
  "Spurs": "San Antonio, TX",
  "Toronto Raptors": "Toronto, ON",
  "Raptors": "Toronto, ON",
  "Utah Jazz": "Salt Lake City, UT",
  "Jazz": "Salt Lake City, UT",
  "Washington Wizards": "Washington, DC",
  "Wizards": "Washington, DC",
};
const TEAM_NAME_ALIASES = {
  Hawks: "Atlanta Hawks",
  Celtics: "Boston Celtics",
  Nets: "Brooklyn Nets",
  Hornets: "Charlotte Hornets",
  Bulls: "Chicago Bulls",
  Cavaliers: "Cleveland Cavaliers",
  Cavs: "Cleveland Cavaliers",
  Mavericks: "Dallas Mavericks",
  Mavs: "Dallas Mavericks",
  Nuggets: "Denver Nuggets",
  Pistons: "Detroit Pistons",
  Warriors: "Golden State Warriors",
  Rockets: "Houston Rockets",
  Pacers: "Indiana Pacers",
  Clippers: "Los Angeles Clippers",
  "LA Clippers": "Los Angeles Clippers",
  Lakers: "Los Angeles Lakers",
  Grizzlies: "Memphis Grizzlies",
  Heat: "Miami Heat",
  Bucks: "Milwaukee Bucks",
  Timberwolves: "Minnesota Timberwolves",
  Wolves: "Minnesota Timberwolves",
  Pelicans: "New Orleans Pelicans",
  Knicks: "New York Knicks",
  Thunder: "Oklahoma City Thunder",
  Magic: "Orlando Magic",
  "76ers": "Philadelphia 76ers",
  Sixers: "Philadelphia 76ers",
  Suns: "Phoenix Suns",
  "Trail Blazers": "Portland Trail Blazers",
  Blazers: "Portland Trail Blazers",
  Kings: "Sacramento Kings",
  Spurs: "San Antonio Spurs",
  Raptors: "Toronto Raptors",
  Jazz: "Utah Jazz",
  Wizards: "Washington Wizards",
};

function canonicalizeTeamName(name) {
  if (!name) {
    return null;
  }

  return TEAM_NAME_ALIASES[name] || name;
}

function getNbaSeasonYearForDate(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return String(new Date().getUTCFullYear());
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return String(month >= 8 ? year : year - 1);
}

function getCandidateSeasonYearsForDate(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return [String(new Date().getUTCFullYear())];
  }

  return [...new Set([
    String(date.getUTCFullYear()),
    getNbaSeasonYearForDate(date),
  ])];
}

async function fetchExternalMatchesPayloadsForDate(isoDate) {
  const targetDate = new Date(`${isoDate}T00:00:00.000Z`);
  const seasonCandidates =
    process.env.NODE_ENV === "test"
      ? [getNbaSeasonYearForDate(targetDate)]
      : getCandidateSeasonYearsForDate(targetDate);
  const failures = [];

  const payloads = await Promise.all(
    seasonCandidates.map(async (season) => {
      try {
        return await fetchExternal("/matches", {
          league: "NBA",
          season,
          date: isoDate,
          limit: "100",
          offset: "0",
        });
      } catch (error) {
        failures.push(error);
        return null;
      }
    }),
  );

  const successfulPayloads = payloads.filter(Boolean);
  if (successfulPayloads.length > 0) {
    return successfulPayloads;
  }

  throw failures[0] || new Error(`Failed to fetch upstream matches for ${isoDate}.`);
}

function resolveVenueLabel(storedVenue, homeTeamName) {
  if (storedVenue) {
    return storedVenue;
  }

  return TEAM_HOME_CITY_LABELS[homeTeamName] || null;
}

function deriveInternalMatchState(rawStatus, tipOffDate) {
  const normalizedStatus = String(rawStatus || "").toLowerCase();
  const isFinished = /(finished|end period|ft)/.test(normalizedStatus);
  const isLive = /(in progress|half time|live|q[1-4]|ot)/.test(normalizedStatus);

  return {
    status: isFinished ? "finished" : isLive ? "live" : "scheduled",
    endedAt: isFinished ? new Date(tipOffDate.getTime() + THREE_HOURS_MS) : null,
  };
}

// just gets admins user id to use as the author for the main thread post when we upsert matches into the database. 
async function getSystemUserId() {
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (adminUser) return adminUser.id;

  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  return anyUser?.id ?? null;
}

// handles array of numbers for scores returned by external API (sums them up to get total score per match) 
function sumPeriodScores(periods) {
  if (!Array.isArray(periods)) return null;
  const total = periods.reduce((sum, value) => sum + (Number(value) || 0), 0);
  return Number.isFinite(total) ? total : null;
}

function getTeamScore(team, fallbackKey) {
  return (
    sumPeriodScores(team?.periods) ??
    sumPeriodScores(team?.scores) ??
    normalizeScore(team?.score) ??
    normalizeScore(team?.[fallbackKey]) ??
    null
  );
}

// The api can return some weird inputs, so this function tries to normalize them into something more readable
function normalizeMatch(game) {
  return {
    matchId: String(game.id),
    homeTeam: canonicalizeTeamName(game.homeTeam?.displayName || game.homeTeam?.name || null),
    awayTeam: canonicalizeTeamName(game.awayTeam?.displayName || game.awayTeam?.name || null),
    homeTeamLogoUrl: game.homeTeam?.logo || game.homeTeam?.logoUrl || null,
    awayTeamLogoUrl: game.awayTeam?.logo || game.awayTeam?.logoUrl || null,
    tipOff: game.date || null,
    status: game.state?.description || game.state?.name || game.status || null,
    score: {
      home:
        sumPeriodScores(game.state?.score?.homeTeam) ??
        getTeamScore(game.homeTeam, "homeScore") ??
        normalizeScore(game.homeScore),
      away:
        sumPeriodScores(game.state?.score?.awayTeam) ??
        getTeamScore(game.awayTeam, "awayScore") ??
        normalizeScore(game.awayScore),
    },
    venue: game.venue?.name || game.venue || game.arena?.name || null,
    stage: parseStageFromGame(game),
    homeTeamExternalId: game.homeTeam?.id ? String(game.homeTeam.id) : null,
    awayTeamExternalId: game.awayTeam?.id ? String(game.awayTeam.id) : null,
  };
}


// This function fetches matches from the external API based on the provided filters, normalizes them, and applies additional filtering logic, just to clean the data up a bit more.
async function fetchMatchesFromApi({ parsedDate, stage, teamId }) {
  const isoDate = parsedDate?.isoDate || new Date().toISOString().slice(0, 10);
  const payloads = await fetchExternalMatchesPayloadsForDate(isoDate);
  const seen = new Set();

  return payloads
    .flatMap((payload) => extractGames(payload))
    .map(normalizeMatch)
    .filter((match) => {
      const dedupeKey =
        match.matchId || `${match.homeTeam}|${match.awayTeam}|${match.tipOff || ""}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    })
    .filter((match) => match.homeTeam && match.awayTeam)
    .filter((match) => matchPassesFilters(match, { parsedDate, stage, teamId }));
}

// This function takes a list of matches that is already cleaned and applies some logic to determine what matchdays and stages are available in that list.
function buildDiscoveryMetadata(matches) {
  const availableMatchdays = [...new Set(
    matches
      .map((match) => (match.tipOff ? String(match.tipOff).slice(0, 10) : null))
      .filter(Boolean),
  )].sort();

  const stageSet = new Set(
    matches
      .map((match) => match.stage)
      .filter((value) => VALID_STAGES.has(value)),
  );
  const availableStages = STAGE_ORDER.filter((stage) => stageSet.has(stage));

  return { availableMatchdays, availableStages };
}

// This function generates a list of ISO date strings between the provided start and end dates, inclusive. It's used to fetch matches for multiple days when a date range is provided. (We want to use this logic to fetch matches upto 2 weeks in advance to save API calls)
function enumerateIsoDates(startIsoDate, endIsoDate) {
  const dates = [];
  const cursor = new Date(`${startIsoDate}T00:00:00.000Z`);
  const end = new Date(`${endIsoDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

// This function checks if a timestamp falls within a given date range. Its used in the filtering logic to ensure that matches returned from the API actually fall within the requested date range, this is done as a precaution in case the api fails to give correct data for some reason
function inIsoDateRange(isoTimestamp, dateRange) {
  if (!dateRange) {
    return true;
  }
  if (!isoTimestamp) {
    return false;
  }
  const day = String(isoTimestamp).slice(0, 10);
  return day >= dateRange.startIsoDate && day <= dateRange.endIsoDate;
}

// This function validates and parses a given date range, ensuring that they are provided together, correctly formatted, and within a reasonable range (not exceeding 14 days). It returns an object with the parsed start and end dates if valid, or an error message if invalid. This is used to validate the fromDate and toDate query parameters when fetching matches for a date range. (We want to limit the date range to 2 weeks to prevent excessive API calls and ensure performance)
function parseDateRange(fromDate, toDate) {
  if (!fromDate && !toDate) {
    return null;
  }
  if (!fromDate || !toDate) {
    return { error: "Provide both fromDate and toDate." };
  }

  const parsedFrom = parseDateInput(fromDate);
  const parsedTo = parseDateInput(toDate);
  if (!parsedFrom || !parsedTo) {
    return { error: "Invalid date range. Use YYYY-MM-DD for fromDate and toDate." };
  }

  const fromTs = new Date(`${parsedFrom.isoDate}T00:00:00.000Z`).getTime();
  const toTs = new Date(`${parsedTo.isoDate}T00:00:00.000Z`).getTime();
  if (toTs < fromTs) {
    return { error: "toDate must be on or after fromDate." };
  }

  const dayCount = Math.floor((toTs - fromTs) / DAY_MS) + 1;
  if (dayCount > 14) {
    return { error: "Date range cannot exceed 14 days." };
  }

  return {
    startIsoDate: parsedFrom.isoDate,
    endIsoDate: parsedTo.isoDate,
    dayCount,
  };
}

// This function applies the date range logic which the above functions provide and extends it to fetch matches from the NBA/NCAA API we have in a time frame (like up to 2 weeks in advance). 
// It fetches matches for each day in the range, normalizes and filters them, and combines them into a single list while deduplicating any matches that may appear on multiple days (due to API inconsistencies). Finally, it sorts the combined list by tip-off time before returning it.
async function fetchMatchesFromApiByDateRange({ dateRange, stage, teamId }) {
  const isoDates = enumerateIsoDates(dateRange.startIsoDate, dateRange.endIsoDate);
  const payloadGroups = await Promise.all(
    isoDates.map((isoDate) =>
      fetchExternalMatchesPayloadsForDate(isoDate),
    ),
  );

  const seen = new Set();
  const combined = [];
  for (const payloads of payloadGroups) {
    for (const payload of payloads) {
      for (const game of extractGames(payload)) {
        const normalized = normalizeMatch(game);
        if (!normalized.homeTeam || !normalized.awayTeam) {
          continue;
        }

        const dedupeKey =
          normalized.matchId || `${normalized.homeTeam}|${normalized.awayTeam}|${normalized.tipOff || ""}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        if (!matchPassesFilters(normalized, { parsedDate: null, stage, teamId })) {
          continue;
        }
        if (!inIsoDateRange(normalized.tipOff, dateRange)) {
          continue;
        }

        combined.push(normalized);
      }
    }
  }

  return combined.sort((a, b) => String(a.tipOff || "").localeCompare(String(b.tipOff || "")));
}

// This function checks if a team with the given name exists in the database, and if not, creates it. It uses a cache to minimize database queries for teams that have already been looked up or created during the processing of multiple matches. This is used when upserting matches into the database to ensure that we have valid team IDs for the home and away teams.
// This helps save unnecessary api calls to the database for teams that have already been stored in it. Also helps manage external API usage better.
async function getOrCreateTeamId(teamName, teamLogoUrl, teamCache) {
  const canonicalName = canonicalizeTeamName(teamName);
  if (!canonicalName) {
    return null;
  }

  if (teamCache.has(canonicalName)) {
    return teamCache.get(canonicalName);
  }

  const existing = await prisma.team.findFirst({
    where: {
      OR: [
        { name: canonicalName },
        { name: teamName },
      ],
    },
    select: { id: true, logoUrl: true },
  });
  if (existing) {
    if (teamLogoUrl && existing.logoUrl !== teamLogoUrl) {
      await prisma.team.update({
        where: { id: existing.id },
        data: { logoUrl: teamLogoUrl },
      });
    }
    teamCache.set(canonicalName, existing.id);
    return existing.id;
  }

  const created = await prisma.team.create({
    data: {
      name: canonicalName,
      logoUrl: teamLogoUrl,
      wins: 0,
      losses: 0,
      conference: "Unknown",
      division: "Unknown",
    },
    select: { id: true },
  });

  teamCache.set(canonicalName, created.id);
  return created.id;
}

// This function takes a list of matches and upserts them into the database. 
// For each match, it ensures that the home and away teams exist in the database (creating them if necessary), then checks if a match with the same home team, away team, and date already exists. 
// If it does, it updates that match's details; if not, it creates a new match record. This is used to keep our local database in sync with the latest data from the external API.
async function upsertMatchesIntoDb(matches) {
  const teamCache = new Map();
  const systemUserId = await getSystemUserId();
  const now = new Date();
  const nowUtcDayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  for (const match of matches) {
    if (!match.homeTeam || !match.awayTeam || !match.tipOff) {
      continue;
    }

    const matchDate = new Date(match.tipOff);
    if (Number.isNaN(matchDate.getTime())) {
      continue;
    }

    const tipOffMs = matchDate.getTime();
    const tipOffUtcDayStartMs = Date.UTC(
      matchDate.getUTCFullYear(),
      matchDate.getUTCMonth(),
      matchDate.getUTCDate(),
    );
    const latestAllowedTipOffDayStartMs = nowUtcDayStartMs + 14 * DAY_MS;

    if (tipOffUtcDayStartMs > latestAllowedTipOffDayStartMs) {
      continue;
    }

    const opensAt = new Date(tipOffUtcDayStartMs - 14 * DAY_MS);
    const closesAt = tipOffMs + TWO_WEEKS_MS;
    if (closesAt < Date.now()) {
      continue;
    }

    const [homeTeamId, awayTeamId] = await Promise.all([
      getOrCreateTeamId(match.homeTeam, match.homeTeamLogoUrl, teamCache),
      getOrCreateTeamId(match.awayTeam, match.awayTeamLogoUrl, teamCache),
    ]);

    const { status, endedAt } = deriveInternalMatchState(match.status, matchDate);
    // uses upsert to avoid creating duplicate matches if the same match appears in multiple API responses (e.g. if user queries by date and stage separately) 
    // or if the same match is returned again in a later refresh
    const persistedMatch = await prisma.match.upsert({
      where: {
        homeTeamId_awayTeamId_date: {
          homeTeamId,
          awayTeamId,
          date: matchDate,
        },
      },
      update: {
        homeScore: match.score.home,
        awayScore: match.score.away,
        venue: match.venue,
        date: matchDate,
        status,
        endedAt,
      },
      create: {
        homeTeamId,
        awayTeamId,
        date: matchDate,
        venue: match.venue,
        homeScore: match.score.home,
        awayScore: match.score.away,
        status,
        endedAt,
      },
    });

    if (systemUserId === null) {
      continue;
    }

    await ensurePersistedMatchThread({
      persistedMatchId: persistedMatch.id,
      persistedDate:
        persistedMatch?.date && !Number.isNaN(new Date(persistedMatch.date).getTime())
          ? new Date(persistedMatch.date)
          : matchDate,
      endedAt,
      homeTeamName: match.homeTeam,
      awayTeamName: match.awayTeam,
      systemUserId,
      nowMs: Date.now(),
    });
  }
}

async function ensurePersistedMatchThread({
  persistedMatchId,
  persistedDate,
  endedAt,
  homeTeamName,
  awayTeamName,
  systemUserId,
  nowMs = Date.now(),
}) {
  if (!persistedMatchId || !persistedDate || !systemUserId || !homeTeamName || !awayTeamName) {
    return false;
  }

  const tipOffMs = persistedDate.getTime();
  const opensAt = new Date(tipOffMs - TWO_WEEKS_MS);
  const effectiveEndMs = endedAt ? endedAt.getTime() : tipOffMs + THREE_HOURS_MS;
  const closesAt = new Date(effectiveEndMs + TWO_WEEKS_MS);
  const title = `${awayTeamName} at ${homeTeamName} - ${persistedDate.toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  })}`;

  const existingThreads = await prisma.thread.findMany({
    where: { matchId: persistedMatchId },
    select: { id: true },
  });

  if (existingThreads.length > 0) {
    await prisma.thread.updateMany({
      where: { matchId: persistedMatchId },
      data: {
        title,
        opensAt,
        closesAt,
        isClosed: closesAt.getTime() < nowMs,
      },
    });
    return false;
  }

  const mainPost = await prisma.post.create({
    data: {
      content: `Discussion thread for ${awayTeamName} at ${homeTeamName}.`,
      authorId: systemUserId,
    },
    select: { id: true },
  });
  const newCreatedThread = await prisma.thread.create({
    data: {
      title,
      mainPostId: mainPost.id,
      createdById: systemUserId,
      matchId: persistedMatchId,
      opensAt,
      closesAt,
      isClosed: closesAt.getTime() < nowMs,
      tags: {
        create: [homeTeamName, awayTeamName]
          .filter(Boolean)
          .map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })),
      },
    },
    select: { id: true },
  });
  await prisma.post.update({
    where: { id: mainPost.id },
    data: { threadId: newCreatedThread.id },
  });
  return true;
}

async function healMissingMatchThreads(matchIds) {
  const normalizedIds = [...new Set(
    (Array.isArray(matchIds) ? matchIds : [])
      .map((matchId) => Number(matchId))
      .filter((matchId) => Number.isInteger(matchId) && matchId > 0),
  )];
  if (normalizedIds.length === 0) {
    return 0;
  }

  const systemUserId = await getSystemUserId();
  if (!systemUserId) {
    return 0;
  }

  const persistedMatches = await prisma.match.findMany({
    where: { id: { in: normalizedIds } },
    select: {
      id: true,
      date: true,
      endedAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      threads: { select: { id: true }, take: 1 },
    },
  });

  let createdCount = 0;
  for (const persistedMatch of persistedMatches) {
    if (persistedMatch.threads.length > 0) {
      continue;
    }

    const created = await ensurePersistedMatchThread({
      persistedMatchId: persistedMatch.id,
      persistedDate: persistedMatch.date,
      endedAt: persistedMatch.endedAt,
      homeTeamName: persistedMatch.homeTeam?.name,
      awayTeamName: persistedMatch.awayTeam?.name,
      systemUserId,
    });
    if (created) {
      createdCount += 1;
    }
  }

  return createdCount;
}

// This function reads matches stored in the database that were requested and added earlier. 
// It applies the same filtering logic as the API fetch function to ensure that the matches returned from the database match the requested filters (date, stage, team). 
// This is used to serve cached match data from our local database when available, which can improve performance and reduce reliance on the external API for frequently accessed data.
async function readMatchesFromDb({ parsedDate, dateRange, teamId, stage, limit = 200, orderBy = "desc" }) {
  const where = {};

  if (dateRange) {
    const start = new Date(`${dateRange.startIsoDate}T00:00:00.000Z`);
    const end = new Date(`${dateRange.endIsoDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    where.date = { gte: start, lt: end };
  } else if (parsedDate?.isoDate) {
    const start = new Date(`${parsedDate.isoDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.date = { gte: start, lt: end };
  }

  const numericTeamId = Number(teamId);
  if (teamId && Number.isInteger(numericTeamId) && numericTeamId > 0) {
    where.OR = [{ homeTeamId: numericTeamId }, { awayTeamId: numericTeamId }];
  }

  const rows = await prisma.match.findMany({
    where,
    include: {
      homeTeam: { select: { id: true, name: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, logoUrl: true } },
      sentiment: {
        select: {
          overall: true,
          numPosts: true,
        },
      },
      threads: {
        select: {
          id: true,
          isClosed: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { date: orderBy },
    take: limit,
  });

  return rows
    .map((row) => ({
      matchId: String(row.id),
      id: row.id,
      homeTeam: row.homeTeam?.name || null,
      awayTeam: row.awayTeam?.name || null,
      tipOff: row.date?.toISOString?.() || null,
      status: row.status || null,
      score: { home: row.homeScore, away: row.awayScore },
      venue: resolveVenueLabel(row.venue, row.homeTeam?.name),
      stage: stage || "regular",
      homeTeamId: row.homeTeam?.id ?? null,
      awayTeamId: row.awayTeam?.id ?? null,
      homeTeamLogoUrl: row.homeTeam?.logoUrl || null,
      awayTeamLogoUrl: row.awayTeam?.logoUrl || null,
      sentiment: row.sentiment
        ? {
            overall: row.sentiment.overall,
            numPosts: row.sentiment.numPosts,
          }
        : null,
      thread: Array.isArray(row.threads) && row.threads[0]
        ? {
            id: row.threads[0].id,
            isClosed: row.threads[0].isClosed,
          }
        : null,
    }))
    .filter((match) => match.homeTeam && match.awayTeam);
}

function buildMatchesCacheKey({ parsedDate, dateRange, stage, teamId, limit }) {
  return [
    "matches",
    parsedDate?.isoDate || "none",
    dateRange?.startIsoDate || "none",
    dateRange?.endIsoDate || "none",
    stage || "all",
    teamId || "all",
    String(limit || 24),
  ].join(":");
}

function getMatchesCacheTtlSeconds({ parsedDate, dateRange }) {
  const nowIsoDate = new Date().toISOString().slice(0, 10);

  if (parsedDate?.isoDate === nowIsoDate) {
    return REDIS_MATCHES_LIVE_TTL_SECONDS;
  }

  if (dateRange?.endIsoDate && dateRange.endIsoDate < nowIsoDate) {
    return REDIS_MATCHES_PAST_TTL_SECONDS;
  }

  return REDIS_MATCHES_DEFAULT_TTL_SECONDS;
}

async function attachDbSentiment(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  if (typeof prisma?.sentiment?.findMany !== "function") {
    return matches;
  }

  const matchIds = [...new Set(
    matches
      .map((match) => (typeof match?.id === "number" && Number.isFinite(match.id) ? match.id : null))
      .filter((id) => id !== null),
  )];

  if (matchIds.length === 0) {
    return matches;
  }

  const sentiments = await prisma.sentiment.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      overall: true,
      numPosts: true,
    },
  });

  const sentimentByMatchId = new Map(
    sentiments.map((sentiment) => [
      sentiment.matchId,
      {
        overall: sentiment.overall,
        numPosts: sentiment.numPosts,
      },
    ]),
  );

  return matches.map((match) => ({
    ...match,
    sentiment: sentimentByMatchId.get(match.id) ?? null,
  }));
}

// This is the main GET request handler for this endpoint. It processes every input and accordingly calls the helpers defined above. It returns the matches that are requested based on the filters provided, and also includes metadata about what matchdays and stages are available in the returned data. It also implements error handling and a fallback mechanism to serve cached data from the database if the external API call fails.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const stage = searchParams.get("stage");
  const teamId = searchParams.get("teamId");
  const forceRefresh = searchParams.get("refresh") === "true";
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 24;
  const hasFilters = Boolean(date || stage || fromDate || toDate || teamId);

  if (!hasFilters) {
    return NextResponse.json({ error: "Provide at least one filter: date or stage." }, { status: 400 });
  }

  if (date && (fromDate || toDate)) {
    return NextResponse.json({ error: "Use either date or fromDate/toDate, not both." }, { status: 400 });
  }

  const parsedDate = parseDateInput(date);
  if (date && !parsedDate) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }
  const dateRange = parseDateRange(fromDate, toDate);
  if (dateRange?.error) {
    return NextResponse.json({ error: dateRange.error }, { status: 400 });
  }

  if (stage && !VALID_STAGES.has(stage)) {
    return NextResponse.json(
      { error: "Invalid stage. Use regular, preseason, or playoffs." },
      { status: 400 },
    );
  }

  const filters = {
    date: parsedDate?.isoDate || null,
    fromDate: dateRange?.startIsoDate || null,
    toDate: dateRange?.endIsoDate || null,
    stage: stage || null,
    teamId: teamId || null,
  };
  const cacheKey = buildMatchesCacheKey({ parsedDate, dateRange, stage, teamId, limit });
  const cacheTtlSeconds = getMatchesCacheTtlSeconds({ parsedDate, dateRange });

  try {
    let redis = null;
    if (!forceRefresh) {
      try {
        redis = await getRedisClient();
        const cachedPayload = await redis.get(cacheKey);
        if (cachedPayload) {
          const parsedPayload = JSON.parse(cachedPayload);
          const cachedMatchIdsMissingThreads = (Array.isArray(parsedPayload?.matches) ? parsedPayload.matches : [])
            .filter((match) => typeof match?.id === "number" && !match?.thread?.id)
            .map((match) => match.id);
          const healedCount = await healMissingMatchThreads(cachedMatchIdsMissingThreads);
          if (healedCount === 0) {
            return NextResponse.json({
              ...parsedPayload,
              matches: await attachDbSentiment(parsedPayload.matches),
            });
          }
        }
      } catch (redisError) {
        console.error("Redis matches cache read failed:", redisError);
      }
    }

    if (!forceRefresh) {
      const dbMatches = await readMatchesFromDb({
        parsedDate,
        dateRange,
        teamId,
        stage,
        limit,
        orderBy: hasFilters ? "desc" : "asc",
      });
      if (dbMatches.length > 0) {
        const healedCount = await healMissingMatchThreads(dbMatches.map((match) => match.id));
        const hydratedDbMatches = healedCount > 0
          ? await readMatchesFromDb({
              parsedDate,
              dateRange,
              teamId,
              stage,
              limit,
              orderBy: hasFilters ? "desc" : "asc",
            })
          : dbMatches;
        const matchesWithDbSentiment = await attachDbSentiment(hydratedDbMatches);
        const discovery = buildDiscoveryMetadata(hydratedDbMatches);
        const responsePayload = {
          filters,
          count: hydratedDbMatches.length,
          matches: matchesWithDbSentiment,
          ...discovery,
          dataSource: "database-cache",
        };

        if (redis) {
          try {
            await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: cacheTtlSeconds });
          } catch (redisError) {
            console.error("Redis matches cache write failed:", redisError);
          }
        }

        return NextResponse.json(responsePayload);
      }
    }

    const apiMatches = dateRange
      ? await fetchMatchesFromApiByDateRange({ dateRange, stage, teamId })
      : await fetchMatchesFromApi({ parsedDate, stage, teamId });
    await upsertMatchesIntoDb(apiMatches);

    const refreshedMatches = await readMatchesFromDb({
      parsedDate,
      dateRange,
      teamId,
      stage,
      limit,
      orderBy: hasFilters ? "desc" : "asc",
    });
    const responseMatches = refreshedMatches.length > 0 ? refreshedMatches : apiMatches;
    const matchesWithDbSentiment = await attachDbSentiment(responseMatches);
    const discovery = buildDiscoveryMetadata(responseMatches);

    const responsePayload = {
      filters,
      count: responseMatches.length,
      matches: matchesWithDbSentiment,
      ...discovery,
      dataSource: "external-api",
    };

    try {
      redis ??= await getRedisClient();
      await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: cacheTtlSeconds });
    } catch (redisError) {
      console.error("Redis matches cache write failed:", redisError);
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    try {
      const dbMatches = await readMatchesFromDb({ parsedDate, dateRange, teamId, stage });
      if (dbMatches.length > 0) {
        const matchesWithDbSentiment = await attachDbSentiment(dbMatches);
        const discovery = buildDiscoveryMetadata(dbMatches);
        return NextResponse.json({
          filters,
          count: dbMatches.length,
          matches: matchesWithDbSentiment,
          ...discovery,
          dataSource: "database-fallback",
          warning: "Serving cached DB data because upstream refresh failed.",
        });
      }
    } catch (fallbackError) {
      console.error("DB fallback failed:", fallbackError);
    }

    if (String(error?.message || "").includes("NBA_API_BASE_URL is not configured")) {
      return NextResponse.json({ error: "NBA_API_BASE_URL is not configured." }, { status: 500 });
    }

    if (error?.status) {
      return NextResponse.json(
        { error: "Failed to fetch match data from upstream provider." },
        { status: 502 },
      );
    }

    console.error("Error fetching matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches." }, { status: 500 });
  }
}
