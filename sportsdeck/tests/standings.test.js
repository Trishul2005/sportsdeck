import { GET, normalizeStandingsFromPayload } from "../app/api/standings/route";
import { prisma } from "@/prisma/db";

jest.mock("@/prisma/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    team: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe("GET /api/standings", () => {
  const makeReq = (query = "") => ({
    url: `http://localhost/api/standings${query}`,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        team: prisma.team,
      }),
    );

    process.env.NBA_API_BASE_URL = "https://nba-ncaab-api.p.rapidapi.com";
    process.env.NBA_API_KEY = "test-key";
    process.env.NBA_API_HOST = "nba-ncaab-api.p.rapidapi.com";
    process.env.MOCK_EXTERNAL_APIS = "false";

    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.NBA_API_BASE_URL;
    delete process.env.NBA_API_KEY;
    delete process.env.NBA_API_HOST;
    delete process.env.MOCK_EXTERNAL_APIS;
  });

  it("returns 400 for unsupported leagueType", async () => {
    const res = await GET(makeReq("?leagueType=NCAA"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Only leagueType=NBA is supported by this endpoint.");
  });

  it("serves fresh standings from database cache", async () => {
    prisma.team.findMany.mockResolvedValue([
      {
        id: 1,
        name: "Boston Celtics",
        logoUrl: "https://logo.example/celtics.png",
        wins: 52,
        losses: 18,
        conference: "Eastern Conference",
        division: "Atlantic",
        createdAt: new Date(),
      },
    ]);

    const res = await GET(makeReq("?abbreviation=EAST"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("database-cache");
    expect(body.count).toBe(1);
    expect(body.standings[0].name).toBe("Boston Celtics");
    expect(body.standings[0].winPct).toBeCloseTo(0.743, 3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refreshes stale cache from external API and returns refreshed database standings", async () => {
    const staleDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const refreshedDate = new Date();

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          leagueName: "Eastern Conference",
          abbreviation: "EAST",
          year: 2025,
          seasonType: "Preseason",
          data: [
            {
              team: { displayName: "Boston Celtics", logo: "https://logo.example/celtics.png", id: 2 },
              statistics: [
                { name: "Wins", value: 1 },
                { name: "Losses", value: 0 },
                { name: "Rank", value: 1 },
              ],
            },
          ],
        },
        {
          leagueName: "Eastern Conference",
          abbreviation: "EAST",
          year: 2025,
          seasonType: "Regular Season",
          startDate: "2024-10-22T07:00:00.000Z",
          endDate: "2025-04-14T06:59:00.000Z",
          data: [
            {
              team: {
                displayName: "Boston Celtics",
                logo: "https://logo.example/celtics.png",
                abbreviation: "BOS",
                conference: "Eastern Conference",
                division: "Atlantic",
                id: 2,
              },
              statistics: [
                { displayName: "Wins", value: 52 },
                { displayName: "Losses", value: 18 },
                { displayName: "Position", value: 1 },
                { displayName: "Division Win Percentage", value: 1.0 },
                { displayName: "Win Percentage", value: 0.743 },
                { displayName: "Games Back", value: 0 },
                { displayName: "Streak", value: "W3" },
                { displayName: "Home", value: "28-7" },
                { displayName: "Road", value: "24-11" },
                { displayName: "Last Ten Games", value: "8-2" },
              ],
            },
          ],
        },
      ]),
    });

    prisma.team.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "Old Team",
          logoUrl: null,
          wins: 1,
          losses: 1,
          conference: "Eastern Conference",
          division: "Atlantic",
          createdAt: staleDate,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          name: "Boston Celtics",
          logoUrl: "https://logo.example/celtics.png",
          wins: 52,
          losses: 18,
          conference: "Eastern Conference",
          division: "Atlantic",
          createdAt: refreshedDate,
        },
      ]);
    prisma.team.create.mockResolvedValue({ id: 2 });

    const res = await GET(makeReq("?abbreviation=EAST"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("external-api");
    expect(body.seasonType).toBe("Regular Season");
    expect(body.leagueName).toBe("Eastern Conference");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.team.create).toHaveBeenCalledTimes(1);
    expect(prisma.team.update).not.toHaveBeenCalled();

    expect(body.standings[0]).toMatchObject({
      name: "Boston Celtics",
      teamId: "2",
      abbreviation: null,
      wins: 52,
      losses: 18,
      rank: 1,
      winPct: 0.743,
      gamesBack: 0,
      streak: null,
      homeRecord: null,
      awayRecord: null,
      lastTenRecord: null,
    });
    expect(body.standings[0].stats).toEqual([]);
  });

  it("falls back to stale database standings when upstream refresh fails", async () => {
    const staleRows = [
      {
        id: 1,
        name: "New York Knicks",
        logoUrl: null,
        wins: 40,
        losses: 30,
        conference: "Eastern Conference",
        division: "Atlantic",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ];

    prisma.team.findMany.mockResolvedValueOnce(staleRows).mockResolvedValueOnce(staleRows);
    global.fetch.mockRejectedValue(new Error("upstream down"));

    const res = await GET(makeReq("?abbreviation=EAST"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("database-fallback");
    expect(body.stale).toBe(true);
    expect(body.count).toBe(1);
    expect(body.standings[0].name).toBe("New York Knicks");
  });

  it("does not treat division percentage stats as a team division label", () => {
    const { standings } = normalizeStandingsFromPayload(
      [
        {
          leagueName: "Western Conference",
          abbreviation: "WEST",
          year: 2026,
          seasonType: "Regular Season",
          data: [
            {
              team: {
                displayName: "Phoenix Suns",
                conference: "Western Conference",
                id: 21,
              },
              statistics: [
                { displayName: "Wins", value: 39 },
                { displayName: "Losses", value: 29 },
                { displayName: "Division Win Percentage", value: 0.533 },
              ],
            },
          ],
        },
      ],
      "Regular Season",
    );

    expect(standings[0]).toMatchObject({
      name: "Phoenix Suns",
      conference: "Western Conference",
      division: "Pacific",
    });
  });
});
