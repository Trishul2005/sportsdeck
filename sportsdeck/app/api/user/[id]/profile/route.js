import { NextResponse } from "next/server";
import { prisma } from "@/prisma/db";
import { getAuthUserFromCookie } from '@/lib/auth';
import { isValidTeamConference, normalizeTeamConference } from '@/app/utils/teamConference';
import { withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(req, { params }) {
  const auth = await getAuthUserFromCookie(req);
  const viewerId = auth.error ? null : auth.payload.userId;

  return withRedisRouteCache(req, async () => {
  try {

    // ---- SANITIZE PARAM ----
    const { id } = await params;

    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const userId = parseInt(id);

    // ---- GET USER ----
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        role: true,
        isBanned: true,
        createdAt: true,
        favoriteTeam: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            conference: true,
          },
        },
        posts: {
          where: {
            isVisible: true,
            OR: [
              { threadId: null },
              { thread: { isVisible: true } },
            ],
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            threadId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        threads: {
          where: {
            isVisible: true,
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            teamId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        polls: {
          where: {
            isVisible: true,
            OR: [
              { threadId: null },
              { thread: { isVisible: true } },
            ],
          },
          select: {
            id: true,
            question: true,
            createdAt: true,
            deadline: true,
            threadId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ---- COUNTS ----
    const [followers, following, threads, posts, isFollowing] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.thread.count({ where: { createdById: userId, isVisible: true } }),
      prisma.post.count({
        where: {
          authorId: userId,
          isVisible: true,
          OR: [
            { threadId: null },
            { thread: { isVisible: true } },
          ],
        },
      }),
      viewerId && viewerId !== userId
        ? prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: userId,
              },
            },
          })
        : null,
    ]);

    const safeUser = {
      ...targetUser,
      favoriteTeam:
        targetUser.favoriteTeam && isValidTeamConference(targetUser.favoriteTeam.conference)
          ? {
              ...targetUser.favoriteTeam,
              conference:
                normalizeTeamConference(targetUser.favoriteTeam.conference) ||
                targetUser.favoriteTeam.conference,
            }
          : null,
    };

    return NextResponse.json(
      {
        user: safeUser,
        viewer: {
          isAuthenticated: Boolean(viewerId),
          isOwnProfile: viewerId === userId,
          isFollowing: Boolean(isFollowing),
        },
        counts: {
          followers,
          following,
          threads,
          posts,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
  }, { namespace: 'user-public-profile', ttlSeconds: 60, keyParts: [viewerId ?? 'anon'] });
}
