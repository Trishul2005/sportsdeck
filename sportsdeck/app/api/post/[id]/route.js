import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
// import jwt from 'jsonwebtoken';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';

const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const TOXIC_BERT_DISABLED = process.env.DISABLE_TOXIC_BERT === 'true';
const EDIT_HISTORY_VERDICT = '__edit_history__';
const DEFAULT_HISTORY_PAGE_SIZE = 5;
const MAX_HISTORY_PAGE_SIZE = 50;

function getTopModerationResult(results) {
	if (!Array.isArray(results) || results.length === 0) {
		return { label: 'non-toxic', score: 0 };
	}

	let top = { label: 'non-toxic', score: 0 };
	for (const result of results) {
		const score = typeof result?.score === 'number' ? result.score : 0;
		if (score > top.score) {
			top = {
				label: typeof result?.label === 'string' ? result.label : 'non-toxic',
				score,
			};
		}
	}

	return top;
}

async function serializePost(postId, { includeHiddenReplies = false } = {}) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					avatar: true,
				},
			},
		},
	});

	if (!post) {
		return null;
	}

	const visibleReplyCount = await prisma.post.count({
		where: { parentId: post.id, ...(includeHiddenReplies ? {} : { isVisible: true }) },
	});

	return {
		...post,
		replyCount: visibleReplyCount,
		replies: [],
	};
}

function parseHistoryReason(reason) {
	try {
		const parsed = JSON.parse(reason);
		if (
			typeof parsed?.version === 'number' &&
			typeof parsed?.content === 'string'
		) {
			return {
				version: parsed.version,
				content: parsed.content,
				editedAt:
					typeof parsed.editedAt === 'string'
						? parsed.editedAt
						: new Date().toISOString(),
			};
		}
	} catch {
		return null;
	}

	return null;
}

async function buildPostHistory(postId) {
	const post = await prisma.post.findUnique({
		where: { id: postId },
		select: {
			id: true,
			content: true,
			version: true,
			updatedAt: true,
		},
	});

	if (!post) {
		return null;
	}

	const historyRows = await prisma.report.findMany({
		where: {
			postId,
			aiVerdict: EDIT_HISTORY_VERDICT,
		},
		select: {
			reason: true,
			createdAt: true,
		},
		orderBy: {
			createdAt: 'asc',
		},
	});

	const versionMap = new Map();
	for (const row of historyRows) {
		const parsed = parseHistoryReason(row.reason);
		if (!parsed) {
			continue;
		}

		versionMap.set(parsed.version, {
			version: parsed.version,
			content: parsed.content,
			editedAt: parsed.editedAt || row.createdAt.toISOString(),
		});
	}

	versionMap.set(post.version, {
		version: post.version,
		content: post.content,
		editedAt: post.updatedAt.toISOString(),
	});

	return Array.from(versionMap.values()).sort((a, b) => a.version - b.version);
}

async function createEditHistoryRecord(post, userId) {
	await prisma.report.create({
		data: {
			reportedById: userId,
			postId: post.id,
			reason: JSON.stringify({
				version: post.version,
				content: post.content,
				editedAt: post.updatedAt.toISOString(),
			}),
			aiVerdict: EDIT_HISTORY_VERDICT,
		},
	});
}

