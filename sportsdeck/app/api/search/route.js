import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';

// Unified search API: returns grouped results for Threads, Polls, Users, Matches, Teams
export async function POST(req) {
  const body = await req.json();
  const query = typeof body?.query === 'string' ? body.query : '';
  const requestedTags = Array.isArray(body?.tags) ? body.tags.map(String).map(t => t.trim()).filter(Boolean) : [];

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or invalid query.' }, { status: 400 });
  }
  const q = query.trim();

  // Search Threads (by title and mainPost content, always case-insensitive)
  const threadWhere = {
    AND: [
      {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { mainPost: { content: { contains: q, mode: 'insensitive' } } },
        ],
      },
    ],
  };

  if (requestedTags.length > 0) {
    threadWhere.AND.push({ tags: { some: { tag: { name: { in: requestedTags } } } } });
  }

  const threads = await prisma.thread.findMany({
    where: threadWhere,
    select: {
      id: true,
      title: true,
      mainPost: { select: { content: true } },
    },
    take: 20,
  });

  // Search Polls (only by question, always case-insensitive)
  const polls = await prisma.poll.findMany({
    where: {
      question: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, question: true, threadId: true, post: { select: { threadId: true } } },
    take: 20,
  });

  // Search Users (always case-insensitive)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, username: true, avatar: true },
    take: 20,
  });

  // Search Matches (by home/away team name, always case-insensitive)
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { homeTeam: { name: { contains: q, mode: 'insensitive' } } },
        { awayTeam: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    select: {
      id: true,
      date: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    take: 20,
  });

  // Search Teams (always case-insensitive)
  const teams = await prisma.team.findMany({
    where: {
      name: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, name: true, logoUrl: true },
    take: 20,
  });

  // Search Tags (by tag name)
  const tagResults = await prisma.tag.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { id: true, name: true },
    take: 20,
  });

  return NextResponse.json({
    threads,
    polls,
    users,
    matches,
    teams,
    tags: tagResults,
  });
}
