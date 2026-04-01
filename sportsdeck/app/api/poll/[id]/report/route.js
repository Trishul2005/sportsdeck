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
const POLL_EDIT_HISTORY_VERDICT = '__poll_edit_history__';

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
		const auth = await getAuthUserFromCookie(req);
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

		const { reason } = await req.json();
		if (!reason) {
			return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
		}

		const pollId = parseInt((await params).id, 10);
		if (Number.isNaN(pollId)) {
			return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			include: {
				options: {
					select: { text: true },
					orderBy: { id: 'asc' },
				},
			},
		});
		if (!poll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}

		const existingReport = await prisma.report.findFirst({
			where: {
				pollId,
				reportedById: user.userId,
				aiVerdict: {
					not: POLL_EDIT_HISTORY_VERDICT,
				},
			},
		});
		if (existingReport) {
			return NextResponse.json({ error: 'You have already reported this poll' }, { status: 400 });
		}

		const moderationInput = [
			poll.question,
			...poll.options.map((option) => option.text),
		]
			.filter(Boolean)
			.join('\n');

		const toxicityResult = EXTERNAL_MOCK_ENABLED || TOXIC_BERT_DISABLED
			? [{ label: 'non-toxic', score: 0.1 }]
			: await client.textClassification({
					model: 'unitary/toxic-bert',
					inputs: moderationInput,
					provider: 'hf-inference',
				});
		const topModeration = getTopModerationResult(toxicityResult);

		const report = await prisma.report.create({
			data: {
				toxicity: topModeration.score,
				aiVerdict: topModeration.label,
				reportedById: user.userId,
				pollId,
				threadId: poll.threadId,
				reason,
			},
		});

		await invalidateRouteCache();
		return NextResponse.json({ message: 'Poll reported successfully', report }, { status: 201 });
	} catch (error) {
		console.error(error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