export async function GET(request, { params }) {
	const auth = await getAuthUserFromCookie(request);
	const isAdminViewer = !auth.error && auth.payload.role === 'ADMIN';
	const viewerScope = auth.error ? 'anon' : isAdminViewer ? 'admin' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(request, async () => {
	try {
		const { id } = await params;
		const parsedId = parseInt(id, 10);
		if (Number.isNaN(parsedId)) {
			return NextResponse.json(
				{ error: 'Invalid post ID.' },
				{ status: 400 },
			);
		}

		const { searchParams } = new URL(request.url);
		const includeHistory = searchParams.get('includeHistory') === 'true';
		const limitRaw = searchParams.get('limit');
		const cursorRaw = searchParams.get('cursor');

		const parsedLimit = limitRaw
			? parseInt(limitRaw, 10)
			: DEFAULT_HISTORY_PAGE_SIZE;
		if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
			return NextResponse.json(
				{ error: 'Invalid history limit.' },
				{ status: 400 },
			);
		}
		const limit = Math.min(parsedLimit, MAX_HISTORY_PAGE_SIZE);

		const cursor = cursorRaw ? parseInt(cursorRaw, 10) : null;
		if (cursorRaw && Number.isNaN(cursor)) {
			return NextResponse.json({ error: 'Invalid history cursor.' }, { status: 400 });
		}

		const serialized = await serializePost(parsedId, {
			includeHiddenReplies: isAdminViewer,
		});
		if (!serialized) {
			return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
		}
		if (!isAdminViewer && serialized.isVisible === false) {
			return NextResponse.json({ error: 'Post is hidden.' }, { status: 403 });
		}

		if (!includeHistory) {
			return NextResponse.json(serialized, { status: 200 });
		}

		const allVersions = await buildPostHistory(parsedId);
		if (!allVersions) {
			return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
		}

		const sortedVersions = [...allVersions].sort((a, b) => b.version - a.version);
		const filteredVersions = cursor
			? sortedVersions.filter((version) => version.version < cursor)
			: sortedVersions;
		const hasMore = filteredVersions.length > limit;
		const pageVersions = hasMore ? filteredVersions.slice(0, limit) : filteredVersions;
		const nextCursor = hasMore
			? pageVersions[pageVersions.length - 1].version
			: null;

		return NextResponse.json(
			{
				...serialized,
				versions: pageVersions,
				nextCursor,
				hasMore,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error fetching post:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch post' },
			{ status: 500 },
		);
	}
	}, { namespace: 'post-detail', ttlSeconds: 60, keyParts: [viewerScope] });
}

export async function PUT(request, { params }) {
	try {
		// authenticate user
		const auth = await getAuthUserFromCookie(request);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const user = auth.payload;
		// fetch user record
		const userRecord = await prisma.user.findUnique({
			where: { id: user.userId },
		});
		if (!userRecord)
			return NextResponse.json(
				{ error: 'User not found' },
				{ status: 401 },
			);
		if (userRecord.isBanned) {
			return NextResponse.json(
				{ error: 'User is banned' },
				{ status: 403 },
			);
		}
		const { id } = await params;
		const { content, isVisible } = await request.json();
		const wantsContentUpdate = content !== undefined;
		const wantsVisibilityUpdate = isVisible !== undefined;

		if (!wantsContentUpdate && !wantsVisibilityUpdate) {
			return NextResponse.json(
				{ error: 'No update fields provided.' },
				{ status: 400 },
			);
		}

		if (wantsContentUpdate && typeof content === 'string' && content.trim() === '') {
			return NextResponse.json(
				{ error: 'Content cannot be empty' },
				{ status: 400 },
			);
		}

		if (wantsVisibilityUpdate && typeof isVisible !== 'boolean') {
			return NextResponse.json(
				{ error: 'isVisible must be a boolean.' },
				{ status: 400 },
			);
		}

		if (wantsVisibilityUpdate && userRecord.role !== 'ADMIN') {
			return NextResponse.json(
				{ error: 'Only admins can change post visibility.' },
				{ status: 403 },
			);
		}

		if (isNaN(parseInt(id))) {
			return NextResponse.json(
				{ error: 'Invalid post ID.' },
				{ status: 400 },
			);
		}
		// Check that the thread is not closed before allowing the update
		const postToUpdate = await prisma.post.findUnique({
			where: { id: parseInt(id) },
			include: { thread: true },
		});
		if (!postToUpdate) {
			return NextResponse.json(
				{ error: 'Post not found' },
				{ status: 404 },
			);
		}
		// Check to ensure that user is author of the post before allowing update (unless they are an admin)
		if (
			postToUpdate.authorId !== user.userId &&
			userRecord.role !== 'ADMIN'
		) {
			return NextResponse.json(
				{ error: 'User is not the author of the post' },
				{ status: 403 },
			);
		}
		if (wantsContentUpdate && postToUpdate.thread && postToUpdate.thread.isClosed) {
			return NextResponse.json(
				{ error: 'Cannot edit post in a closed thread' },
				{ status: 403 },
			);
		}

		if (wantsContentUpdate) {
			// Before updating, use Hugging Face Inference API to check if content is appropriate
			const moderationResponse = EXTERNAL_MOCK_ENABLED || TOXIC_BERT_DISABLED
				? [{ label: 'non-toxic', score: 0.1 }]
				: await client.textClassification({
						model: 'unitary/toxic-bert',
						inputs: content,
						provider: 'hf-inference',
					});
			const topModeration = getTopModerationResult(moderationResponse);
			const toxicityScore = topModeration.score;
			const toxicityLabel = topModeration.label;
			// Use the same judgement as when creating a post.
			if (
				(toxicityLabel === 'toxic' && toxicityScore >= 0.5) ||
				toxicityLabel === 'severe_toxic'
			) {
				// Save the edit and queue it for admin review.
				await prisma.post.update({
					where: { id: parseInt(id) },
					data: {
						content,
						version: { increment: 1 },
						isVisible: true,
					},
				});
				await createEditHistoryRecord(postToUpdate, user.userId);
				await prisma.report.create({
					data: {
						reportedById: user.userId,
						postId: parseInt(id),
						reason: `Highly toxic content detected with score ${toxicityScore}`,
						aiVerdict: toxicityLabel,
						toxicity: toxicityScore,
					},
				});
				const responsePost = await serializePost(parseInt(id));
				if (!responsePost) {
					return NextResponse.json(
						{ error: 'Failed to update post' },
						{ status: 500 },
					);
				}
				await invalidateRouteCache();
				return NextResponse.json(responsePost, { status: 200 });
			}
		}

		const updateData = {};
		if (wantsContentUpdate) {
			updateData.content = content;
			updateData.version = { increment: 1 };
		}
		if (wantsVisibilityUpdate) {
			updateData.isVisible = isVisible;
		}

		const updatedPost = await prisma.post.update({
			where: { id: parseInt(id) },
			data: updateData,
		});
		if (
			wantsVisibilityUpdate &&
			isVisible === false &&
			postToUpdate.threadId
		) {
			const parentThread = await prisma.thread.findUnique({
				where: { id: postToUpdate.threadId },
				select: { id: true, mainPostId: true },
			});
			if (parentThread && parentThread.mainPostId === postToUpdate.id) {
				await prisma.thread.update({
					where: { id: parentThread.id },
					data: { isVisible: false, isClosed: true },
				});
			}
		}
		if (wantsContentUpdate) {
			await createEditHistoryRecord(postToUpdate, user.userId);
		}
		const responsePost = await serializePost(updatedPost.id);
		if (!responsePost) {
			return NextResponse.json(
				{ error: 'Failed to update post' },
				{ status: 500 },
			);
		}
		await invalidateRouteCache();
		return NextResponse.json(responsePost, { status: 200 });
	} catch (error) {
		console.error('Error updating post:', error);
		return NextResponse.json(
			{ error: 'Failed to update post' },
			{ status: 500 },
		);
	}
}

