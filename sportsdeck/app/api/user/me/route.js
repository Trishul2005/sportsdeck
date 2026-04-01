import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { prisma } from '@/prisma/db';
import { getCachedUserMe, setCachedUserMe } from '@/app/utils/userMeCache';

const noStoreHeaders = {
	'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
	Pragma: 'no-cache',
	Expires: '0',
};


export async function GET(request) {
	const auth = await getAuthUserFromCookie(request);
	if (auth.error) {
		return NextResponse.json({ user: null }, { status: 200, headers: noStoreHeaders });
	}

	const authAvatar =
		typeof auth?.user?.avatar === 'string' && auth.user.avatar.trim().length > 0
			? auth.user.avatar
			: null;

	const cachedUser = await getCachedUserMe(auth.payload.userId);
	if (cachedUser) {
		if (!cachedUser.avatar && authAvatar) {
			const hydratedCachedUser = { ...cachedUser, avatar: authAvatar };
			await setCachedUserMe(auth.payload.userId, hydratedCachedUser);
			return NextResponse.json(hydratedCachedUser, { status: 200, headers: noStoreHeaders });
		}

		return NextResponse.json(cachedUser, { status: 200, headers: noStoreHeaders });
	}

	const user = await prisma.user.findUnique({
		where: { id: auth.payload.userId },
		select: {
			id: true,
			email: true,
			username: true,
			avatar: true,
			favoriteTeamId: true,
			role: true,
			isBanned: true,
			themeMode: true,
			favoriteTeam: {
				select: {
					id: true,
					name: true,
					logoUrl: true,
				},
			},
		},
	});

	if (!user) {
		return NextResponse.json({ user: null }, { status: 200, headers: noStoreHeaders });
	}

	const safeUser = {
		...user,
		avatar: user.avatar || authAvatar,
	};
	delete safeUser.password;
	await setCachedUserMe(auth.payload.userId, safeUser);
	return NextResponse.json(safeUser, { status: 200, headers: noStoreHeaders });
}
