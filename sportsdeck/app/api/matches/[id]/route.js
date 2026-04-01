import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
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
  const matchId = Number(params?.id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            wins: true,
            losses: true,
            conference: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            wins: true,
            losses: true,
            conference: true,
          },
        },
        threads: {
          where: {
            isVisible: true,
          },
          select: {
            id: true,
            title: true,
            isClosed: true,
            isVisible: true,
            createdAt: true,
            _count: {
              select: {
                posts: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        sentiment: {
          select: {
            overall: true,
            numPosts: true,
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }

    return NextResponse.json({
      match: {
        id: match.id,
        date: match.date?.toISOString?.() || null,
        venue: resolveVenueLabel(match.venue, match.homeTeam?.name),
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        thread: match.threads[0] || null,
        threads: match.threads,
        sentiment: match.sentiment,
      },
    });
  } catch (error) {
    console.error("Error fetching match detail:", error);
    return NextResponse.json({ error: "Failed to load match." }, { status: 500 });
  }
  }, { namespace: "match-detail", ttlSeconds: 60 * 10 });
}
