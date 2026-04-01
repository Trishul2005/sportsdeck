import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';

// Notes:
// - Requires basic auth checks and data validation
// - Analyzes all posts in batches to avoid hitting input size limits (MAX_LEN = 512)
// - Returns sentiment as float values between -1 (negative) and 1 (positive)
// - Needs to handle cases where the thread is not associated with a match, or the match does not have teams, etc.
// - Uses sentiment analysis API: cardiffnlp/twitter-roberta-base-sentiment-latest

const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
	process.env.MOCK_EXTERNAL_APIS === 'true' ||
	process.env.NODE_ENV === 'test';
const HF_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const MAX_LEN = 512;
const BATCH_SIZE = 10;

function parseClassificationPayload(payload) {
	const first = Array.isArray(payload) ? payload[0] : payload;
	const result = Array.isArray(first) ? first[0] : first;
	if (!result || !result.label) {
		return null;
	}
	return {
		label: String(result.label).toLowerCase(),
		score: Number(result.score) || 0,
	};
}

async function classifyWithFallback(inputs) {
	if (EXTERNAL_MOCK_ENABLED) {
		return { label: 'neutral', score: 0.5 };
	}

	const token = process.env.HF_TOKEN;
	if (!token) {
		return { label: 'neutral', score: 0 };
	}

	try {
		const response = await fetch(HF_ROUTER_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ inputs }),
			cache: 'no-store',
		});

		if (response.ok) {
			const payload = await response.json();
			const parsed = parseClassificationPayload(payload);
			if (parsed) {
				return parsed;
			}
		}
	} catch (error) {
		console.warn('Router sentiment request failed:', error);
	}

	try {
		const result = await client.textClassification({
			model: HF_MODEL,
			inputs,
		});
		const parsed = parseClassificationPayload(result);
		if (parsed) {
			return parsed;
		}
	} catch (error) {
		console.warn('Legacy sentiment request failed:', error);
	}

	return { label: 'neutral', score: 0 };
}

// Helper function to batch process posts and average sentiment scores
async function analyzeBatchedSentiment(posts, prompt = null) {
	const batches = [];

	// Create batches of posts
	for (let i = 0; i < posts.length; i += BATCH_SIZE) {
		const batch = posts.slice(i, i + BATCH_SIZE);
		const batchText = batch.join('\n').substring(0, MAX_LEN);
		batches.push(prompt ? `${prompt}\n${batchText}` : batchText);
	}

	// Analyze each batch and collect results
	const allResults = [];
	for (const batchText of batches) {
		const result = await classifyWithFallback(batchText);
		allResults.push(result);
	}

	// Calculate weighted sentiment score: positive=1, negative=-1, neutral=0
	let totalScore = 0;
	allResults.forEach((result) => {
		const score =
			result.label === 'positive'
				? result.score
				: result.label === 'negative'
					? -result.score
					: 0;
		totalScore += score;
	});

	// Return average score between -1 and 1
	return totalScore / allResults.length;
}

