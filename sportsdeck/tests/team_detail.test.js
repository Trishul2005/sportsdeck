import { GET } from "../app/api/teams/[id]/route";
import { prisma } from "@/prisma/db";

jest.mock("@/prisma/db", () => ({
  prisma: {
    team: {
      findUnique: jest.fn(),
    },
    thread: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe("GET /api/teams/[id]", () => {
  const makeContext = (id = "1") => ({
    params: Promise.resolve({ id }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.thread.findMany.mockResolvedValue([]);
    prisma.thread.count.mockResolvedValue(0);
  });

  it("falls back to the home team city when a match venue is missing", async () => {
    prisma.team.findUnique.mockResolvedValue({
      id: 1,
      name: "Los Angeles Lakers",
      logoUrl: null,
      wins: 50,
      losses: 32,
      conference: "Western",
      division: "Pacific",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      _count: {
        fans: 5,
        matchesHome: 1,
        matchesAway: 1,
      },
      matchesHome: [
        {
          id: 101,
          date: new Date("2026-03-20T19:00:00.000Z"),
          status: "scheduled",
          homeScore: null,
          awayScore: null,
          venue: null,
          awayTeam: {
            id: 2,
            name: "Boston Celtics",
            logoUrl: null,
          },
        },
      ],
      matchesAway: [
        {
          id: 102,
          date: new Date("2026-03-22T19:00:00.000Z"),
          status: "scheduled",
          homeScore: null,
          awayScore: null,
          venue: null,
          homeTeam: {
            id: 3,
            name: "Chicago Bulls",
            logoUrl: null,
          },
        },
      ],
    });

    const res = await GET({}, makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 101, venue: "Los Angeles, CA" }),
        expect.objectContaining({ id: 102, venue: "Chicago, IL" }),
      ]),
    );
  });

  it("preserves a stored arena name when one exists", async () => {
    prisma.team.findUnique.mockResolvedValue({
      id: 1,
      name: "Los Angeles Lakers",
      logoUrl: null,
      wins: 50,
      losses: 32,
      conference: "Western",
      division: "Pacific",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      _count: {
        fans: 5,
        matchesHome: 1,
        matchesAway: 0,
      },
      matchesHome: [
        {
          id: 201,
          date: new Date("2026-03-25T19:00:00.000Z"),
          status: "scheduled",
          homeScore: null,
          awayScore: null,
          venue: "Crypto.com Arena",
          awayTeam: {
            id: 2,
            name: "Phoenix Suns",
            logoUrl: null,
          },
        },
      ],
      matchesAway: [],
    });

    const res = await GET({}, makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.team.matches[0].venue).toBe("Crypto.com Arena");
  });
});