export async function DELETE(request, { params }) {
	try {
		// authenticate user
		const auth = await getAuthUserFromCookie(request);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const user = auth.payload;
		// fetch user record
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
		// Check that the thread is not closed before allowing the deletion
		const { id } = await params;
		if (isNaN(parseInt(id))) {
			return NextResponse.json(
				{ error: 'Invalid post ID.' },
				{ status: 400 },
			);
		}
		// Need to check for valid post existence and thread status before deletion to ensure proper cascade deletes and permissions
		const postToDelete = await prisma.post.findUnique({
			where: { id: parseInt(id) },
		});
		if (!postToDelete) {
			return NextResponse.json(
				{ error: 'Post not found' },
				{ status: 404 },
			);
		}
		if (postToDelete.threadId) {
			const threadOfPost = await prisma.thread.findUnique({
				where: { id: postToDelete.threadId },
			});
			if (threadOfPost && threadOfPost.isClosed && userRecord.role !== 'ADMIN') {
				return NextResponse.json(
					{ error: 'Cannot delete post in a closed thread' },
					{ status: 403 },
				);
			}
		}
		// Ensure that user is author of the post before allowing deletion (unless they are an admin)
		if (
			postToDelete.authorId !== user.userId &&
			userRecord.role !== 'ADMIN'
		) {
			return NextResponse.json(
				{ error: 'User is not the author of the post' },
				{ status: 403 },
			);
		}
		// Otherwise delete post
		await prisma.post.delete({
			where: { id: parseInt(id) },
		});
		await invalidateRouteCache();
		return NextResponse.json(
			{
				message: 'Post deleted successfully',
				deletedId: postToDelete.id,
				parentId: postToDelete.parentId,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error deleting post:', error);
		return NextResponse.json(
			{ error: 'Failed to delete post' },
			{ status: 500 },
		);
	}
}
