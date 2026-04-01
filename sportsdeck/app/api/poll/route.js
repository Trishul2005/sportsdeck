import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';
import { getRedisClient } from '@/app/utils/redis';

const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const TOXIC_BERT_DISABLED = process.env.DISABLE_TOXIC_BERT === 'true';
const THREADS_CACHE_PREFIX = 'threads';

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

function buildPollModerationInput({ question, options }) {
	const pieces = [typeof question === 'string' ? question.trim() : ''].filter(Boolean);

	if (Array.isArray(options) && options.length > 0) {
		pieces.push(`Poll options: ${options.join(' | ')}`);
	}

	return pieces.join('\n');
}

async function invalidateThreadsCache() {
	try {
		const redis = await getRedisClient();
		const keys = await redis.keys(`${THREADS_CACHE_PREFIX}:*`);
		if (keys.length > 0) {
			await redis.del(keys);
		}
	} catch (redisError) {
		console.error('Redis threads cache invalidation failed:', redisError);
	}
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

		const { threadId, question, options, deadline, postId } =
			await request.json();
		if (!threadId || isNaN(parseInt(threadId))) {
			return NextResponse.json(
				{ error: 'Valid threadId is required.' },
				{ status: 400 },
			);
		}
		if (!question) {
			return NextResponse.json(
				{ error: 'Question is required.' },
				{ status: 400 },
			);
		}
		if (!options || !Array.isArray(options) || options.length < 2) {
			return NextResponse.json(
				{ error: 'At least two options are required.' },
				{ status: 400 },
			);
		}
		if (!deadline || isNaN(Date.parse(deadline))) {
			return NextResponse.json(
				{ error: 'Valid deadline is required.' },
				{ status: 400 },
			);
		}

		// Check for thread being closed before allowing poll creation
		const thread = await prisma.thread.findUnique({
			where: { id: parseInt(threadId) },
		});
		if (!thread) {
			return NextResponse.json(
				{ error: 'Thread not found.' },
				{ status: 404 },
			);
		}
		if (thread.isClosed) {
			return NextResponse.json(
				{ error: 'Cannot create poll in a closed thread.' },
				{ status: 403 },
			);
		}
		if (thread.isVisible === false) {
			return NextResponse.json(
				{ error: 'Cannot create poll in a hidden thread.' },
				{ status: 403 },
			);
		}

		const existingPoll = await prisma.poll.findFirst({
			where: { threadId: parseInt(threadId) },
			select: { id: true },
		});
		if (existingPoll) {
			return NextResponse.json(
				{ error: 'This thread already has a poll.' },
				{ status: 400 },
			);
		}

		const resolvedPostId = postId ? parseInt(postId) : thread.mainPostId;
		if (!resolvedPostId) {
			return NextResponse.json(
				{ error: 'Polls can only be attached to a thread main post.' },
				{ status: 400 },
			);
		}
		if (postId && isNaN(parseInt(postId))) {
			return NextResponse.json(
				{ error: 'Invalid postId.' },
				{ status: 400 },
			);
		}
		if (resolvedPostId !== thread.mainPostId) {
			return NextResponse.json(
				{ error: 'Polls can only be created on the thread main post.' },
				{ status: 400 },
			);
		}

		const post = await prisma.post.findUnique({
			where: { id: resolvedPostId },
			select: { id: true, threadId: true, parentId: true },
		});
		if (!post || post.threadId !== parseInt(threadId)) {
			return NextResponse.json(
				{ error: 'Main post not found for this thread.' },
				{ status: 404 },
			);
		}
		if (post.parentId !== null) {
			return NextResponse.json(
				{ error: 'Polls cannot be created on replies.' },
				{ status: 400 },
			);
		}

		// Then check for valid datetime and that the deadline is in the future
		const deadlineDate = new Date(deadline);
		if (deadlineDate <= new Date()) {
			return NextResponse.json(
				{ error: 'Deadline must be in the future.' },
				{ status: 400 },
			);
		}
		const normalizedQuestion = typeof question === 'string' ? question.trim() : '';
		const normalizedOptions = options
			.map((optionText) => (typeof optionText === 'string' ? optionText.trim() : ''))
			.filter(Boolean);

		// Create poll with options:
		const newPoll = await prisma.poll.create({
			data: {
				question: normalizedQuestion,
				deadline: deadlineDate,
				threadId: parseInt(threadId),
				createdById: user.userId,
				postId: resolvedPostId,
				options: {
					create: normalizedOptions.map((optionText) => ({ text: optionText })),
				},
			},
			include: {
				options: true,
			},
		});
		const moderationInput = buildPollModerationInput({
			question: normalizedQuestion,
			options: normalizedOptions,
		});
		if (moderationInput) {
			let toxicityResult;
			if (EXTERNAL_MOCK_ENABLED || TOXIC_BERT_DISABLED) {
				toxicityResult = [{ label: 'non-toxic', score: 0.1 }];
			} else {
				try {
					toxicityResult = await client.textClassification({
						model: 'unitary/toxic-bert',
						inputs: moderationInput,
						provider: 'hf-inference',
					});
				} catch (err) {
					console.error('Poll toxicity check failed, using fallback:', err);
					toxicityResult = [{ label: 'non-toxic', score: 0.1 }];
				}
			}

			const topModeration = getTopModerationResult(toxicityResult);
			const toxicityLabel = topModeration.label;
			const toxicityThreshold = topModeration.score;

			if (toxicityLabel === 'toxic' && toxicityThreshold > 0.1) {
				await prisma.report.create({
					data: {
						reportedById: user.userId,
						pollId: newPoll.id,
						threadId: parseInt(threadId),
						reason:
							toxicityThreshold >= 0.5
								? `Highly toxic poll content detected with score ${toxicityThreshold}`
								: `Toxic poll content detected with score ${toxicityThreshold}`,
						aiVerdict: toxicityLabel,
						toxicity: toxicityThreshold,
					},
				});
			}
		}
		await invalidateThreadsCache();
		await invalidateRouteCache();
		return NextResponse.json(newPoll, { status: 200 });
	} catch (error) {
		console.error('Error creating poll:', error);
		return NextResponse.json(
			{ error: 'Failed to create poll' },
			{ status: 500 },
		);
	}
}

