import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { prisma } from '@/prisma/db';
import { withRedisRouteCache } from '@/app/utils/routeCache';

const client = new InferenceClient(process.env.HF_TOKEN);
const HF_TIMEOUT_MS = 15000;
const DIGEST_CACHE_TTL_MS = 10 * 60 * 1000;
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' || process.env.NODE_ENV === 'test';
const digestCache = new Map();
const digestInFlight = new Map();

class InferenceTimeoutError extends Error {}

function isMissingTableError(error) {
	return error?.code === 'P2021';
}

async function safeQuery(fn, fallbackValue) {
	try {
		return await fn();
	} catch (error) {
		if (isMissingTableError(error)) {
			return fallbackValue;
		}
		throw error;
	}
}

function parseDigestDate(dateParam) {
	if (!dateParam) {
		const now = new Date();
		return new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
	}

	const parsed = new Date(`${dateParam}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

function isGeneratedMatchThread(thread) {
	if (!thread?.matchId) {
		return false;
	}

	const normalizedTitle = String(thread.title ?? '').toLowerCase();
	const normalizedMainPost = String(thread.mainPost?.content ?? '').toLowerCase();

	return (
		normalizedTitle.includes(' at ') ||
		normalizedMainPost.startsWith('discussion thread for ')
	);
}

function isMeaningfulDiscussionThread(thread) {
	const postCount = thread?._count?.posts ?? 0;

	if (postCount > 1) {
		return true;
	}

	return !isGeneratedMatchThread(thread);
}

function buildThreadActivitySummary(thread) {
	const postCount = thread._count?.posts ?? 0;
	const clippedTitle = thread.title?.slice(0, 120) ?? 'Untitled';
	const clippedMainPost = thread.mainPost?.content?.slice(0, 180) ?? '';

	if (clippedMainPost) {
		return `"${clippedTitle}" (${postCount} posts). Focus: ${clippedMainPost}`;
	}

	return `"${clippedTitle}" (${postCount} posts)`;
}

function buildResultLine(match) {
	const homeName = match.homeTeam?.name ?? 'Unknown';
	const awayName = match.awayTeam?.name ?? 'Unknown';

	if (
		typeof match.homeScore === 'number' &&
		typeof match.awayScore === 'number'
	) {
		const winner =
			match.homeScore > match.awayScore ? homeName : awayName;
		const loser = winner === homeName ? awayName : homeName;
		const winnerScore = winner === homeName ? match.homeScore : match.awayScore;
		const loserScore = winner === homeName ? match.awayScore : match.homeScore;

		if (match.homeScore !== match.awayScore) {
			return `${winner} beat ${loser} ${winnerScore}-${loserScore}`;
		}
	}

	return `${awayName} ${match.awayScore} - ${match.homeScore} ${homeName}`;
}

function buildDigestLead({ isoDate, topThreads, matches }) {
	if (topThreads.length > 0 && matches.length > 0) {
		return `Daily digest for ${isoDate}: fan conversation and final scores from around the league.`;
	}

	if (topThreads.length > 0) {
		return `Daily digest for ${isoDate}: the biggest fan discussions from around SportsDeck.`;
	}

	if (matches.length > 0) {
		return `Daily digest for ${isoDate}: final NBA results and a fresh standings snapshot.`;
	}

	return `Daily digest for ${isoDate}: a quick snapshot of league activity and standings.`;
}

function buildTakeaways({ topThreads, matches, standings }) {
	const takeaways = [];

	if (topThreads.length > 0) {
		const leadThread = topThreads[0];
		takeaways.push(
			`Fan focus centered on "${leadThread.title}" with ${leadThread._count?.posts ?? 0} posts driving the conversation.`,
		);
	}

	if (matches.length > 0) {
		takeaways.push(`${buildResultLine(matches[0])} stood out as the top finished result in the digest.`);
	}

	if (standings.length > 0) {
		const leader = standings[0];
		takeaways.push(
			`${leader.name} set the pace in the standings snapshot at ${leader.wins}-${leader.losses}.`,
		);
	}

	const fallbackTakeaways = [
		'Community chatter, final scores, and standings movement are collected into one fast read.',
		'The digest highlights the pieces of league activity most worth opening next.',
		'Use it as the quickest way to jump from the overview into live discussion.',
	];

	return [...takeaways, ...fallbackTakeaways].slice(0, 3);
}

function buildStandingsImpact(standings) {
	return standings.slice(0, 3).map((team, index) => {
		const prefix =
			index === 0
				? 'Setting the pace'
				: index === 1
					? 'Closest pressure'
					: 'Still in the picture';

		return {
			id: team.id,
			teamId: team.id,
			title: team.name,
			summary: `${prefix}: ${team.name} sits at ${team.wins}-${team.losses}.`,
			record: `${team.wins}-${team.losses}`,
		};
	});
}

function buildDiscussionCards(topThreads) {
	return topThreads.slice(0, 3).map((thread) => ({
		id: thread.id,
		title: thread.title ?? 'Untitled thread',
		excerpt:
			thread.mainPost?.content?.slice(0, 180) ||
			'Open the thread to catch up on the latest fan conversation.',
		postCount: thread._count?.posts ?? 0,
		href: `/forums/${thread.id}`,
	}));
}

function buildMatchCards(matches) {
	return matches.slice(0, 3).map((match) => ({
		id: match.id,
		title: `${match.awayTeam?.name ?? 'Away'} at ${match.homeTeam?.name ?? 'Home'}`,
		summary: buildResultLine(match),
		href: `/matches/${match.id}`,
	}));
}

// This function takes the raw data fetched from the database for threads, matches, and standings, and formats it into a structured text input that can be fed into the Huggingface AI summarization model. 
// It organizes the data into sections with clear headings and formats each item in a human-readable way.
// This helps provide the AI model with a clear and concise representation of the day's sports-related discussions, match results, and standings to generate a meaningful summary.
function buildDigestInput({ isoDate, topThreads, matches, standings }) {
	const threadLines =
		topThreads.length > 0
			? topThreads.map((thread, idx) => `${idx + 1}. ${buildThreadActivitySummary(thread)}`)
			: ['No meaningful fan discussions were recorded for this date.'];

	const matchLines =
		matches.length > 0
			? matches.map((match, idx) => `${idx + 1}. ${buildResultLine(match)}`)
			: ['No completed match results were recorded for this date.'];

	const standingLines =
		standings.length > 0
			? standings.map(
					(team, idx) =>
						`${idx + 1}. ${team.name} (${team.wins}-${team.losses})`,
				)
			: ['No standings data available.'];

	return [
		`Create a concise NBA daily digest for ${isoDate}.`,
		'Prioritize real fan discussion, completed results, and the standings picture.',
		'Keep the summary factual and readable.',
		'',
		`Top Discussions (${topThreads.length})`,
		...threadLines,
		'',
		`Recorded Matches (${matches.length})`,
		...matchLines,
		'',
		'Standings Snapshot',
		...standingLines,
	].join('\n');
}

// This function checks if the generated summary text from the AI model is likely to be low quality by looking for certain phrases that are commonly echoed from the input prompt rather than being a true summary.
// I had a lot of cases where the model would just repeat parts of the prompt back in the output, which indicated it wasn't really generating a meaningful summary. 
// This function helps identify those cases so we can choose to fall back to a simpler digest format instead of showing a low-quality AI summary.
// It includes part of the prompt text as markers to detect if the model is just echoing the prompt back instead of generating a real summary. 
// If any of those markers are present in the output, we consider it low quality.
function isLowQualitySummary(text) {
	if (!text) {
		return true;
	}

	const normalized = text.toLowerCase();
	const promptEchoMarkers = [
		'cover these sections',
		'keep it factual',
		'create a concise daily sports forum digest',
		'top discussions and key fan sentiment',
		'recorded match results and notable outcomes',
	];

	return promptEchoMarkers.some((marker) => normalized.includes(marker));
}

// This function builds a fallback digest text using a simple template that includes the key facts about the day's discussions, matches, and standings without relying on the AI model. 
// This is used in cases where the AI-generated summary is deemed low quality or if there are issues with the AI service. 
// It ensures that we can still provide users with a useful daily digest even when the AI isn't able to generate a good summary.
function buildFallbackDigest({ isoDate, topThreads, matches, standings }) {
	const leadText = buildDigestLead({ isoDate, topThreads, matches });
	const discussionText =
		topThreads.length > 0
			? `Top discussions included ${topThreads
					.slice(0, 3)
					.map((t) => `"${t.title}"`)
					.join(', ')}.`
			: 'No major discussion threads were recorded.';

	const matchText =
		matches.length > 0
			? `Recorded results: ${matches
					.slice(0, 3)
					.map((m) => buildResultLine(m))
					.join('; ')}.`
			: 'No completed matches were recorded.';

	const standingsText =
		standings.length > 0
			? `Standings snapshot: ${standings
					.slice(0, 5)
					.map((t) => `${t.name} (${t.wins}-${t.losses})`)
					.join(', ')}.`
			: 'No standings snapshot was available.';

	return `${leadText} ${discussionText} ${matchText} ${standingsText}`;
}

// This function normalizeText is a utility function that takes a string input and normalizes it by converting it to lowercase, replacing multiple whitespace characters with a single space, and trimming leading and trailing whitespace.
function normalizeText(value) {
	return String(value ?? '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

// This function isSafeDraftFromFacts checks if the AI-generated draft summary includes mentions of all the key teams that were involved in the matches and standings for that day.
// To make sure the model gives a good response back.
function isSafeDraftFromFacts(draft, matches, standings) {
	if (!draft) {
		return false;
	}

	const normalizedDraft = normalizeText(draft);

	// Require all surfaced teams in matches/standings to appear in the AI text.
	const requiredTeams = new Set();
	for (const match of matches) {
		requiredTeams.add(match.homeTeam?.name);
		requiredTeams.add(match.awayTeam?.name);
	}
	for (const team of standings) {
		requiredTeams.add(team.name);
	}

	for (const teamName of requiredTeams) {
		if (!teamName) {
			continue;
		}
		if (!normalizedDraft.includes(normalizeText(teamName))) {
			return false;
		}
	}

	return true;
}

// This function wraps a promise with a timeout. If the promise does not resolve within the specified timeout duration, it rejects with an InferenceTimeoutError. 
// This is used to ensure that we don't wait indefinitely for the AI summarization response and can fall back to a simpler digest if the AI service is taking too long to respond.
// This was added as some of the test cases at first were taking very long and this function helped debug that case.
function withTimeout(promise, timeoutMs) {
	let timeoutId;
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(
			() =>
				reject(
					new InferenceTimeoutError('Inference request timed out'),
				),
			timeoutMs,
		);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	});
}

function getCachedDigest(cacheKey) {
	const cached = digestCache.get(cacheKey);
	if (!cached) {
		return null;
	}

	if (Date.now() - cached.createdAt > DIGEST_CACHE_TTL_MS) {
		digestCache.delete(cacheKey);
		return null;
	}

	return cached.payload;
}

async function buildDigestPayload({ isoDate, startDate, endDate }) {
	const rawThreads = await safeQuery(
		() =>
			prisma.thread.findMany({
				where: {
					isVisible: true,
					OR: [
						{ createdAt: { gte: startDate, lt: endDate } },
						{ updatedAt: { gte: startDate, lt: endDate } },
					],
				},
				select: {
					id: true,
					title: true,
					matchId: true,
					createdAt: true,
					updatedAt: true,
					mainPost: { select: { content: true } },
					_count: { select: { posts: true } },
				},
				orderBy: [{ posts: { _count: 'desc' } }, { updatedAt: 'desc' }],
				take: 20,
			}),
		[],
	);

	const topThreads = rawThreads
		.filter(isMeaningfulDiscussionThread)
		.sort((a, b) => {
			const postDelta = (b._count?.posts ?? 0) - (a._count?.posts ?? 0);
			if (postDelta !== 0) {
				return postDelta;
			}
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		})
		.slice(0, 5);

	const matches = await safeQuery(
		() =>
			prisma.match.findMany({
				where: {
					status: 'finished',
					homeScore: { not: null },
					awayScore: { not: null },
					OR: [
						{ endedAt: { gte: startDate, lt: endDate } },
						{
							endedAt: null,
							date: { gte: startDate, lt: endDate },
						},
					],
				},
				select: {
					id: true,
					homeScore: true,
					awayScore: true,
					homeTeam: { select: { name: true } },
					awayTeam: { select: { name: true } },
				},
				orderBy: [{ endedAt: 'desc' }, { date: 'desc' }],
				take: 8,
			}),
		[],
	);

	const standings = await safeQuery(
		() =>
			prisma.team.findMany({
				select: {
					id: true,
					name: true,
					wins: true,
					losses: true,
				},
				orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { name: 'asc' }],
				take: 10,
			}),
		[],
	);

	const takeaways = buildTakeaways({ topThreads, matches, standings });
	const discussionCards = buildDiscussionCards(topThreads);
	const matchCards = buildMatchCards(matches);
	const standingsImpact = buildStandingsImpact(standings);

	const digestInput = buildDigestInput({
		isoDate,
		topThreads,
		matches,
		standings,
	});

	const digestText = buildFallbackDigest({
		isoDate,
		topThreads,
		matches,
		standings,
	});

	let aiDraft = null;
	let usedFallback = true;
	try {
		if (!EXTERNAL_MOCK_ENABLED) {
			const summary = await withTimeout(
				client.summarization({
					model: 'facebook/bart-large-cnn',
					inputs: digestInput,
					provider: 'hf-inference',
					parameters: {
						max_length: 160,
						min_length: 60,
						do_sample: false,
					},
				}),
				HF_TIMEOUT_MS,
			);
			const candidate = summary?.summary_text;
			if (
				candidate &&
				!isLowQualitySummary(candidate) &&
				isSafeDraftFromFacts(candidate, matches, standings)
			) {
				aiDraft = candidate;
				usedFallback = false;
			}
		}
	} catch (error) {
		if (!(error instanceof InferenceTimeoutError)) {
			throw error;
		}
	}

	return {
		date: isoDate,
		message: 'Daily digest generated successfully',
		digest: digestText,
		aiDraft: aiDraft ? aiDraft : null,
		headline: buildDigestLead({ isoDate, topThreads, matches }),
		takeaways,
		discussionCards,
		matchCards,
		standingsImpact,
		sourceCounts: {
			discussions: topThreads.length,
			recordedMatches: matches.length,
			standingsTeams: standings.length,
		},
		usedFallback,
	};
}

// This is the main GET request handler for this endpoint. It processes every input and accordingly calls the helpers defined above. 
// It returns the matches that are requested based on the filters provided, and also includes metadata about what matchdays and stages are available in the returned data. 
// It also implements error handling and a fallback mechanism to serve cached data from the database if the external API call fails.
export async function GET(request) {
	return withRedisRouteCache(request, async () => {
	try {
		if (!process.env.HF_TOKEN && !EXTERNAL_MOCK_ENABLED) {
			return NextResponse.json(
				{ error: 'HF_TOKEN is not configured.' },
				{ status: 500 },
			);
		}

		const { searchParams } = new URL(request.url);
		const dateParam = searchParams.get('date');
		const startDate = parseDigestDate(dateParam);

		if (!startDate) {
			return NextResponse.json(
				{ error: 'Invalid date. Use YYYY-MM-DD.' },
				{ status: 400 },
			);
		}

		const endDate = new Date(startDate);
		endDate.setUTCDate(endDate.getUTCDate() + 1);
		const isoDate = startDate.toISOString().slice(0, 10);

		const cachedPayload = getCachedDigest(isoDate);
		if (cachedPayload) {
			return NextResponse.json(cachedPayload);
		}

		const inFlight = digestInFlight.get(isoDate);
		if (inFlight) {
			const sharedPayload = await inFlight;
			return NextResponse.json(sharedPayload);
		}

		const buildPromise = buildDigestPayload({
			isoDate,
			startDate,
			endDate,
		});
		digestInFlight.set(isoDate, buildPromise);

		try {
			const payload = await buildPromise;
			digestCache.set(isoDate, {
				createdAt: Date.now(),
				payload,
			});
			return NextResponse.json(payload);
		} finally {
			digestInFlight.delete(isoDate);
		}
	} catch (error) {
		console.error('Error generating daily digest:', error);
		return NextResponse.json(
			{ error: 'Failed to generate daily digest' },
			{ status: 500 },
		);
	}
	}, { namespace: 'daily-digest', ttlSeconds: 60 * 10 });
}
