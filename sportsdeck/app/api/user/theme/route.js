import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateUserMeCache } from '@/app/utils/userMeCache';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function PATCH(request) {
	try {
		const auth = await getAuthUserFromCookie(request);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const { themeMode } = await request.json();

		if (typeof themeMode !== 'string' || !['LIGHT', 'DARK'].includes(themeMode)) {
			return NextResponse.json(
				{ error: 'Invalid theme mode. Must be LIGHT or DARK' },
				{ status: 400 },
			);
		}

		const updatedUser = await prisma.user.update({
			where: { id: auth.payload.userId },
			data: { themeMode },
		});
		await invalidateUserMeCache(auth.payload.userId);
		await invalidateRouteCache();

		return NextResponse.json({ themeMode: updatedUser.themeMode }, { status: 200 });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
