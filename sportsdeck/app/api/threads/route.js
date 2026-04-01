import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { getRedisClient } from '@/app/utils/redis';
import { invalidateRouteCache } from '@/app/utils/routeCache';

const REDIS_THREADS_TTL_SECONDS = 60;
const THREADS_CACHE_PREFIX = 'threads';
const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const TOXIC_BERT_DISABLED = process.env.DISABLE_TOXIC_BERT === 'true';

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

function buildThreadModerationInput({ title, poll }) {
	const pieces = [typeof title === 'string' ? title.trim() : ''].filter(Boolean);

	if (poll?.question) {
		pieces.push(poll.question);
	}

	if (Array.isArray(poll?.options) && poll.options.length > 0) {
		pieces.push(`Poll options: ${poll.options.join(' | ')}`);
	}

	return pieces.join('\n');
}

function buildThreadsCacheKey(searchParams, userCacheScope = 'anon') {
	const normalizedTags = searchParams
		.getAll('tags')
		.flatMap((tagGroup) => String(tagGroup || '').split(','))
		.map((tag) => tag.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	return [
		THREADS_CACHE_PREFIX,
		searchParams.get('title') || 'all',
		searchParams.get('author') || 'all',
		searchParams.get('team') || 'all',
		normalizedTags.join('|') || 'all',
		searchParams.get('page') || '1',
		searchParams.get('pageSize') || '10',
		searchParams.get('includeMeta') || 'false',
		searchParams.get('includeTotal') ?? 'true',
		searchParams.get('lite') || 'false',
		searchParams.get('sort') || 'created_desc',
		userCacheScope,
	].join(':');
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

function normalizeThreadRecords(records) {
	if (!Array.isArray(records)) return records;
	return records.map((r) => ({
		...r,
		isClosed: Boolean(r.isClosed),
	}));
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

		const { title, mainPostId, teamId, matchId, tags, poll } = await request.json();
		const hasPollPayload = poll && typeof poll === 'object';
		const hasMainPostId = mainPostId !== undefined && mainPostId !== null;

		if (!title || (!hasMainPostId && !hasPollPayload) || (hasMainPostId && hasPollPayload)) {
			return NextResponse.json(
				{
					error:
						'Title is required and provide exactly one mode: mainPostId (discussion) or poll (poll thread).',
				},
				{ status: 400 },
			);
		}

		let resolvedMainPostId = null;
		let normalizedPoll = null;

		if (hasMainPostId) {
			if (isNaN(parseInt(mainPostId))) {
				return NextResponse.json(
					{ error: 'mainPostId must be a valid number.' },
					{ status: 400 },
				);
			}

			resolvedMainPostId = parseInt(mainPostId);

			// Verify the post exists
			const post = await prisma.post.findUnique({
				where: { id: resolvedMainPostId },
			});
			if (!post) {
				return NextResponse.json(
					{ error: 'Post not found.' },
					{ status: 404 },
				);
			}

			// Verify the post was created by the requesting user
			if (post.authorId !== user.userId) {
				return NextResponse.json(
					{ error: 'You can only create threads with your own posts.' },
					{ status: 403 },
				);
			}

			// Verify the post is not already used as a main post for another thread
			const existingThread = await prisma.thread.findFirst({
				where: { mainPostId: resolvedMainPostId },
			});
			if (existingThread) {
				return NextResponse.json(
					{
						error: 'This post is already used as a main post for another thread.',
					},
					{ status: 400 },
				);
			}
		} else if (hasPollPayload) {
			const question = typeof poll.question === 'string' ? poll.question.trim() : '';
			const options = Array.isArray(poll.options)
				? poll.options
						.map((option) => (typeof option === 'string' ? option.trim() : ''))
						.filter(Boolean)
				: [];
			const deadline = typeof poll.deadline === 'string' ? poll.deadline : '';

			if (!question) {
				return NextResponse.json(
					{ error: 'Poll question is required for poll threads.' },
					{ status: 400 },
				);
			}
			if (options.length < 2) {
				return NextResponse.json(
					{ error: 'Poll threads require at least two options.' },
					{ status: 400 },
				);
			}
			if (!deadline || Number.isNaN(Date.parse(deadline))) {
				return NextResponse.json(
					{ error: 'Poll threads require a valid deadline.' },
					{ status: 400 },
				);
			}
			if (new Date(deadline) <= new Date()) {
				return NextResponse.json(
					{ error: 'Poll deadline must be in the future.' },
					{ status: 400 },
				);
			}

			normalizedPoll = {
				question,
				options,
				deadline: new Date(deadline),
			};
		}

		if (teamId && isNaN(parseInt(teamId))) {
			return NextResponse.json(
				{ error: 'teamId must be a valid number if provided.' },
				{ status: 400 },
			);
		}

		if (matchId && isNaN(parseInt(matchId))) {
			return NextResponse.json(
				{ error: 'matchId must be a valid number if provided.' },
				{ status: 400 },
			);
		}

		// if teamId is provided, check if team exists
		if (teamId) {
			const teamExists = await prisma.team.findUnique({
				where: { id: parseInt(teamId) },
			});
			if (!teamExists) {
				return NextResponse.json(
					{ error: 'Team not found.' },
					{ status: 404 },
				);
			}
		}

		let matchWindow = null;
		let selectedMatch = null;
		if (matchId) {
			const parsedMatchId = parseInt(matchId);
			const matchExists = await prisma.match.findUnique({
				where: { id: parsedMatchId },
				select: {
					id: true,
					date: true,
					homeTeamId: true,
					awayTeamId: true,
					homeTeam: { select: { name: true } },
					awayTeam: { select: { name: true } },
				},
			});
			if (!matchExists) {
				return NextResponse.json(
					{ error: 'Match not found.' },
					{ status: 404 },
				);
			}

			if (
				teamId &&
				parseInt(teamId) !== matchExists.homeTeamId &&
				parseInt(teamId) !== matchExists.awayTeamId
			) {
				return NextResponse.json(
					{ error: 'Selected team must participate in the selected match.' },
					{ status: 400 },
				);
			}

			if (matchExists.date) {
				const tipOff = new Date(matchExists.date);
				const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
				const opensAt = new Date(tipOff.getTime() - twoWeeksMs);
				const closesAt = new Date(tipOff.getTime() + twoWeeksMs);
				matchWindow = {
					opensAt,
					closesAt,
					isClosed: Date.now() >= closesAt.getTime(),
				};
			}

			selectedMatch = matchExists;
		}

		// TODO: need to validate tags and check for new tags that need to be created or already existing ones
		// Note: Tags should already be a list of strings in body.

		const requestedTagNames = Array.isArray(tags)
			? tags
					.map((tagName) =>
						typeof tagName === 'string' ? tagName.trim() : '',
					)
					.filter(Boolean)
			: [];

		// If a thread is linked to a match, ensure both teams are represented as tags.
		if (selectedMatch?.homeTeam?.name) {
			requestedTagNames.push(selectedMatch.homeTeam.name);
		}
		if (selectedMatch?.awayTeam?.name) {
			requestedTagNames.push(selectedMatch.awayTeam.name);
		}

		const seenTagKeys = new Set();
		const normalizedTagNames = requestedTagNames.filter((tagName) => {
			const key = tagName.toLowerCase();
			if (seenTagKeys.has(key)) {
				return false;
			}
			seenTagKeys.add(key);
			return true;
		});

		const normalizedTagIds = normalizedTagNames.length
			? (
					await Promise.all(
						normalizedTagNames.map((tagName) =>
							prisma.tag.upsert({
								where: { name: tagName },
								update: {},
								create: { name: tagName },
								select: { id: true },
							}),
						),
					)
			  ).map((tag) => tag.id)
			: [];

			// Enforce maximum tags per thread
			if (normalizedTagNames.length > 5) {
				return NextResponse.json({ error: 'A thread can have at most 5 tags.' }, { status: 400 });
			}

		const newThread = await prisma.$transaction(async (tx) => {
			let effectiveMainPostId = resolvedMainPostId;

			if (!effectiveMainPostId && normalizedPoll) {
				const placeholderPost = await tx.post.create({
					data: {
						content: `Poll thread: ${normalizedPoll.question}`,
						authorId: user.userId,
					},
					select: { id: true },
				});
				effectiveMainPostId = placeholderPost.id;
			}

			const createdThread = await tx.thread.create({
				data: {
					title,
					createdById: user.userId,
					teamId: teamId ? parseInt(teamId) : null,
					matchId: matchId ? parseInt(matchId) : null,
					opensAt: matchWindow?.opensAt ?? null,
					closesAt: matchWindow?.closesAt ?? null,
					isClosed: matchWindow?.isClosed ?? false,
					mainPostId: effectiveMainPostId,
					tags: {
						create: normalizedTagIds.map((tagId) => ({
							tag: {
								connect: { id: tagId },
							},
						})),
					},
				},
				select: { id: true },
			});

			await tx.post.update({
				where: { id: effectiveMainPostId },
				data: { threadId: createdThread.id },
			});

			if (normalizedPoll) {
				await tx.poll.create({
					data: {
						question: normalizedPoll.question,
						deadline: normalizedPoll.deadline,
						threadId: createdThread.id,
						postId: effectiveMainPostId,
						createdById: user.userId,
						options: {
							create: normalizedPoll.options.map((optionText) => ({
								text: optionText,
							})),
						},
					},
				});
			}

			return tx.thread.findUnique({
				where: { id: createdThread.id },
				include: {
					tags: { include: { tag: true } },
					mainPost: true,
					polls: {
						include: {
							options: {
								include: { votes: true },
							},
						},
						take: 1,
					},
				},
			});
		}, { timeout: 15000, maxWait: 10000 });

		const moderationInput = buildThreadModerationInput({
			title,
			poll: normalizedPoll,
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
					console.error('Thread toxicity check failed, using fallback:', err);
					toxicityResult = [{ label: 'non-toxic', score: 0.1 }];
				}
			}

			const topModeration = getTopModerationResult(toxicityResult);
			const toxicityLabel = topModeration.label;
			const toxicityThreshold = topModeration.score;

			if (toxicityLabel === 'toxic' && toxicityThreshold > 0.1) {
				const primaryPollId =
					Array.isArray(newThread.polls) && newThread.polls.length > 0
						? newThread.polls[0].id
						: null;
				await prisma.report.create({
					data: {
						reportedById: user.userId,
						threadId: newThread.id,
						pollId: primaryPollId,
						reason:
							toxicityThreshold >= 0.5
								? primaryPollId
									? `Highly toxic poll content detected with score ${toxicityThreshold}`
									: `Highly toxic thread content detected with score ${toxicityThreshold}`
								: primaryPollId
									? `Toxic poll content detected with score ${toxicityThreshold}`
									: `Toxic thread content detected with score ${toxicityThreshold}`,
						aiVerdict: toxicityLabel,
						toxicity: toxicityThreshold,
					},
				});
			}
		}

		await invalidateThreadsCache();
		await invalidateRouteCache();

		return NextResponse.json(newThread, { status: 200 });
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Failed to create thread' },
			{ status: 500 },
		);
	}
}

