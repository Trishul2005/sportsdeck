import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import {
	ACCESS_TOKEN_TTL_SECONDS,
	REFRESH_TOKEN_TTL_SECONDS,
	getAuthCookieOptions,
	issueSessionTokens,
} from '@/lib/tokens';

export async function POST(request) {
	const { username, email, password } = await request.json();

	if ((!username && !email) || !password) {
		return NextResponse.json(
			{ error: 'Username or email, and password are required.' },
			{ status: 400 },
		);
	}

	if (username && email) {
		return NextResponse.json(
			{ error: 'Provide either username or email, not both.' },
			{ status: 400 },
		);
	}

	if (username && typeof username !== 'string') {
		return NextResponse.json(
			{ error: 'Username must be a string.' },
			{ status: 400 },
		);
	}

	if (email && typeof email !== 'string') {
		return NextResponse.json(
			{ error: 'Email must be a string.' },
			{ status: 400 },
		);
	}

	if (typeof password !== 'string') {
		return NextResponse.json(
			{ error: 'Password must be a string.' },
			{ status: 400 },
		);
	}

	try {
		let user;
		if (username) {
			user = await prisma.user.findUnique({ where: { username } });
		} else if (email) {
			user = await prisma.user.findUnique({ where: { email } });
		}

		if (!user) {
			return NextResponse.json(
				{ error: 'Invalid username or email and password.' },
				{ status: 401 },
			);
		}

		if (!user.password) {
			return NextResponse.json(
				{ error: 'This email is associated with Google. Please continue with Google to sign in.' },
				{ status: 401 },
			);
		}

		const passwordMatch = await bcrypt.compare(password, user.password);
		if (!passwordMatch) {
			return NextResponse.json(
				{ error: 'Invalid username or email and password.' },
				{ status: 401 },
			);
		}

		const { accessToken, refreshToken } = await issueSessionTokens(user);

		const response = NextResponse.json(
			{ message: 'Login successful', accessToken, refreshToken },
			{ status: 200 },
		);

		response.cookies.set(
			'accessToken',
			accessToken,
			getAuthCookieOptions(ACCESS_TOKEN_TTL_SECONDS),
		);

		response.cookies.set(
			'refreshToken',
			refreshToken,
			getAuthCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
		);

		return response;
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
