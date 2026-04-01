import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { getAuthUserFromCookie } from '@/lib/auth';
import { withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(req) {
  const auth = await getAuthUserFromCookie(req);
  const viewerKey = auth.error ? 'anon' : `user:${auth.payload.userId}`;

  return withRedisRouteCache(req, async () => {
  try {
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = auth.payload;

    const userExists = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!userExists) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const followRecords = await prisma.follow.findMany({
      where: { followerId: payload.userId },
      orderBy: { createdAt: "desc" },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const formatted = followRecords.map((record) => ({
      id: record.following.id,
      username: record.following.username,
      avatar: record.following.avatar,
      followedAt: record.createdAt,
    }));

    return NextResponse.json({ following: formatted }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
  }, { namespace: 'user-following', ttlSeconds: 60, keyParts: [viewerKey] });
}
