import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
// import jwt from 'jsonwebtoken';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';
// import { resourceLimits } from 'node:worker_threads';

const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const TOXIC_BERT_DISABLED = process.env.DISABLE_TOXIC_BERT === 'true';
const DEFAULT_REPLY_PAGE_SIZE = 10;
const MAX_REPLY_PAGE_SIZE = 50;

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

async function fetchRepliesPage(parentId, limit, cursorId, { includeHidden = false } = {}) {
	const rows = await prisma.post.findMany({
		where: { parentId, ...(includeHidden ? {} : { isVisible: true }) },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					avatar: true,
				},
			},
		},
		orderBy: { id: 'asc' },
		...(cursorId
			? {
					cursor: { id: cursorId },
					skip: 1,
			  }
			: {}),
		take: limit + 1,
	});

	const hasMore = rows.length > limit;
	const pageRows = hasMore ? rows.slice(0, limit) : rows;
	const repliesWithCounts = await Promise.all(
		pageRows.map(async (reply) => {
			const visibleReplyCount = await prisma.post.count({
				where: { parentId: reply.id, ...(includeHidden ? {} : { isVisible: true }) },
			});
			return {
				...reply,
				replyCount: visibleReplyCount,
			};
		}),
	);

	return {
		replies: repliesWithCounts,
		nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
		hasMore,
	};
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
	

export async function POST(request) {
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

		const { content, threadId, parentId } = await request.json();
		if (!content) {
			return NextResponse.json(
				{ error: 'Content is required to create a post.' },
				{ status: 400 },
			);
		}

		// If threadId is provided, validate it
		if (threadId) {
			if (isNaN(parseInt(threadId))) {
				return NextResponse.json(
					{ error: 'Invalid thread ID.' },
					{ status: 400 },
				);
			}
			// Attempt to find the thread:
			const threadExists = await prisma.thread.findUnique({
				where: { id: parseInt(threadId) },
				include: {
					polls: {
						take: 1,
						select: { id: true },
					},
				},
			});
			if (!threadExists) {
				return NextResponse.json(
					{ error: 'Thread not found.' },
					{ status: 404 },
				);
			}
			const now = Date.now();
			if (threadExists.opensAt && now < new Date(threadExists.opensAt).getTime()) { 
				return NextResponse.json(
					{ error: "Thread is not open yet." },
					{ status: 403 },
				)
			}
			if (threadExists.closesAt && now >= new Date(threadExists.closesAt).getTime()) {
				return NextResponse.json(
					{ error: "Thread is closed." },
					{ status: 403 },
				)
			}
			// check if thread is closed or hidden
			if (threadExists.isClosed) {
				return NextResponse.json(
					{ error: 'Thread is closed.' },
					{ status: 403 },
				);
			}

			if (threadExists.isVisible === false) {
				return NextResponse.json(
					{ error: 'Thread is hidden.' },
					{ status: 403 },
				);
			}

		}

		// if parentId is provided, check if parent post exists and is visible
		if (parentId) {
			if (isNaN(parseInt(parentId))) {
				return NextResponse.json(
					{ error: 'Invalid parent post ID.' },
					{ status: 400 },
				);
			}
			const parentPost = await prisma.post.findUnique({
				where: { id: parentId },
			});
			if (!parentPost) {
				return NextResponse.json(
					{ error: 'Parent post not found.' },
					{ status: 404 },
				);
			}
			if (parentPost.isVisible === false) {
				return NextResponse.json(
					{ error: 'Parent post is hidden.' },
					{ status: 403 },
				);
			}
		}
		// Before creating the post, check if the content is toxic using Hugging Face Inference API
		let toxicityResult;
		if (EXTERNAL_MOCK_ENABLED || TOXIC_BERT_DISABLED) {
			toxicityResult = [{ label: 'non-toxic', score: 0.1 }];
		} else {
			try {
				toxicityResult = await client.textClassification({
					model: 'unitary/toxic-bert',
					inputs: content,
					provider: 'hf-inference',
				});
			} catch (err) {
				// Safe fallback: treat as non-toxic if API fails
				console.error('Toxicity check failed, using fallback:', err);
				toxicityResult = [{ label: 'non-toxic', score: 0.1 }];
			}
		}
		// buh moment
		// Toxicity result: [
		// 	{ label: 'toxic', score: 0.0006450944929383695 },
		// 	{ label: 'obscene', score: 0.00017940561519935727 },
		// 	{ label: 'insult', score: 0.0001686141622485593 },
		// 	{ label: 'identity_hate', score: 0.0001372406113659963 },
		// 	{ label: 'threat', score: 0.00012387109745759517 }
		//]
		// Iterate through the results and find the label with highest score
		const topModeration = getTopModerationResult(toxicityResult);
		const toxicityLabel = topModeration.label;
		const toxicityThreshold = topModeration.score;
		// If the content is not classified as toxic, but with score < 0.5, allow the post, but autocreate a report for moderator review.
		if (toxicityLabel === 'toxic' && toxicityThreshold > 0.1 && toxicityThreshold < 0.5) {
			const newPost = await prisma.post.create({
				data: {
					content,
					authorId: user.userId,
					threadId,
					parentId: parentId || null,
					isVisible: true,
				},
			});
			const responsePost = await serializePost(newPost.id);
			if (!responsePost) {
				return NextResponse.json(
					{ error: 'Failed to create post' },
					{ status: 500 },
				);
			}
			await prisma.report.create({
				data: {
					reportedById: user.userId,
					postId: newPost.id,
					threadId,
					reason: `Toxic content detected with score ${toxicityThreshold}`,
					aiVerdict: toxicityLabel,
					toxicity: toxicityThreshold,
				},
			});
			await invalidateRouteCache();
			return NextResponse.json(responsePost, { status: 200 });
		} else if (toxicityThreshold >= 0.5) {
			const newPost = await prisma.post.create({
				data: {
					content,
					authorId: user.userId,
					threadId,
					parentId: parentId || null,
					isVisible: true,
				},
			});
			const responsePost = await serializePost(newPost.id);
			if (!responsePost) {
				return NextResponse.json(
					{ error: 'Failed to create post' },
					{ status: 500 },
				);
			}
			await prisma.report.create({
				data: {
					reportedById: user.userId,
					postId: newPost.id,
					threadId,
					reason: `Highly toxic content detected with score ${toxicityThreshold}`,
					aiVerdict: toxicityLabel,
					toxicity: toxicityThreshold,
				},
			});
			await invalidateRouteCache();
			return NextResponse.json(responsePost, { status: 200 });
		}

		// If the content is non-toxic or low toxicity, create the post as normal
		const newPost = await prisma.post.create({
			data: {
				content,
				authorId: user.userId,
				threadId,
				parentId: parentId || null,
				isVisible: true,
			},
		});
		const responsePost = await serializePost(newPost.id);
		if (!responsePost) {
			return NextResponse.json(
				{ error: 'Failed to create post' },
				{ status: 500 },
			);
		}
		await invalidateRouteCache();
		return NextResponse.json(responsePost, { status: 200 });
	} catch (error) {
		console.error('Error creating post:', error);
		return NextResponse.json(
			{ error: 'Failed to create post' },
			{ status: 500 },
		);
	}
}

