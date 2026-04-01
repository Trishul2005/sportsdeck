import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function POST(req, { params }) {
	try {

		// authenticate user
		const auth = await getAuthUserFromCookie(req);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const payload = auth.payload;
		
			const userRecord = await prisma.user.findUnique({ where: { id: payload.userId } });
			if (!userRecord) {
				return NextResponse.json({ error: "User not found" }, { status: 401 });
			}

		// check if user is banned
		if (userRecord.isBanned) {
			return NextResponse.json({ error: "User is banned" }, { status: 403 });
		}

		const followerId = payload.userId;
		const { id } = await params;

		if (!id || isNaN(parseInt(id))) {
			return NextResponse.json(
				{ error: 'Invalid user ID' },
				{ status: 400 },
			);
		}

		const followingId = parseInt(id);


		if (followerId === followingId) {
			return NextResponse.json(
				{ error: 'Cannot follow yourself' },
				{ status: 400 },
			);
		}

		// check if following user exists
		const followingUser = await prisma.user.findUnique({
			where: { id: followingId },
		});

		if (!followingUser) {
			return NextResponse.json(
				{ error: 'User to follow not found' },
				{ status: 404 },
			);
		}

		const existingFollow = await prisma.follow.findUnique({
			where: {
				followerId_followingId: {
					followerId: followerId,
					followingId: followingId,
				},
			},
		});

		if (existingFollow) {
			return NextResponse.json(
				{ error: 'Already following this user' },
				{ status: 409 },
			);
		}

		const follow = await prisma.follow.create({
			data: {
				followerId: followerId,
				followingId: followingId,
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: 'Followed successfully', follow },
			{ status: 201 },
		);
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}


export async function DELETE(req, { params }) {
	try {
		// authenticate user
		const auth = await getAuthUserFromCookie(req);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const payload = auth.payload;

		const userRecord = await prisma.user.findUnique({
			where: { id: payload.userId },
		});

		if (!userRecord) {
			return NextResponse.json({ error: "User not found" }, { status: 401 });
		}

		const followerId = payload.userId;
		const { id } = await params;

		if (!id || isNaN(parseInt(id))) {
			return NextResponse.json(
				{ error: "Invalid user ID" },
				{ status: 400 }
			);
		}

		const followingId = parseInt(id);

		if (followerId === followingId) {
			return NextResponse.json(
				{ error: "Cannot unfollow yourself" },
				{ status: 400 }
			);
		}

		await prisma.follow.delete({
			where: {
				followerId_followingId: {
					followerId: followerId,
					followingId: followingId,
				},
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: "Unfollowed successfully" },
			{ status: 200 }
		);
	} catch (error) {
		if (error.code === "P2025") {
			return NextResponse.json(
				{ error: "Follow relationship not found" },
				{ status: 404 }
			);
		}

		console.error(error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
