import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

export async function POST(request) {
	const { email, username, password } = await request.json();

	if (!email || !username || !password) {
		return NextResponse.json(
			{ error: 'Email, username, and password are required.' },
			{ status: 400 },
		);
	}

	if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
		return NextResponse.json(
			{ error: 'Email, username, and password must be strings.' },
			{ status: 400 },
		);
	}

	try {
		const existingUser = await prisma.user.findUnique({
			where: { username },
		});

		if (existingUser) {
			return NextResponse.json(
				{ error: 'Username already exists.' },
				{ status: 400 },
			);
		}

		const existingEmail = await prisma.user.findUnique({
			where: { email },
		});

		if (existingEmail) {
			return NextResponse.json(
				{ error: 'Email already exists.' },
				{ status: 400 },
			);
		}

		// hash password
		const saltRounds = 10;
		const hashedPassword = await bcrypt.hash(password, saltRounds);

		const user = await prisma.user.create({
			data: {
				email,
				username,
				password: hashedPassword,
				avatar: null,
			},
		});

		return NextResponse.json({ user }, { status: 200 });
	} catch (err) {
		console.error(err);

		// Handle Prisma unique constraint violations
		if (err.code === 'P2002') {
			const field = err.meta?.target?.[0];
			if (field === 'username') {
				return NextResponse.json(
					{ error: 'Username already exists.' },
					{ status: 400 },
				);
			} else if (field === 'email') {
				return NextResponse.json(
					{ error: 'Email already exists.' },
					{ status: 400 },
				);
			}
			return NextResponse.json(
				{ error: 'User with these credentials already exists.' },
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{ error: 'Failed to register user' },
			{ status: 500 },
		);
	}
}
