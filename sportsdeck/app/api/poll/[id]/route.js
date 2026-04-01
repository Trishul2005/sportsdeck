import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';
import { getRedisClient } from '@/app/utils/redis';

const POLL_EDIT_HISTORY_VERDICT = '__poll_edit_history__';
const DEFAULT_HISTORY_PAGE_SIZE = 5;
const MAX_HISTORY_PAGE_SIZE = 50;
const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const TOXIC_BERT_DISABLED = process.env.DISABLE_TOXIC_BERT === 'true';
const THREADS_CACHE_PREFIX = 'threads';

function normalizeVersion(version, fallback = 1) {
	if (typeof version !== 'number' || Number.isNaN(version)) {
		return Math.max(1, fallback);
	}
	return Math.max(1, Math.trunc(version));
}

function parsePollId(value) {
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

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

function parsePollHistoryReason(reason) {
	try {
		const parsed = JSON.parse(reason);
		if (
			typeof parsed?.version === 'number' &&
			typeof parsed?.question === 'string' &&
			Array.isArray(parsed?.options)
		) {
			return {
				version: normalizeVersion(parsed.version),
				question: parsed.question,
				deadline:
					typeof parsed.deadline === 'string' ? parsed.deadline : null,
				options: parsed.options
					.map((option) => (typeof option === 'string' ? option : ''))
					.filter(Boolean),
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

async function serializePoll(pollId) {
	return prisma.poll.findUnique({
		where: { id: pollId },
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
				orderBy: {
					id: 'asc',
				},
			},
		},
	});
}

async function buildPollHistory(pollId) {
	const poll = await prisma.poll.findUnique({
		where: { id: pollId },
		include: {
			options: {
				orderBy: {
					id: 'asc',
				},
				select: {
					text: true,
				},
			},
		},
	});

	if (!poll) {
		return null;
	}

	const historyRows = await prisma.report.findMany({
		where: {
			pollId,
			aiVerdict: POLL_EDIT_HISTORY_VERDICT,
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
		const parsed = parsePollHistoryReason(row.reason);
		if (!parsed) continue;
		versionMap.set(parsed.version, parsed);
	}

	versionMap.set(normalizeVersion(poll.version), {
		version: normalizeVersion(poll.version),
		question: poll.question,
		deadline: poll.deadline?.toISOString?.() ?? null,
		options: poll.options.map((option) => option.text),
		editedAt: poll.updatedAt.toISOString(),
	});

	return Array.from(versionMap.values()).sort((a, b) => a.version - b.version);
}

async function createPollEditHistoryRecord(poll, userId) {
	const options = await prisma.pollOption.findMany({
		where: { pollId: poll.id },
		orderBy: { id: 'asc' },
		select: { text: true },
	});

	await prisma.report.create({
		data: {
			reportedById: userId,
			pollId: poll.id,
			threadId: poll.threadId,
			reason: JSON.stringify({
				version: normalizeVersion(poll.version),
				question: poll.question,
				deadline: poll.deadline.toISOString(),
				options: options.map((option) => option.text),
				editedAt: poll.updatedAt.toISOString(),
			}),
			aiVerdict: POLL_EDIT_HISTORY_VERDICT,
		},
	});
}

async function maybeCreatePollModerationReport({
	pollId,
	threadId,
	reportedById,
	question,
	options,
}) {
	const moderationInput = buildPollModerationInput({ question, options });
	if (!moderationInput) return;

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
	if (toxicityLabel !== 'toxic' || toxicityThreshold <= 0.1) {
		return;
	}

	await prisma.report.create({
		data: {
			reportedById,
			pollId,
			threadId,
			reason:
				toxicityThreshold >= 0.5
					? `Highly toxic poll content detected with score ${toxicityThreshold}`
					: `Toxic poll content detected with score ${toxicityThreshold}`,
			aiVerdict: toxicityLabel,
			toxicity: toxicityThreshold,
		},
	});
}

export async function GET(request, { params }) {
	const auth = await getAuthUserFromCookie(request);
	const isAdminViewer = !auth.error && auth.payload.role === 'ADMIN';
	const viewerScope = auth.error ? 'anon' : isAdminViewer ? 'admin' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(
		request,
		async () => {
			try {
				const pollId = parsePollId((await params).id);
				if (pollId === null) {
					return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
				}

				const { searchParams } = new URL(request.url);
				const includeHistory = searchParams.get('includeHistory') === 'true';
				const parsedLimit = searchParams.get('limit')
					? parseInt(searchParams.get('limit'), 10)
					: DEFAULT_HISTORY_PAGE_SIZE;
				if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
					return NextResponse.json({ error: 'Invalid history limit.' }, { status: 400 });
				}
				const limit = Math.min(parsedLimit, MAX_HISTORY_PAGE_SIZE);

				const cursorRaw = searchParams.get('cursor');
				const cursor = cursorRaw ? parseInt(cursorRaw, 10) : null;
				if (cursorRaw && Number.isNaN(cursor)) {
					return NextResponse.json({ error: 'Invalid history cursor.' }, { status: 400 });
				}

				const serialized = await serializePoll(pollId);
				if (!serialized) {
					return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
				}
				if (!isAdminViewer && serialized.isVisible === false) {
					return NextResponse.json({ error: 'Poll is hidden.' }, { status: 403 });
				}

				if (!includeHistory) {
					return NextResponse.json(serialized, { status: 200 });
				}

				const allVersions = await buildPollHistory(pollId);
				if (!allVersions) {
					return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
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
				console.error('Error fetching poll:', error);
				return NextResponse.json({ error: 'Failed to fetch poll' }, { status: 500 });
			}
		},
		{ namespace: 'poll-detail', ttlSeconds: 60, keyParts: [viewerScope] },
	);
}

export async function PUT(request, { params }) {
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

		const pollId = parsePollId((await params).id);
		if (pollId === null) {
			return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		const body = await request.json();
		const { question, options, deadline, isVisible } = body;

		const wantsQuestionUpdate = question !== undefined;
		const wantsOptionsUpdate = options !== undefined;
		const wantsDeadlineUpdate = deadline !== undefined;
		const wantsVisibilityUpdate = isVisible !== undefined;
		if (!wantsQuestionUpdate && !wantsOptionsUpdate && !wantsDeadlineUpdate && !wantsVisibilityUpdate) {
			return NextResponse.json({ error: 'No update fields provided.' }, { status: 400 });
		}

		const existingPoll = await prisma.poll.findUnique({
			where: { id: pollId },
			include: {
				options: {
					select: { id: true, text: true },
					orderBy: { id: 'asc' },
				},
			},
		});
		if (!existingPoll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}

		if (
			existingPoll.createdById !== user.userId &&
			userRecord.role !== 'ADMIN'
		) {
			return NextResponse.json({ error: 'User is not the creator of the poll' }, { status: 403 });
		}

		if (wantsQuestionUpdate && (typeof question !== 'string' || !question.trim())) {
			return NextResponse.json({ error: 'Poll question is required.' }, { status: 400 });
		}

		let normalizedOptions = null;
		if (wantsOptionsUpdate) {
			if (!Array.isArray(options)) {
				return NextResponse.json({ error: 'Options must be an array.' }, { status: 400 });
			}
			normalizedOptions = options
				.map((option) => (typeof option === 'string' ? option.trim() : ''))
				.filter(Boolean);
			if (normalizedOptions.length < 2) {
				return NextResponse.json({ error: 'At least 2 valid options required' }, { status: 400 });
			}
		}

		if (wantsDeadlineUpdate && (typeof deadline !== 'string' || Number.isNaN(Date.parse(deadline)))) {
			return NextResponse.json({ error: 'Invalid deadline format' }, { status: 400 });
		}
		if (wantsDeadlineUpdate && new Date(deadline) <= new Date()) {
			return NextResponse.json({ error: 'Deadline must be in the future' }, { status: 400 });
		}
		if (wantsVisibilityUpdate && typeof isVisible !== 'boolean') {
			return NextResponse.json({ error: 'isVisible must be a boolean.' }, { status: 400 });
		}

		const normalizedQuestion = wantsQuestionUpdate ? question.trim() : existingPoll.question;
		const normalizedDeadline = wantsDeadlineUpdate ? new Date(deadline) : existingPoll.deadline;
		const currentOptions = existingPoll.options.map((option) => option.text);
		const nextOptions = normalizedOptions ?? currentOptions;
		const normalizedVisible = wantsVisibilityUpdate ? isVisible : existingPoll.isVisible;

		const hasMeaningfulChange =
			normalizedQuestion !== existingPoll.question ||
			normalizedDeadline.getTime() !== existingPoll.deadline.getTime() ||
			normalizedVisible !== existingPoll.isVisible ||
			nextOptions.length !== currentOptions.length ||
			nextOptions.some((option, index) => option !== currentOptions[index]);

		if (!hasMeaningfulChange) {
			const unchangedPoll = await serializePoll(pollId);
			return NextResponse.json(unchangedPoll, { status: 200 });
		}

		const availableByKey = new Map();
		for (const option of existingPoll.options) {
			const key = option.text.trim().toLowerCase();
			const bucket = availableByKey.get(key) || [];
			bucket.push(option);
			availableByKey.set(key, bucket);
		}

		const keepOptionIds = [];
		const optionUpdates = [];
		const optionCreates = [];

		if (normalizedOptions) {
			for (const nextText of normalizedOptions) {
				const key = nextText.toLowerCase();
				const bucket = availableByKey.get(key);
				const matched = Array.isArray(bucket) && bucket.length > 0 ? bucket.shift() : null;

				if (matched) {
					keepOptionIds.push(matched.id);
					if (matched.text !== nextText) {
						optionUpdates.push({ id: matched.id, text: nextText });
					}
				} else {
					optionCreates.push(nextText);
				}
			}
		}

		await createPollEditHistoryRecord(existingPoll, user.userId);

		const updatedPoll = await prisma.$transaction(async (tx) => {
			const nextVersion = normalizeVersion(existingPoll.version) + 1;
			await tx.poll.update({
				where: { id: pollId },
				data: {
					question: normalizedQuestion,
					deadline: normalizedDeadline,
					isVisible: normalizedVisible,
					version: nextVersion,
				},
			});

			if (normalizedQuestion !== existingPoll.question && existingPoll.postId) {
				await tx.post.update({
					where: { id: existingPoll.postId },
					data: { content: `Poll thread: ${normalizedQuestion}` },
				});
			}

			if (optionUpdates.length > 0) {
				await Promise.all(
					optionUpdates.map((update) =>
						tx.pollOption.update({
							where: { id: update.id },
							data: { text: update.text },
						}),
					),
				);
			}

			if (optionCreates.length > 0) {
				const created = await Promise.all(
					optionCreates.map((text) =>
						tx.pollOption.create({
							data: { pollId, text },
							select: { id: true },
						}),
					),
				);
				for (const option of created) keepOptionIds.push(option.id);
			}

			if (normalizedOptions) {
				await tx.pollOption.deleteMany({
					where: { pollId, id: { notIn: keepOptionIds } },
				});
			}

			if (!normalizedVisible && existingPoll.threadId) {
				await tx.thread.update({
					where: { id: existingPoll.threadId },
					data: { isVisible: false, isClosed: true },
				});
			}

			return tx.poll.findUnique({
				where: { id: pollId },
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
						orderBy: { id: 'asc' },
					},
				},
			});
		});

		await maybeCreatePollModerationReport({
			pollId,
			threadId: existingPoll.threadId,
			reportedById: user.userId,
			question: normalizedQuestion,
			options: nextOptions,
		});
		await invalidateThreadsCache();
		await invalidateRouteCache();
		return NextResponse.json(updatedPoll, { status: 200 });
	} catch (error) {
		console.error('Error updating poll:', error);
		return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 });
	}
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

		const pollId = parsePollId((await params).id);
		if (pollId === null) {
			return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		const existingPoll = await prisma.poll.findUnique({
			where: { id: pollId },
		});
		if (!existingPoll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}
		if (existingPoll.createdById !== user.userId && userRecord.role !== 'ADMIN') {
			return NextResponse.json({ error: 'User is not the creator of the poll' }, { status: 403 });
		}

		await prisma.poll.delete({ where: { id: pollId } });
		await invalidateThreadsCache();
		await invalidateRouteCache();
		return NextResponse.json({ message: 'Poll deleted successfully' });
	} catch (error) {
		console.error('Error deleting poll:', error);
		return NextResponse.json({ error: 'Failed to delete poll' }, { status: 500 });
	}
}
