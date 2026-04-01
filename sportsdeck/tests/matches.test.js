import { GET } from "../app/api/matches/route";
import { prisma } from "@/prisma/db";

jest.mock("@/prisma/db", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    match: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    thread: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    post: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("GET /api/matches", () => {
  const makeReq = (query = "") => ({
    url: `http://localhost/api/matches${query}`,
  });
  const activeDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const activeIsoDate = activeDate.toISOString().slice(0, 10);
  const activeIsoDateTime = activeDate.toISOString();

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.NBA_API_BASE_URL = "https://nba-ncaab-api.p.rapidapi.com";
    process.env.NBA_API_KEY = "test-key";
    process.env.NBA_API_HOST = "nba-ncaab-api.p.rapidapi.com";
    process.env.MOCK_EXTERNAL_APIS = "false";

    global.fetch = jest.fn();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.match.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.NBA_API_BASE_URL;
    delete process.env.NBA_API_KEY;
    delete process.env.NBA_API_HOST;
    delete process.env.MOCK_EXTERNAL_APIS;
  });

  it("returns 400 when no date or stage is provided", async () => {
    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Provide at least one filter: date or stage.");
  });

  it("returns 400 for invalid stage", async () => {
    const res = await GET(makeReq("?stage=invalid"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid stage. Use regular, preseason, or playoffs.");
  });

  it("returns 400 when fromDate/toDate is incomplete", async () => {
    const res = await GET(makeReq("?fromDate=2026-03-01"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Provide both fromDate and toDate.");
  });

  it("returns 400 when date and fromDate/toDate are mixed", async () => {
    const res = await GET(makeReq("?date=2026-03-01&fromDate=2026-03-01&toDate=2026-03-03"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Use either date or fromDate/toDate, not both.");
  });

  it("returns 400 when date range exceeds 14 days", async () => {
    const res = await GET(makeReq("?fromDate=2026-03-01&toDate=2026-03-15"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Date range cannot exceed 14 days.");
  });

  it("fetches from external API and upserts matches", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        games: [
          {
            id: "game-1",
            date: activeIsoDateTime,
            homeTeam: { name: "Lakers", score: 112 },
            awayTeam: { name: "Heat", score: 107 },
            venue: "Crypto.com Arena",
            status: "Final",
          },
        ],
      }),
    });

    prisma.team.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.team.create.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    prisma.match.upsert.mockResolvedValue({ id: 10 });

    const res = await GET(makeReq(`?date=${activeIsoDate}&stage=regular`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("external-api");
    expect(body.count).toBe(1);
    expect(body.availableMatchdays).toEqual([activeIsoDate]);
    expect(body.availableStages).toEqual(["regular"]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(prisma.match.upsert).toHaveBeenCalledTimes(1);
  });

  it("uses database cache for repeat request", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        games: [
          {
            id: "game-2",
            date: activeIsoDateTime,
            homeTeam: { name: "Bulls", score: 101 },
            awayTeam: { name: "Celtics", score: 98 },
            venue: "United Center",
            status: "Final",
          },
        ],
      }),
    });

    prisma.team.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.team.create.mockResolvedValueOnce({ id: 3 }).mockResolvedValueOnce({ id: 4 });
    prisma.match.upsert.mockResolvedValue({ id: 20 });
    const cachedMatchRow = {
      id: 20,
      date: new Date(activeIsoDateTime),
      venue: "United Center",
      homeScore: 101,
      awayScore: 98,
      homeTeam: { name: "Bulls" },
      awayTeam: { name: "Celtics" },
    };
    prisma.match.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cachedMatchRow])
      .mockResolvedValueOnce([cachedMatchRow]);

    const firstRes = await GET(makeReq(`?date=${activeIsoDate}&stage=regular`));
    const firstBody = await firstRes.json();
    expect(firstBody.dataSource).toBe("external-api");

    const secondRes = await GET(makeReq(`?date=${activeIsoDate}&stage=regular`));
    const secondBody = await secondRes.json();

    expect(secondRes.status).toBe(200);
    expect(secondBody.dataSource).toBe("database-cache");
    expect(secondBody.availableMatchdays).toEqual([activeIsoDate]);
    expect(secondBody.availableStages).toEqual(["regular"]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to database when upstream fetch fails", async () => {
    global.fetch.mockRejectedValue(new Error("upstream down"));

    prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 99,
        date: new Date(activeIsoDateTime),
        venue: "Fallback Arena",
        homeScore: 110,
        awayScore: 108,
        homeTeam: { name: "Knicks" },
        awayTeam: { name: "Nets" },
      },
    ]);

    const res = await GET(makeReq(`?date=${activeIsoDate}&stage=regular`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("database-fallback");
    expect(body.count).toBe(1);
    expect(body.matches[0].homeTeam).toBe("Knicks");
    expect(body.matches[0].awayTeam).toBe("Nets");
    expect(body.availableMatchdays).toEqual([activeIsoDate]);
    expect(body.availableStages).toEqual(["regular"]);
  });

  it("fills missing database venues from the home team city", async () => {
    prisma.match.findMany.mockResolvedValueOnce([
      {
        id: 301,
        date: new Date(activeIsoDateTime),
        venue: null,
        homeScore: 102,
        awayScore: 99,
        status: "scheduled",
        homeTeam: { id: 11, name: "Chicago Bulls", logoUrl: null },
        awayTeam: { id: 12, name: "Boston Celtics", logoUrl: null },
        threads: [],
      },
    ]);

    const res = await GET(makeReq(`?date=${activeIsoDate}&stage=regular`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("database-cache");
    expect(body.matches[0].venue).toBe("Chicago, IL");
  });

  it("fetches and combines matches for fromDate/toDate range", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          games: [
            {
              id: "game-r1",
              date: "2026-03-01T19:00:00.000Z",
              homeTeam: { name: "Lakers", id: 10, score: 112 },
              awayTeam: { name: "Heat", id: 20, score: 107 },
              venue: "Crypto.com Arena",
              state: { description: "Finished" },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          games: [
            {
              id: "game-r2",
              date: "2026-03-02T20:00:00.000Z",
              homeTeam: { name: "Bulls", id: 30, score: 101 },
              awayTeam: { name: "Celtics", id: 40, score: 98 },
              venue: "United Center",
              state: { description: "Finished" },
            },
          ],
        }),
      });

    prisma.team.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.team.create
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({ id: 3 })
      .mockResolvedValueOnce({ id: 4 });
    prisma.match.upsert.mockResolvedValue({ id: 10 });

    const res = await GET(makeReq("?fromDate=2026-03-01&toDate=2026-03-02"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dataSource).toBe("external-api");
    expect(body.count).toBe(2);
    expect(body.filters.fromDate).toBe("2026-03-01");
    expect(body.filters.toDate).toBe("2026-03-02");
    expect(body.availableMatchdays).toEqual(["2026-03-01", "2026-03-02"]);
    expect(body.availableStages).toEqual(["regular"]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
