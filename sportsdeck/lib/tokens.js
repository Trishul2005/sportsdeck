import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/prisma/db';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 2;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24;

function getAccessTokenSecret() {
	if (!process.env.ACCESS_TOKEN_SECRET) {
		throw new Error('ACCESS_TOKEN_SECRET is not configured.');
	}

	return process.env.ACCESS_TOKEN_SECRET;
}

function getRefreshTokenSecret() {
	if (!process.env.REFRESH_TOKEN_SECRET) {
		throw new Error('REFRESH_TOKEN_SECRET is not configured.');
	}

	return process.env.REFRESH_TOKEN_SECRET;
}

export function buildAuthPayload(user) {
	return {
		userId: user.id,
		username: user.username,
		role: user.role,
	};
}

export function signAccessToken(payload) {
	return jwt.sign(payload, getAccessTokenSecret(), {
		expiresIn: ACCESS_TOKEN_TTL_SECONDS,
		jwtid: crypto.randomUUID(),
	});
}

export function signRefreshToken(payload) {
	return jwt.sign(payload, getRefreshTokenSecret(), {
		expiresIn: REFRESH_TOKEN_TTL_SECONDS,
		jwtid: crypto.randomUUID(),
	});
}

export function verifyRefreshToken(token) {
	return jwt.verify(token, getRefreshTokenSecret());
}

export function getTokenHash(token) {
	return crypto.createHash('sha256').update(token).digest('hex');
}

export function getAuthCookieOptions(maxAgeSeconds) {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: maxAgeSeconds,
	};
}

export async function persistRefreshToken(token, userId) {
	const decoded = verifyRefreshToken(token);
	const expiresAt =
		decoded && typeof decoded === 'object' && typeof decoded.exp === 'number'
			? new Date(decoded.exp * 1000)
			: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

	return prisma.refreshToken.create({
		data: {
			tokenHash: getTokenHash(token),
			userId,
			expiresAt,
		},
	});
}

export async function revokeRefreshToken(token) {
	const tokenHash = getTokenHash(token);

	return prisma.refreshToken.updateMany({
		where: {
			tokenHash,
			revokedAt: null,
		},
		data: {
			revokedAt: new Date(),
		},
	});
}

export async function findActiveRefreshToken(token) {
	return prisma.refreshToken.findFirst({
		where: {
			tokenHash: getTokenHash(token),
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
	});
}

export async function issueSessionTokens(user) {
	const payload = buildAuthPayload(user);
	const accessToken = signAccessToken(payload);
	const refreshToken = signRefreshToken(payload);

	await persistRefreshToken(refreshToken, user.id);

	return { accessToken, refreshToken };
}

export {
	ACCESS_TOKEN_TTL_SECONDS,
	REFRESH_TOKEN_TTL_SECONDS,
};
