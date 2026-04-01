import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { isValidTeamConference, normalizeTeamConference } from "@/app/utils/teamConference";
import { withRedisRouteCache } from "@/app/utils/routeCache";

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

function resolveVenueLabel(storedVenue, homeTeamName) {
  if (storedVenue) {
    return storedVenue;
  }

  return TEAM_HOME_CITY_LABELS[homeTeamName] || null;
}

export async function GET(request, context) {
  return withRedisRouteCache(request, async () => {
  const params = await context.params;
  const teamId = Number(params?.id);

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "Invalid team id." }, { status: 400 });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: {
            fans: true,
            matchesHome: true,
            matchesAway: true,
          },
        },
        matchesHome: {
          orderBy: { date: "desc" },
          take: 4,
          select: {
            id: true,
            date: true,
            status: true,
            homeScore: true,
            awayScore: true,
            venue: true,
            awayTeam: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        matchesAway: {
          orderBy: { date: "desc" },
          take: 4,
          select: {
            id: true,
            date: true,
            status: true,
            homeScore: true,
            awayScore: true,
            venue: true,
            homeTeam: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    if (!isValidTeamConference(team.conference)) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const threadWhere = {
      isVisible: true,
      OR: [
        { teamId },
        {
          match: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
        },
      ],
    };

    const [recentThreads, totalThreadCount] = await Promise.all([
      prisma.thread.findMany({
        where: threadWhere,
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          isClosed: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
              reports: true,
            },
          },
        },
      }),
      prisma.thread.count({
        where: threadWhere,
      }),
    ]);

    const matches = [
      ...team.matchesHome.map((match) => ({
        id: match.id,
        date: match.date?.toISOString?.() || null,
        status: match.status,
        venue: resolveVenueLabel(match.venue, team.name),
        isHome: true,
        opponent: match.awayTeam,
        teamScore: match.homeScore,
        opponentScore: match.awayScore,
      })),
      ...team.matchesAway.map((match) => ({
        id: match.id,
        date: match.date?.toISOString?.() || null,
        status: match.status,
        venue: resolveVenueLabel(match.venue, match.homeTeam?.name),
        isHome: false,
        opponent: match.homeTeam,
        teamScore: match.awayScore,
        opponentScore: match.homeScore,
      })),
    ]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 6);

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        wins: team.wins,
        losses: team.losses,
        conference: normalizeTeamConference(team.conference) || team.conference,
        division: team.division,
        createdAt: team.createdAt?.toISOString?.() || null,
        counts: {
          fans: team._count.fans,
          threads: totalThreadCount,
          matches: team._count.matchesHome + team._count.matchesAway,
        },
        threads: recentThreads.map((thread) => ({
          ...thread,
          createdAt: thread.createdAt?.toISOString?.() || null,
        })),
        matches,
      },
    });
  } catch (error) {
    console.error("Error fetching team detail:", error);
    return NextResponse.json({ error: "Failed to load team." }, { status: 500 });
  }
  }, { namespace: "team-detail", ttlSeconds: 60 * 10 });
}