export async function GET(request) {
	const auth = await getAuthUserFromCookie(request);
	const isAdminViewer = !auth.error && auth.payload.role === 'ADMIN';
	const viewerScope = auth.error ? 'anon' : isAdminViewer ? 'admin' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(request, async () => {
	try {
		const { searchParams } = new URL(request.url);
		const postId = searchParams.get('id');
		const includeReplies = searchParams.get('includeReplies') !== 'false';
		const cursorRaw =
			request.headers.get('x-replies-cursor') || searchParams.get('cursor');
		const limitRaw =
			request.headers.get('x-replies-limit') || searchParams.get('limit');
		const parentIdRaw =
			request.headers.get('x-replies-parent-id') || searchParams.get('parentId');

		const parsedLimit = limitRaw
			? parseInt(limitRaw, 10)
			: DEFAULT_REPLY_PAGE_SIZE;
		if (isNaN(parsedLimit) || parsedLimit <= 0) {
			return NextResponse.json(
				{ error: 'Invalid replies limit.' },
				{ status: 400 },
			);
		}
		const limit = Math.min(parsedLimit, MAX_REPLY_PAGE_SIZE);

		const cursor = cursorRaw ? parseInt(cursorRaw, 10) : null;
		if (cursorRaw && isNaN(cursor)) {
			return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 });
		}

		const replyParentId = parentIdRaw ? parseInt(parentIdRaw, 10) : null;
		if (parentIdRaw && isNaN(replyParentId)) {
			return NextResponse.json(
				{ error: 'Invalid parentId.' },
				{ status: 400 },
			);
		}

		if (replyParentId) {
			const parentPost = await prisma.post.findUnique({
				where: { id: replyParentId },
				select: { id: true },
			});

			if (!parentPost) {
				return NextResponse.json(
					{ error: 'Parent post not found.' },
					{ status: 404 },
				);
			}

			const page = await fetchRepliesPage(replyParentId, limit, cursor, {
				includeHidden: isAdminViewer,
			});
			return NextResponse.json(
				{
					parentId: replyParentId,
					replies: page.replies,
					nextCursor: page.nextCursor,
					hasMore: page.hasMore,
				},
				{ status: 200 },
			);
		}

		if (!postId) {
			return NextResponse.json(
				{ error: 'Post ID is required.' },
				{ status: 400 },
			);
		}
		if (isNaN(parseInt(postId))) {
			return NextResponse.json(
				{ error: 'Invalid post ID.' },
				{ status: 400 },
			);
		}
		const parsedPostId = parseInt(postId);
		const post = await prisma.post.findUnique({
			where: { id: parsedPostId },
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
			return NextResponse.json(
				{ error: 'Post not found.' },
				{ status: 404 },
			);
		}

		if (!isAdminViewer && post.isVisible === false) {
			return NextResponse.json(
				{ error: 'Post is hidden.' },
				{ status: 403 },
			);
		}

		const visibleReplyCount = await prisma.post.count({
			where: { parentId: post.id, ...(isAdminViewer ? {} : { isVisible: true }) },
		});

		const postWithCounts = {
			...post,
			replyCount: visibleReplyCount,
		};

		if (!includeReplies) {
			return NextResponse.json(postWithCounts, { status: 200 });
		}

		const page = await fetchRepliesPage(parsedPostId, limit, cursor, {
			includeHidden: isAdminViewer,
		});
		return NextResponse.json(
			{
				...postWithCounts,
				replies: page.replies,
				repliesNextCursor: page.nextCursor,
				repliesHasMore: page.hasMore,
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
	}, { namespace: 'posts', ttlSeconds: 60, keyParts: [viewerScope] });
}
