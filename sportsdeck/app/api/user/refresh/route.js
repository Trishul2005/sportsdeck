import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import {
	ACCESS_TOKEN_TTL_SECONDS,
	REFRESH_TOKEN_TTL_SECONDS,
	findActiveRefreshToken,
	getAuthCookieOptions,
	issueSessionTokens,
	revokeRefreshToken,
	verifyRefreshToken,
} from '@/lib/tokens';

export async function POST(request) {
	const refreshToken = request.cookies.get('refreshToken')?.value;

	if (!refreshToken) {
		return NextResponse.json({ error: 'Refresh token missing.' }, { status: 401 });
	}

	try {
		const payload = verifyRefreshToken(refreshToken);
		const storedToken = await findActiveRefreshToken(refreshToken);

		if (!storedToken) {
			return NextResponse.json({ error: 'Refresh token invalid.' }, { status: 401 });
		}

		const userId =
			payload && typeof payload === 'object' && typeof payload.userId === 'number'
				? payload.userId
				: null;

		if (!userId || storedToken.userId !== userId) {
			await revokeRefreshToken(refreshToken);
			return NextResponse.json({ error: 'Refresh token invalid.' }, { status: 401 });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				role: true,
			},
		});

		if (!user) {
			await revokeRefreshToken(refreshToken);
			return NextResponse.json({ error: 'User not found.' }, { status: 401 });
		}

		await revokeRefreshToken(refreshToken);
		const { accessToken, refreshToken: nextRefreshToken } = await issueSessionTokens(user);

		const response = NextResponse.json(
			{ message: 'Session refreshed', accessToken, refreshToken: nextRefreshToken },
			{ status: 200 },
		);

		response.cookies.set(
			'accessToken',
			accessToken,
			getAuthCookieOptions(ACCESS_TOKEN_TTL_SECONDS),
		);
		response.cookies.set(
			'refreshToken',
			nextRefreshToken,
			getAuthCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
		);

		return response;
	} catch (error) {
		return NextResponse.json({ error: 'Refresh token invalid.' }, { status: 401 });
	}
}
