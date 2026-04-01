import { prisma } from "@/prisma/db";
import { NextResponse } from "next/server";
import { getAuthUserFromCookie } from '@/lib/auth';
import { withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(req) {
  const auth = await getAuthUserFromCookie(req);
  const viewerKey = auth.error ? 'anon' : `user:${auth.payload.userId}`;

  return withRedisRouteCache(req, async () => {
  try {
    // authenticate admin
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
                    
    const payload = auth.payload;
                    
                    
    const userRecord = await prisma.user.findUnique({
        where: { id: payload.userId },
    });
                    
    if (!userRecord || userRecord.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // get all pending appeals
    const appeals = await prisma.appeal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(appeals, { status: 200 });
    

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
  }, { namespace: 'admin-appeals', ttlSeconds: 60, keyParts: [viewerKey] });
}