export async function GET(request) {
	try {
		const now = new Date();
		const { searchParams } = new URL(request.url);
		const sortParam = searchParams.get('sort') || 'created_desc';
		const auth = await getAuthUserFromCookie(request);
		const isAdminViewer = !auth.error && auth.payload.role === 'ADMIN';
		const userCacheScope = auth.error
			? 'anon'
			: isAdminViewer
				? 'admin'
				: `user:${auth.payload.userId}`;

		const cacheKey = buildThreadsCacheKey(searchParams, userCacheScope);
		try {
			const redis = await getRedisClient();
			const cachedPayload = await redis.get(cacheKey);
			if (cachedPayload) {
				const parsed = JSON.parse(cachedPayload);
				return NextResponse.json(parsed);
			}
		} catch (redisError) {
			console.error('Redis threads cache read failed:', redisError);
		}

		const title = searchParams.get('title');
		const author = searchParams.get('author');
		const team = searchParams.get('team');
		const tags = searchParams.getAll('tags');
		// Normalize tags to an array (supports ?tags=a,b or ?tags=a&tags=b)
		const normalizedTags = tags
			.flatMap((tagGroup) => String(tagGroup || '').split(','))
			.map((t) => t.trim())
			.filter(Boolean);
		// Get the authorId, teamId if author or team filters are provided:
		let teamId;
		let authorId;
		if (author) {
			const authorUser = await prisma.user.findUnique({
				where: { username: author },
			});
			if (!authorUser) {
				return NextResponse.json(
					{ error: 'Author not found.' },
					{ status: 404 },
				);
			}
			authorId = authorUser.id;
		}
		if (team) {
			const teamData = await prisma.team.findFirst({
				where: { name: team },
			});
			if (!teamData) {
				return NextResponse.json(
					{ error: 'Team not found.' },
					{ status: 404 },
				);
			}
			teamId = teamData.id;
		}
		// (normalizedTags already computed above)
		// Paginate the threads:
		const pageParam = searchParams.get('page');
		const pageSizeParam = searchParams.get('pageSize');
		const includeMeta = searchParams.get('includeMeta') === 'true';
		const includeTotal = searchParams.get('includeTotal') !== 'false';
		const lite = searchParams.get('lite') === 'true';

		const page = pageParam === null ? 1 : parseInt(pageParam, 10);
		const pageSize =
			pageSizeParam === null ? 10 : parseInt(pageSizeParam, 10);

		if (
			Number.isNaN(page) ||
			Number.isNaN(pageSize) ||
			page < 1 ||
			pageSize < 1
		) {
			return NextResponse.json(
				{ error: 'Page and pageSize must be positive integers.' },
				{ status: 400 },
			);
		}

		const validSorts = new Set([
			'created_desc',
			'created_asc',
			'alpha_asc',
			'alpha_desc',
			'interacted_desc',
		]);
		if (!validSorts.has(sortParam)) {
			return NextResponse.json(
				{ error: 'Invalid sort option.' },
				{ status: 400 },
			);
		}
		const skip = (page - 1) * pageSize;
		const queryTake = includeMeta && !includeTotal ? pageSize + 1 : pageSize;

		const where = {
			...(isAdminViewer ? {} : { isVisible: true }),
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
		};
		if (title) {
			where.title = { contains: title };
		}
		if (author) {
			where.createdById = authorId;
		}
		if (team) {
			where.teamId = teamId;
		}
		if (normalizedTags.length > 0) {
			where.tags = {
				some: {
					tag: { name: { in: normalizedTags } },
				},
			};
		}

		const baseSelect = lite
			    ? {
				    id: true,
				    isVisible: true,
				    isClosed: true,
				    title: true,
					createdAt: true,
					createdBy: {
						select: {
							username: true,
						},
					},
					_count: {
						select: {
							posts: true,
						},
					},
				}
			: {
					id: true,
				isVisible: true,
				isClosed: true,
					title: true,
					teamId: true,
					matchId: true,
					createdAt: true,
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
					tags: { include: { tag: true } },
					match: {
						select: {
							id: true,
							date: true,
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
				};

		let total = 0;
		let threads = [];
		let hasNext = false;

		if (sortParam === 'interacted_desc') {
			if (!auth.error) {
				const interactionRows = await prisma.post.findMany({
					where: {
						authorId: auth.payload.userId,
						threadId: { not: null },
						thread: where,
					},
					select: {
						threadId: true,
						updatedAt: true,
					},
					orderBy: { updatedAt: 'desc' },
				});

				const orderedThreadIds = [];
				const seen = new Set();
				for (const row of interactionRows) {
					if (!row.threadId || seen.has(row.threadId)) continue;
					seen.add(row.threadId);
					orderedThreadIds.push(row.threadId);
				}

				if (includeTotal) {
					total = orderedThreadIds.length;
				}
				const pagedIds = orderedThreadIds.slice(skip, skip + queryTake);
				hasNext = !includeTotal && pagedIds.length > pageSize;
				const visibleIds = includeTotal ? pagedIds : pagedIds.slice(0, pageSize);

				if (visibleIds.length > 0) {
					const interactedThreads = await prisma.thread.findMany({
						where: { id: { in: visibleIds } },
						select: baseSelect,
					});
					const byId = new Map(interactedThreads.map((thread) => [thread.id, thread]));
					threads = visibleIds.map((id) => byId.get(id)).filter(Boolean);
				}
			} else {
				if (includeTotal) {
					total = await prisma.thread.count({ where });
					threads = await prisma.thread.findMany({
						where,
						select: baseSelect,
						skip,
						take: pageSize,
						orderBy: [{ createdAt: 'desc' }],
					});
				} else {
					threads = await prisma.thread.findMany({
						where,
						select: baseSelect,
						skip,
						take: queryTake,
						orderBy: [{ createdAt: 'desc' }],
					});
					hasNext = threads.length > pageSize;
					threads = threads.slice(0, pageSize);
				}
			}
		} else {
			const orderBy =
				sortParam === 'created_asc'
					? [{ createdAt: 'asc' }]
					: sortParam === 'alpha_asc'
						? [{ title: 'asc' }, { createdAt: 'desc' }]
						: sortParam === 'alpha_desc'
							? [{ title: 'desc' }, { createdAt: 'desc' }]
							: [{ createdAt: 'desc' }];

			if (includeMeta && includeTotal) {
				[total, threads] = await prisma.$transaction([
					prisma.thread.count({ where }),
					prisma.thread.findMany({
						where,
						select: baseSelect,
						skip,
						take: pageSize,
						orderBy,
					}),
				]);
			} else if (includeMeta) {
				threads = await prisma.thread.findMany({
					where,
					select: baseSelect,
					skip,
					take: queryTake,
					orderBy,
				});
				hasNext = threads.length > pageSize;
				threads = threads.slice(0, pageSize);
			} else {
				threads = await prisma.thread.findMany({
					where,
					select: baseSelect,
					skip,
					take: pageSize,
					orderBy,
				});
			}
		}
		if (!threads) {
			return NextResponse.json(
				{ error: 'Error fetching threads.' },
				{ status: 500 },
			);
		}

		if (includeMeta) {
			const responsePayload = {
				items: threads,
				...(includeTotal
					? {
							total,
							pageCount: Math.max(1, Math.ceil(total / pageSize)),
						}
					: {
							hasNext,
							hasPrev: page > 1,
						}),
				page,
				pageSize,
			};

			try {
				const redis = await getRedisClient();
				await redis.set(cacheKey, JSON.stringify(responsePayload), {
					EX: REDIS_THREADS_TTL_SECONDS,
				});
			} catch (redisError) {
				console.error('Redis threads cache write failed:', redisError);
			}

			return NextResponse.json(responsePayload, { status: 200 });
		}

		try {
			const redis = await getRedisClient();
			await redis.set(cacheKey, JSON.stringify(threads), {
				EX: REDIS_THREADS_TTL_SECONDS,
			});
		} catch (redisError) {
			console.error('Redis threads cache write failed:', redisError);
		}

		return NextResponse.json(threads, { status: 200 });
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Error fetching threads.' },
			{ status: 500 },
		);
	}
}
