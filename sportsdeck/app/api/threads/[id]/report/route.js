import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

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

export async function POST(req, { params }) {
	try {
		// authenticate user
		const auth = await getAuthUserFromCookie(req);
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

		// validate reason
		const body = await req.json();
		const { reason } = body;

		if (!reason)
			return NextResponse.json(
				{ error: 'Reason is required' },
				{ status: 400 },
			);

		// validate thread existence
		const threadId = parseInt((await params).id);
		if (Number.isNaN(threadId)) {
			return NextResponse.json(
				{ error: 'Invalid thread ID' },
				{ status: 400 },
			);
		}

		const thread = await prisma.thread.findUnique({
			where: { id: threadId },
		});
		if (!thread)
			return NextResponse.json(
				{ error: 'Thread not found' },
				{ status: 404 },
			);
		const mainPost = await prisma.post.findUnique({
			where: { id: thread.mainPostId },
		});
		if (!mainPost)
			return NextResponse.json(
				{ error: 'Main post of thread not found' },
				{ status: 404 },
			);

		// check duplicate report by same user
		const existingReport = await prisma.report.findFirst({
			where: {
				threadId,
				reportedById: user.userId,
			},
		});
		if (existingReport) {
			return NextResponse.json(
				{ error: 'You have already reported this thread' },
				{ status: 400 },
			);
		}

		// TODO: Get AI verdict for report and toxicity score, and include in report database entry
		const toxicityResult = EXTERNAL_MOCK_ENABLED || TOXIC_BERT_DISABLED
			? [{ label: 'non-toxic', score: 0.1 }]
			: await client.textClassification({
					model: 'unitary/toxic-bert',
					inputs: mainPost.content,
					provider: 'hf-inference',
				});
		const topModeration = getTopModerationResult(toxicityResult);
		const toxicityScore = topModeration.score;
		const toxicityLabel = topModeration.label;

		const report = await prisma.report.create({
			data: {
				toxicity: toxicityScore,
				aiVerdict: toxicityLabel,
				reportedById: user.userId,
				threadId: threadId, // or postId for post route
				reason,
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: 'Thread reported successfully', report },
			{ status: 201 },
		);
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
