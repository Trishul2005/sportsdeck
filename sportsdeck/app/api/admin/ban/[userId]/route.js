import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function PATCH(req, { params }) {
	try {
		// await params
		const { userId } = await params;

		// authenticate admin
		const auth = await getAuthUserFromCookie(req);
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

		// parse body
		const { result } = await req.json();
		if (!result)
			return NextResponse.json(
				{ error: 'Ban result is required' },
				{ status: 400 },
			);
		
		if (typeof result !== 'string') {
			return NextResponse.json(
				{ error: 'Ban result must be a string' },
				{ status: 400 },
			);
		}

		const normalizedResult = result.toUpperCase();
		if (!['BAN', 'UNBAN'].includes(normalizedResult)) {
			return NextResponse.json(
				{ error: 'Invalid ban result' },
				{ status: 400 },
			);
		}

		// validate userId param
		const userIdParam = userId;
		if (!userIdParam || isNaN(parseInt(userIdParam))) {
			return NextResponse.json(
				{ error: 'Valid userId parameter is required' },
				{ status: 400 },
			);
		}

		// check if user exists
		const targetUser = await prisma.user.findUnique({
			where: { id: parseInt(userIdParam) },
		});
		if (!targetUser) {
			return NextResponse.json(
				{ error: 'User not found' },
				{ status: 404 },
			);
		}

		// update user's banned status
		const userIdInt = parseInt(userId);
		const updatedUser = await prisma.user.update({
			where: { id: userIdInt },
			data: { isBanned: normalizedResult === 'BAN' },
		});
		await invalidateRouteCache();

		return NextResponse.json(updatedUser, { status: 200 });
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
