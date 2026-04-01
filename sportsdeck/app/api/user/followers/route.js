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

    const followRecords = await prisma.follow.findMany({
      where: { followingId: payload.userId },
      orderBy: { createdAt: "desc" },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const formatted = followRecords.map((record) => ({
      id: record.follower.id,
      username: record.follower.username,
      avatar: record.follower.avatar,
      followedAt: record.createdAt,
    }));

    return NextResponse.json({ followers: formatted }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
  }, { namespace: 'user-followers', ttlSeconds: 60, keyParts: [viewerKey] });
}
