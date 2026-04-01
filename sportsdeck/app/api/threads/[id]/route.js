import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(request, { params }) {
	const auth = await getAuthUserFromCookie(request);
	const viewerScope = auth.error ? 'anon' : auth.payload.role === 'ADMIN' ? 'admin' : `user:${auth.payload.userId}`;
	const canViewHidden = !auth.error && auth.payload.role === 'ADMIN';

	return withRedisRouteCache(request, async () => {
	try {
		const { id } = await params;
		const parsedId = parseInt(id, 10);
		if (Number.isNaN(parsedId)) {
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		}

		const now = new Date();
		const threadMeta = await prisma.thread.findUnique({
			where: { id: parsedId },
			select: {
				id: true,
				isVisible: true,
			},
		});

		if (!threadMeta) {
			return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
		}

		if (!canViewHidden && threadMeta.isVisible === false) {
			return NextResponse.json(
				{ error: 'Thread is hidden.', hidden: true },
				{ status: 200 },
			);
		}

		const thread = await prisma.thread.findFirst({
			where: {
				id: parsedId,
				...(canViewHidden ? {} : { isVisible: true }),
				OR: [
					{ matchId: null },
					{
						AND: [
							{ matchId: { not: null } },
							{ opensAt: { lte: now } },
							{ closesAt: { gt: now } },
						],
					},
				],
			},
			include: {
				tags: { include: { tag: true } },
				mainPost: {
					select: {
						id: true,
						content: true,
					},
				},
				team: {
					select: {
						id: true,
						name: true,
						logoUrl: true,
					},
				},
				match: {
					select: {
						id: true,
						date: true,
						sentiment: {
							select: {
								overall: true,
								homeTeam: true,
								awayTeam: true,
							},
						},
						homeTeam: {
							select: {
								id: true,
								name: true,
								logoUrl: true,
							},
						},
						awayTeam: {
							select: {
								id: true,
								name: true,
								logoUrl: true,
							},
						},
					},
				},
				polls: {
					take: 1,
					orderBy: {
						createdAt: 'desc',
					},
					include: {
						thread: {
							select: {
								id: true,
								title: true,
								isClosed: true,
								isVisible: true,
							},
						},
						post: {
							select: {
								id: true,
								threadId: true,
								parentId: true,
								content: true,
							},
						},
						createdBy: {
							select: {
								id: true,
								username: true,
								avatar: true,
							},
						},
						options: {
							include: {
								votes: {
									select: {
										id: true,
										userId: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!thread) {
			return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
		}

		return NextResponse.json(thread, { status: 200 });
	} catch (error) {
		console.error('Error fetching thread:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch thread' },
			{ status: 500 },
		);
	}
	}, { namespace: 'thread-detail', ttlSeconds: 60, keyParts: [viewerScope] });
}

export async function DELETE(request, { params }) {
	try {
		const auth = await getAuthUserFromCookie(request);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const user = auth.payload;
		const userRecord = await prisma.user.findUnique({
			where: { id: user.userId },
		});
		if (!userRecord) {
			return NextResponse.json({ error: 'User not found' }, { status: 401 });
		}
		if (userRecord.isBanned) {
			return NextResponse.json({ error: 'User is banned' }, { status: 403 });
		}

		const { id } = await params;
		const parsedId = parseInt(id, 10);
		if (Number.isNaN(parsedId)) {
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		}

		const existingThread = await prisma.thread.findUnique({
			where: { id: parsedId },
		});
		if (!existingThread) {
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		}

		if (
			existingThread.createdById !== user.userId &&
			userRecord.role !== 'ADMIN'
		) {
			return NextResponse.json(
				{ error: 'User is not the owner of the thread or an admin' },
				{ status: 403 },
			);
		}

		// Cascade delete will automatically remove associated posts, polls, tags, and reports
		await prisma.thread.delete({
			where: { id: parsedId },
		});
		await invalidateRouteCache();
		return NextResponse.json(
			{ message: 'Thread deleted successfully' },
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error deleting thread:', error);
		return NextResponse.json(
			{ error: 'Failed to delete thread' },
			{ status: 500 },
		);
	}
}

export async function PUT(request, { params }) {
	try {
		const { id } = await params;
		const parsedId = parseInt(id, 10);
		if (Number.isNaN(parsedId)) {
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		}

		const auth = await getAuthUserFromCookie(request);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const user = auth.payload;
		const { title, isClosed, isVisible, tags } = await request.json();
		const hasTitle = title !== undefined;
		const hasClosed = isClosed !== undefined;
		const hasVisible = isVisible !== undefined;
		const hasTags = tags !== undefined;
		if (!hasTitle && !hasClosed && !hasVisible && !hasTags) {
			return NextResponse.json(
				{ error: 'No update fields provided.' },
				{ status: 400 },
			);
		}
		if (hasTitle && (typeof title !== 'string' || !title.trim())) {
			return NextResponse.json(
				{ error: 'Title cannot be empty.' },
				{ status: 400 },
			);
		}
		if (hasClosed && typeof isClosed !== 'boolean') {
			return NextResponse.json(
				{ error: 'isClosed must be a boolean.' },
				{ status: 400 },
			);
		}
		if (hasVisible && typeof isVisible !== 'boolean') {
			return NextResponse.json(
				{ error: 'isVisible must be a boolean.' },
				{ status: 400 },
			);
		}

		const userRecord = await prisma.user.findUnique({
			where: { id: user.userId },
		});
		if (!userRecord) {
			return NextResponse.json(
				{ error: 'User not found' },
				{ status: 401 },
			);
		}
		if (userRecord.isBanned) {
			return NextResponse.json(
				{ error: 'User is banned' },
				{ status: 403 },
			);
		}

		const existingThread = await prisma.thread.findUnique({
			where: { id: parsedId },
		});
		if (!existingThread) {
			return NextResponse.json(
				{ error: 'Thread not found.' },
				{ status: 404 },
			);
		}
		// Then make sure that the user is the owner of the thread or an admin before allowing update
		if (
			existingThread.createdById !== user.userId &&
			userRecord.role !== 'ADMIN'
		) {
			return NextResponse.json(
				{ error: 'User is not the owner of the thread or an admin' },
				{ status: 403 },
			);
		}

		if (hasVisible && userRecord.role !== 'ADMIN') {
			return NextResponse.json(
				{ error: 'Only admins can change thread visibility.' },
				{ status: 403 },
			);
		}

		// Build update payload; tags are handled specially below
		const updateData = {};
		if (hasTitle) updateData.title = title.trim();
		if (hasClosed) updateData.isClosed = isClosed;
		if (hasVisible) updateData.isVisible = isVisible;
		if (hasVisible && isVisible === false) updateData.isClosed = true;

		let updatedThread = null;
		if (hasTags) {
			// Validate tags payload - should be an array of strings
			if (!Array.isArray(tags)) {
				return NextResponse.json({ error: 'tags must be an array.' }, { status: 400 });
			}
			const requestedTagNames = tags
				.map((t) => (typeof t === 'string' ? t.trim() : ''))
				.filter(Boolean);

			// Enforce maximum tags per thread
			if (requestedTagNames.length > 5) {
				return NextResponse.json({ error: 'A thread can have at most 5 tags.' }, { status: 400 });
			}

			// Upsert tags and collect ids
			const normalizedTagIds = requestedTagNames.length
				? (await Promise.all(
						requestedTagNames.map((tagName) =>
							prisma.tag.upsert({
								where: { name: tagName },
								update: {},
								create: { name: tagName },
								select: { id: true },
							}),
						),
				  )).map((t) => t.id)
				: [];

			// Update thread and replace tag relations using an array transaction
			const ops = [
				prisma.thread.update({ where: { id: parsedId }, data: updateData }),
				prisma.tagThread.deleteMany({ where: { threadId: parsedId } }),
			];
			if (normalizedTagIds.length > 0) {
				ops.push(
					prisma.tagThread.createMany({
						data: normalizedTagIds.map((tagId) => ({ tagId, threadId: parsedId })),
						skipDuplicates: true,
					}),
				);
			}
			ops.push(prisma.thread.findUnique({ where: { id: parsedId }, include: { tags: { include: { tag: true } } } }));

			const results = await prisma.$transaction(ops);
			updatedThread = results[results.length - 1];
		} else {
			updatedThread = await prisma.thread.update({
				where: { id: parsedId },
				data: updateData,
			});
		}
		await invalidateRouteCache();
		return NextResponse.json(updatedThread, { status: 200 });
	} catch (error) {
		console.error('Error updating thread:', error);
		return NextResponse.json(
			{ error: 'Failed to update thread' },
			{ status: 500 },
		);
	}
}
