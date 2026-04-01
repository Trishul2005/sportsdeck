import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function DELETE(req, { params }) {
	try {
		// authenticate user
    const auth = await getAuthUserFromCookie(req);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = auth.payload;

		// getting followerId
		const followerId = parseInt((await params).followerId);

		if (isNaN(followerId)) {
			return NextResponse.json(
				{ error: 'Invalid follower ID' },
				{ status: 400 },
			);
		}

		// check if follow relationship exists
		const existingFollow = await prisma.follow.findUnique({
			where: {
				followerId_followingId: {
					followerId: followerId,
					followingId: payload.userId,
				},
			},
		});

		if (!existingFollow) {
			return NextResponse.json(
				{ error: 'Follower relationship not found' },
				{ status: 404 },
			);
		}

		// delete relationship
		await prisma.follow.delete({
			where: {
				followerId_followingId: {
					followerId: followerId,
					followingId: payload.userId,
				},
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: 'Follower removed successfully' },
			{ status: 200 },
		);
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
