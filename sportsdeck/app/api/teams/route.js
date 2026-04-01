import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { getRedisClient } from "@/app/utils/redis";
import { normalizeTeamName, fetchExternal } from "../../utils/utils.js";
import { isValidTeamConference, normalizeTeamConference } from "@/app/utils/teamConference";
import { resolveTeamDivision } from "@/app/utils/teamDivision.js";
import { getFullTeamName } from "@/app/utils/teamNames.js";

const REDIS_TEAMS_TTL_SECONDS = 60 * 60;

function buildTeamsCacheKey(searchParams, limit) {
  return [
    "teams",
    searchParams.get("league") || "NBA",
    searchParams.get("name") || "all",
    searchParams.get("displayName") || "all",
    searchParams.get("abbreviation") || "all",
    String(limit),
  ].join(":");
}

function buildTeamsDbWhere({ name, displayName }) {
  const textFilter = (name || displayName || "").trim();
  const where = {
    conference: { in: ["Eastern Conference", "Western Conference", "Eastern", "Western"] },
  };

  if (textFilter) {
    where.name = {
      contains: textFilter,
    };
  }

  return where;
}

// This endpoint handles fetching team data from the external API, it cleans the data and upserts it into our local database, and then returns the saved team data in the response. It also includes error handling for various failure scenarios, such as missing configuration or issues with the external API.
// This is meant to be used once to populate our database with teams, and then can be used to keep the team data updated by calling it periodically (like once a day or week) since team data doesn't change very frequently. This way we can minimize unnecessary API calls while still keeping our data reasonably fresh.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const nameFilter = searchParams.get("name");
  const displayNameFilter = searchParams.get("displayName");
  const abbreviationFilter = searchParams.get("abbreviation");
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 30;
  const forceRefresh = searchParams.get("refresh") === "true";
  const cacheKey = buildTeamsCacheKey(searchParams, limit);
  const canServeDbFilteredResults = !abbreviationFilter;

  async function readTeamsFromDb() {
    return prisma.team.findMany({
      where: buildTeamsDbWhere({ name: nameFilter, displayName: displayNameFilter }),
      select: {
        id: true,
        name: true,
        logoUrl: true,
        wins: true,
        losses: true,
        conference: true,
        division: true,
      },
      orderBy: [{ wins: "desc" }, { losses: "asc" }, { name: "asc" }],
      take: limit,
    });
  }

  async function syncTeamsIntoDb(rows) {
    const names = [...new Set(rows.map((row) => row?.name).filter(Boolean))];

    if (names.length === 0) {
      return [];
    }

    return prisma.$transaction(async (tx) => {
      const existingTeams = await tx.team.findMany({
        where: { name: { in: names } },
        select: { id: true, name: true },
      });

      const existingByName = new Map(existingTeams.map((team) => [team.name, team.id]));
      const savedTeams = [];

      for (const team of rows) {
        const normalizedConference = normalizeTeamConference(team.conference);
        const canonicalName = team.name ? getFullTeamName(team.name) : null;
        if (!canonicalName) {
          continue;
        }
        const division = resolveTeamDivision(canonicalName, team.division);
        const data = {
          name: canonicalName,
          logoUrl: team.logoUrl,
          conference: normalizedConference,
          division,
        };

        const existingId = existingByName.get(canonicalName);
        if (existingId) {
          const updated = await tx.team.update({
            where: { id: existingId },
            data,
            select: {
              id: true,
              name: true,
              logoUrl: true,
              wins: true,
              losses: true,
              conference: true,
              division: true,
            },
          });
          savedTeams.push(updated);
          continue;
        }

        const created = await tx.team.create({
          data: {
            ...data,
            wins: 0,
            losses: 0,
          },
          select: {
            id: true,
            name: true,
            logoUrl: true,
            wins: true,
            losses: true,
            conference: true,
            division: true,
          },
        });
        existingByName.set(canonicalName, created.id);
        savedTeams.push(created);
      }

      return savedTeams;
    });
  }

  try {
    let redis = null;
    if (!forceRefresh) {
      try {
        redis = await getRedisClient();
        const cachedPayload = await redis.get(cacheKey);
        if (cachedPayload) {
          return NextResponse.json(JSON.parse(cachedPayload));
        }
      } catch (redisError) {
        console.error("Redis teams cache read failed:", redisError);
      }
    }

    const cachedTeams = canServeDbFilteredResults ? await readTeamsFromDb() : [];
    if (!forceRefresh && canServeDbFilteredResults && cachedTeams.length > 0) {
      const responsePayload = {
        count: cachedTeams.length,
        teams: cachedTeams,
        dataSource: "database-cache",
      };

      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: REDIS_TEAMS_TTL_SECONDS });
        } catch (redisError) {
          console.error("Redis teams cache write failed:", redisError);
        }
      }

      return NextResponse.json(responsePayload);
    }

    const payload = await fetchExternal("/teams", {
      league: searchParams.get("league") || "NBA",
      name: nameFilter,
      displayName: displayNameFilter,
      abbreviation: abbreviationFilter,
    });
    console.log(payload);

    const teams = Array.isArray(payload) ? payload : [];
    const normalizedTeams = teams
      .map((team) => {
        const normalizedName = normalizeTeamName(team) || team?.displayName || null;
        const canonicalName = normalizedName ? getFullTeamName(normalizedName) : null;

        return {
          name: canonicalName,
          logoUrl: team?.logo || null,
          conference: normalizeTeamConference(team?.conference) || "Unknown",
          division: canonicalName
            ? resolveTeamDivision(canonicalName, team?.division || "Unknown")
            : "Unknown",
        };
      })
      .filter((team) => team.name && isValidTeamConference(team.conference));

    const savedTeams = await syncTeamsIntoDb(normalizedTeams);

    const responseTeams = (savedTeams.length > 0 ? savedTeams : cachedTeams)
      .sort((a, b) => {
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        if (a.losses !== b.losses) {
          return a.losses - b.losses;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    const responsePayload = {
      count: responseTeams.length,
      teams: responseTeams,
      dataSource: savedTeams.length > 0 ? "external-api" : "database-fallback",
    };

    if (responseTeams.length > 0) {
      try {
        redis ??= await getRedisClient();
        await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: REDIS_TEAMS_TTL_SECONDS });
      } catch (redisError) {
        console.error("Redis teams cache write failed:", redisError);
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    try {
      const fallbackTeams = canServeDbFilteredResults ? await readTeamsFromDb() : [];
      if (canServeDbFilteredResults && fallbackTeams.length > 0) {
        return NextResponse.json({
          count: fallbackTeams.length,
          teams: fallbackTeams,
          dataSource: "database-fallback",
          warning: "Serving cached teams because upstream refresh failed.",
        });
      }
    } catch (fallbackError) {
      console.error("Team DB fallback failed:", fallbackError);
    }

    if (String(error?.message || "").includes("NBA_API_BASE_URL is not configured")) {
      return NextResponse.json({ error: "NBA_API_BASE_URL is not configured." }, { status: 500 });
    }

    if (error?.status) {
      return NextResponse.json(
        { error: "Failed to fetch team data from upstream provider." },
        { status: 502 },
      );
    }

    console.error("Error syncing teams:", error);
    return NextResponse.json({ error: "Failed to sync teams." }, { status: 500 });
  }
}