// Made POST so that we create the sentiment record in the database and can link it to the thread,
// and also so that we can trigger the sentiment analysis when the thread is created or updated.
// We can also add a GET route to fetch the sentiment analysis results for a thread if needed.
export async function POST(request, { params }) {
	try {
		const { id } = await params;
		const threadId = parseInt(id);
		if (isNaN(threadId))
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		const thread = await prisma.thread.findUnique({
			where: { id: threadId },
			select: {
				id: true,
				posts: { select: { content: true } },
				matchId: true,
			},
		});
		if (!thread)
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		if (!thread.matchId)
			return NextResponse.json(
				{ error: 'Thread is not associated with a match' },
				{ status: 400 },
			);
		// We analyze all posts by batching them with BATCH_SIZE and then averaging the sentiment scores
		// Get all posts in the thread
		const posts = thread.posts.map((post) => post.content);
		if (posts.length === 0)
			return NextResponse.json(
				{ error: 'No posts found in thread' },
				{ status: 400 },
			);

		const overallSentimentResult = await analyzeBatchedSentiment(posts);
		// For team-specific sentiment, we can use a prompt to ask the model to analyze the sentiment towards each team based on the content of the thread.
		// Get the team names from the matchId
		const match = await prisma.match.findUnique({
			where: { id: thread.matchId },
			select: { homeTeamId: true, awayTeamId: true },
		});
		if (!match)
			return NextResponse.json(
				{ error: 'Match not found' },
				{ status: 404 },
			);
		const homeTeam = await prisma.team.findUnique({
			where: { id: match.homeTeamId },
			select: { name: true },
		});
		const awayTeam = await prisma.team.findUnique({
			where: { id: match.awayTeamId },
			select: { name: true },
		});
		if (!homeTeam || !awayTeam)
			return NextResponse.json(
				{ error: 'Teams not found' },
				{ status: 404 },
			);
		const homeTeamSentimentResult = await analyzeBatchedSentiment(
			posts,
			`Analyze the sentiment towards ${homeTeam.name} in the following text:`,
		);
		const awayTeamSentimentResult = await analyzeBatchedSentiment(
			posts,
			`Analyze the sentiment towards ${awayTeam.name} in the following text:`,
		);
		// Store the sentiment analysis result in the database, linked to the thread.
		// We make the assumption that a sentiment has never existed prior to this call.
		const sentimentRecord = await prisma.sentiment.create({
			data: {
				matchId: thread.matchId,
				overall: overallSentimentResult,
				homeTeam: homeTeamSentimentResult,
				awayTeam: awayTeamSentimentResult,
				numPosts: posts.length,
			},
			select: {
				id: true,
				matchId: true,
				overall: true,
				homeTeam: true,
				awayTeam: true,
				numPosts: true,
			},
		});
		await invalidateRouteCache();
		return NextResponse.json(sentimentRecord, { status: 200 });
	} catch (error) {
		console.error('Error performing sentiment analysis:', error);
		return NextResponse.json(
			{ error: 'Failed to perform sentiment analysis' },
			{ status: 500 },
		);
	}
}

export async function GET(request, { params }) {
	return withRedisRouteCache(request, async () => {
	try {
		const { id } = await params;
		const threadId = parseInt(id);
		if (isNaN(threadId))
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		const thread = await prisma.thread.findUnique({
			where: { id: threadId },
			select: { id: true, matchId: true },
		});
		if (!thread)
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		if (!thread.matchId)
			return NextResponse.json(
				{ error: 'Thread is not associated with a match' },
				{ status: 400 },
			);
		const sentimentRecord = await prisma.sentiment.findUnique({
			where: { matchId: thread.matchId },
		});
		if (!sentimentRecord)
			return NextResponse.json(
				{ error: 'Sentiment analysis not found for this thread' },
				{ status: 404 },
			);
		return NextResponse.json(sentimentRecord, { status: 200 });
	} catch (error) {
		console.error('Error fetching sentiment analysis:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch sentiment analysis' },
			{ status: 500 },
		);
	}
	}, { namespace: 'thread-sentiment', ttlSeconds: 60 });
}