export async function GET(request) {
	return withRedisRouteCache(request, async () => {
	try {
		const { searchParams } = new URL(request.url);
		const threadId = searchParams.get('threadId');
		const postId = searchParams.get('postId');
		if (threadId && isNaN(parseInt(threadId))) {
			return NextResponse.json(
				{ error: 'threadId must be a valid number if provided.' },
				{ status: 400 },
			);
		}
		if (postId && isNaN(parseInt(postId))) {
			return NextResponse.json(
				{ error: 'postId must be a valid number if provided.' },
				{ status: 400 },
			);
		}
		// Check that thread exists if threadId is provided, postId as well.
		if (threadId) {
			const thread = await prisma.thread.findUnique({
				where: { id: parseInt(threadId) },
			});
			if (!thread) {
				return NextResponse.json(
					{ error: 'Thread not found.' },
					{ status: 404 },
				);
			}
		}
		if (postId) {
			const post = await prisma.post.findUnique({
				where: { id: parseInt(postId) },
			});
			if (!post) {
				return NextResponse.json(
					{ error: 'Post not found.' },
					{ status: 404 },
				);
			}
		}
		// Paginate the polls, include options and votes count for each option, and the user who created the pol
		const page = parseInt(searchParams.get('page')) || 1;
		const pageSize = parseInt(searchParams.get('pageSize')) || 10;
		const skip = (page - 1) * pageSize;
		const polls = await prisma.poll.findMany({
			where: {
				...(threadId && { threadId: parseInt(threadId) }),
				...(postId && { postId: parseInt(postId) }),
			},
			include: {
				options: {
					include: {
						votes: true,
					},
				},
				createdBy: {
					select: {
						id: true,
						username: true,
						avatar: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
			skip,
			take: pageSize,
		});
		return NextResponse.json(polls, { status: 200 });
	} catch (error) {
		console.error('Error fetching polls:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch polls' },
			{ status: 500 },
		);
	}
	}, { namespace: 'polls', ttlSeconds: 60 });
}
