import { GET } from "../app/api/matches/[id]/route";
import { prisma } from "@/prisma/db";

jest.mock("@/prisma/db", () => ({
  prisma: {
    match: {
      findUnique: jest.fn(),
    },
  },
}));

describe("GET /api/matches/[id]", () => {
  const makeContext = (id = "1") => ({
    params: Promise.resolve({ id }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("falls back to the home team city when venue is missing", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 1,
      date: new Date("2026-03-26T19:00:00.000Z"),
      venue: null,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homeTeam: {
        id: 5,
        name: "Chicago Bulls",
        logoUrl: null,
        wins: 40,
        losses: 20,
        conference: "Eastern",
      },
      awayTeam: {
        id: 6,
        name: "Miami Heat",
        logoUrl: null,
        wins: 35,
        losses: 25,
        conference: "Eastern",
      },
      threads: [],
      sentiment: null,
    });

    const res = await GET({}, makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.match.venue).toBe("Chicago, IL");
  });

  it("keeps the stored venue when present", async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 2,
      date: new Date("2026-03-26T19:00:00.000Z"),
      venue: "United Center",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homeTeam: {
        id: 5,
        name: "Chicago Bulls",
        logoUrl: null,
        wins: 40,
        losses: 20,
        conference: "Eastern",
      },
      awayTeam: {
        id: 6,
        name: "Miami Heat",
        logoUrl: null,
        wins: 35,
        losses: 25,
        conference: "Eastern",
      },
      threads: [],
      sentiment: null,
    });

    const res = await GET({}, makeContext("2"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.match.venue).toBe("United Center");
  });
});