export async function DELETE(request, { params }) {
	try {
		const { id } = await params;
		const threadId = parseInt(id);
		if (isNaN(threadId))
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		const thread = await prisma.thread.findUnique({
			where: { id: threadId },
			select: { id: true, matchId: true },
		});
		if (!thread)
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		if (!thread.matchId)
			return NextResponse.json(
				{ error: 'Thread is not associated with a match' },
				{ status: 400 },
			);
		await prisma.sentiment.deleteMany({
			where: { matchId: thread.matchId },
		});
		await invalidateRouteCache();
		return NextResponse.json(
			{ message: 'Sentiment analysis deleted successfully' },
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error deleting sentiment analysis:', error);
		return NextResponse.json(
			{ error: 'Failed to delete sentiment analysis' },
			{ status: 500 },
		);
	}
}

export async function PUT(request, { params }) {
	try {
		const { id } = await params;
		const threadId = parseInt(id);
		if (isNaN(threadId))
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		const thread = await prisma.thread.findUnique({
			where: { id: threadId },
			select: {
				id: true,
				posts: { select: { content: true, createdAt: true } },
				matchId: true,
			},
		});
		if (!thread)
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		if (!thread.matchId)
			return NextResponse.json(
				{ error: 'Thread is not associated with a match' },
				{ status: 400 },
			);
		// To limit spam, we check if the sentiment was updated in the last hour, and if so, we reject the update. This is to prevent abuse of the sentiment analysis update endpoint.
		const existingSentiment = await prisma.sentiment.findUnique({
			where: { matchId: thread.matchId },
		});
		// if (existingSentiment) {
		// 	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
		// 	if (existingSentiment.updatedAt > oneHourAgo) {
		// 		return NextResponse.json(
		// 			{
		// 				error: 'Sentiment analysis was updated less than an hour ago. Please try again later.',
		// 			},
		// 			{ status: 429 },
		// 		);
		// 	}
		// }
		// This endpoint is called if the sentiment object was already made, so we can simply extract the posts from the previous hour
		// and update the sentiment analysis results based on the new posts. This is to ensure that we are analyzing the most recent content in the thread and keeping the sentiment analysis up to date.
		const posts = thread.posts
			.filter((post) => post.createdAt > existingSentiment.updatedAt)
			.map((post) => post.content);
		if (posts.length === 0) {
			// We can simply return the original sentiment analysis result if there are no new posts to analyze, since the sentiment would not have changed.
			return NextResponse.json(existingSentiment, { status: 200 });
		}
		const overallSentimentResult = await analyzeBatchedSentiment(posts);
		const match = await prisma.match.findUnique({
			where: { id: thread.matchId },
			select: { homeTeamId: true, awayTeamId: true },
		});
		if (!match)
			return NextResponse.json(
				{ error: 'Match not found' },
				{ status: 404 },
			);
		const homeTeam = await prisma.team.findUnique({
			where: { id: match.homeTeamId },
			select: { name: true },
		});
		const awayTeam = await prisma.team.findUnique({
			where: { id: match.awayTeamId },
			select: { name: true },
		});
		if (!homeTeam || !awayTeam)
			return NextResponse.json(
				{ error: 'Teams not found' },
				{ status: 404 },
			);
		const homeTeamSentimentResult = await analyzeBatchedSentiment(
			posts,
			`Analyze the sentiment towards ${homeTeam.name} in the following text:`,
		);
		const awayTeamSentimentResult = await analyzeBatchedSentiment(
			posts,
			`Analyze the sentiment towards ${awayTeam.name} in the following text:`,
		);
		// Calculate weighted average using numPosts as weights
		const oldNumPosts = existingSentiment.numPosts;
		const newNumPosts = posts.length;
		const totalNumPosts = oldNumPosts + newNumPosts;

		const avgOverall =
			(existingSentiment.overall * oldNumPosts +
				overallSentimentResult * newNumPosts) /
			totalNumPosts;
		const avgHomeTeam =
			(existingSentiment.homeTeam * oldNumPosts +
				homeTeamSentimentResult * newNumPosts) /
			totalNumPosts;
		const avgAwayTeam =
			(existingSentiment.awayTeam * oldNumPosts +
				awayTeamSentimentResult * newNumPosts) /
			totalNumPosts;

		const updatedSentiment = await prisma.sentiment.update({
			where: { matchId: thread.matchId },
			data: {
				overall: avgOverall,
				homeTeam: avgHomeTeam,
				awayTeam: avgAwayTeam,
				numPosts: totalNumPosts,
			},
		});
		await invalidateRouteCache();
		return NextResponse.json(updatedSentiment, { status: 200 });
	} catch (error) {
		console.error('Error updating sentiment analysis:', error);
		return NextResponse.json(
			{ error: 'Failed to update sentiment analysis' },
			{ status: 500 },
		);
	}
}
