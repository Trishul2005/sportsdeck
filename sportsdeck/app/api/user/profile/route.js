import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import { getAuthUserFromCookie } from '@/lib/auth';
import cloudinary from '@/lib/cloudinary';
import { isValidTeamConference } from '@/app/utils/teamConference';
import { invalidateUserMeCache } from '@/app/utils/userMeCache';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(request) {
	const auth = await getAuthUserFromCookie(request);
	const viewerKey = auth.error ? 'anon' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(request, async () => {
	if (auth.error) {
		return NextResponse.json({ error: auth.error }, { status: auth.status });
	}

	const user = await prisma.user.findUnique({
		where: { id: auth.payload.userId },
		include: {
			favoriteTeam: {
				select: {
					id: true,
					name: true,
					logoUrl: true,
					conference: true,
					division: true,
					wins: true,
					losses: true,
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
			reports: {
				select: {
					id: true,
					reason: true,
					isResolved: true,
					createdAt: true,
				},
				orderBy: { createdAt: 'desc' },
			},
			followers: {
				select: {
					id: true,
					followerId: true,
				},
			},
			following: {
				select: {
					id: true,
					followingId: true,
				},
			},
			appeals: {
				select: {
					id: true,
					reason: true,
					status: true,
					createdAt: true,
					reviewedAt: true,
				},
				orderBy: { createdAt: 'desc' },
			},
		},
	});

	if (!user) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	const safeUser = { ...user };
	delete safeUser.password;
	return NextResponse.json(safeUser, { status: 200 });
	}, { namespace: 'user-profile', ttlSeconds: 60, keyParts: [viewerKey] });
}

export async function PATCH(request) {
	// authenticate user
	const auth = await getAuthUserFromCookie(request);
	if (auth.error) {
		return NextResponse.json({ error: auth.error }, { status: auth.status });
	}

	const payload = auth.payload;

	try {
		const contentType = request.headers.get('content-type') || '';
		let username;
		let avatar;
		let favoriteTeamId;
		let avatarFile = null;

		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			username = formData.get('username');
			avatar = formData.get('avatar');
			favoriteTeamId = formData.get('favoriteTeamId');
			const possibleFile = formData.get('avatarFile');
			avatarFile = possibleFile instanceof File && possibleFile.size > 0 ? possibleFile : null;
		} else {
			const body = await request.json();
			username = body.username;
			avatar = body.avatar;
			favoriteTeamId = body.favoriteTeamId;
		}

		const normalizedUsername =
			typeof username === 'string' && username.trim().length > 0
				? username.trim()
				: undefined;
		let normalizedAvatar =
			typeof avatar === 'string' && avatar.trim().length > 0
				? avatar.trim()
				: null;
		const normalizedFavoriteTeamId =
			favoriteTeamId === null ||
			favoriteTeamId === undefined ||
			favoriteTeamId === ''
				? null
				: Number(favoriteTeamId);

		// check if username is already taken by another user
		if (normalizedUsername) {
			const existing = await prisma.user.findUnique({
				where: { username: normalizedUsername },
			});
			if (existing && existing.id !== payload.userId) {
				return NextResponse.json(
					{ error: 'Username already taken' },
					{ status: 400 },
				);
			}
		}

		if (
			normalizedFavoriteTeamId !== null &&
			(!Number.isInteger(normalizedFavoriteTeamId) || normalizedFavoriteTeamId <= 0)
		) {
			return NextResponse.json(
				{ error: 'Favorite team must be a valid team id.' },
				{ status: 400 },
			);
		}

		if (normalizedFavoriteTeamId) {
			const team = await prisma.team.findUnique({
				where: { id: normalizedFavoriteTeamId },
				select: {
					id: true,
					conference: true,
				},
			});
			if (!team) {
				return NextResponse.json(
					{ error: 'Team not found' },
					{ status: 400 },
				);
			}
			if (!isValidTeamConference(team.conference)) {
				return NextResponse.json(
					{ error: 'Favorite team must belong to the Eastern or Western Conference.' },
					{ status: 400 },
				);
			}
		}

		if (avatarFile) {
			if (!avatarFile.type.startsWith('image/')) {
				return NextResponse.json(
					{ error: 'Avatar upload must be an image file.' },
					{ status: 400 },
				);
			}

			if (avatarFile.size > 5 * 1024 * 1024) {
				return NextResponse.json(
					{ error: 'Avatar image must be 5MB or smaller.' },
					{ status: 400 },
				);
			}

			// Read file into buffer and upload to Cloudinary via data URI
			const arrayBuffer = await avatarFile.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const base64 = buffer.toString('base64');
			const dataUri = `data:${avatarFile.type};base64,${base64}`;

			try {
				const uploadResult = await cloudinary.uploader.upload(dataUri, {
					folder: 'avatars',
					public_id: `user-${payload.userId}-${Date.now()}`,
					overwrite: true,
					resource_type: 'image',
				});

				normalizedAvatar = uploadResult.secure_url || uploadResult.url || null;
			} catch (uploadErr) {
				console.error('Cloudinary upload failed:', uploadErr);
				return NextResponse.json(
					{ error: 'Failed to upload avatar.' },
					{ status: 500 },
				);
			}
		}

		const updatedUser = await prisma.user.update({
			where: { id: payload.userId },
			data: {
				username: normalizedUsername,
				avatar: normalizedAvatar,
				favoriteTeamId: normalizedFavoriteTeamId,
			},
		});

		const safeUser = { ...updatedUser };
		delete safeUser.password;
		await invalidateUserMeCache(payload.userId);
		await invalidateRouteCache();

		return NextResponse.json(safeUser, { status: 200 });
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
