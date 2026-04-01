import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache, withRedisRouteCache } from '@/app/utils/routeCache';

async function getAuthorizedUser(request) {
	const auth = await getAuthUserFromCookie(request);
	if (auth.error) {
		return { error: auth.error, status: auth.status, user: null };
	}

	const userRecord = await prisma.user.findUnique({
		where: { id: auth.payload.userId },
	});
	if (!userRecord) {
		return { error: 'User not found', status: 401, user: null };
	}
	if (userRecord.isBanned) {
		return { error: 'User is banned', status: 403, user: null };
	}

	return { error: null, status: 200, user: auth.payload };
}

export async function POST(request, { params }) {
	try {
		const authResult = await getAuthorizedUser(request);
		if (authResult.error) {
			return NextResponse.json({ error: authResult.error }, { status: authResult.status });
		}

		const user = authResult.user;
		const pollId = parseInt((await params).id, 10);
		const body = await request.json();
		const optionId = parseInt(body?.optionId, 10);

		if (Number.isNaN(pollId) || Number.isNaN(optionId)) {
			return NextResponse.json(
				{ error: 'Invalid poll or option ID.' },
				{ status: 400 },
			);
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: { id: true, isVisible: true, deadline: true, thread: { select: { id: true, isClosed: true } } },
		});
		if (!poll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}
		if (poll.isVisible === false) {
			return NextResponse.json({ error: 'Poll is hidden.' }, { status: 403 });
		}
		if (poll.thread?.isClosed) {
			return NextResponse.json({ error: 'Thread is closed.' }, { status: 403 });
		}
		if (poll.deadline && new Date(poll.deadline) <= new Date()) {
			return NextResponse.json({ error: 'Poll has ended.' }, { status: 403 });
		}

		const option = await prisma.pollOption.findFirst({
			where: { id: optionId, pollId },
			select: { id: true },
		});
		if (!option) {
			return NextResponse.json(
				{ error: 'Option does not belong to this poll.' },
				{ status: 400 },
			);
		}

		const existingVote = await prisma.pollVote.findFirst({
			where: { pollId, userId: user.userId },
			select: { id: true },
		});
		if (existingVote) {
			return NextResponse.json(
				{ error: 'User has already voted in this poll.' },
				{ status: 400 },
			);
		}

		const newVote = await prisma.pollVote.create({
			data: {
				pollId,
				optionId,
				userId: user.userId,
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: 'Vote cast successfully', vote: newVote },
			{ status: 201 },
		);
	} catch (error) {
		console.error('Error casting vote:', error);
		return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
	}
}

export async function GET(request, { params }) {
	const authResult = await getAuthorizedUser(request);
	const viewerKey = authResult.error ? 'anon' : `user:${authResult.user.userId}`;

	return withRedisRouteCache(request, async () => {
	try {
		if (authResult.error) {
			return NextResponse.json({ error: authResult.error }, { status: authResult.status });
		}

		const user = authResult.user;
		const pollId = parseInt((await params).id, 10);
		if (Number.isNaN(pollId)) {
			return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		const pollExists = await prisma.poll.findUnique({
			where: { id: pollId },
			select: { id: true },
		});
		if (!pollExists) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}

		const userVote = await prisma.pollVote.findFirst({
			where: { pollId, userId: user.userId },
		});

		return NextResponse.json({ userVote: userVote || null }, { status: 200 });
	} catch (error) {
		console.error('Error checking vote:', error);
		return NextResponse.json({ error: 'Failed to check vote' }, { status: 500 });
	}
	}, { namespace: 'poll-user-vote', ttlSeconds: 60, keyParts: [viewerKey] });
}

export async function PATCH(request, { params }) {
	try {
		const authResult = await getAuthorizedUser(request);
		if (authResult.error) {
			return NextResponse.json({ error: authResult.error }, { status: authResult.status });
		}

		const user = authResult.user;
		const pollId = parseInt((await params).id, 10);
		const body = await request.json();
		const optionId = parseInt(body?.optionId, 10);

		if (Number.isNaN(pollId) || Number.isNaN(optionId)) {
			return NextResponse.json({ error: 'Invalid poll or option ID.' }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: { id: true, isVisible: true, deadline: true, thread: { select: { id: true, isClosed: true } } },
		});
		if (!poll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}
		if (poll.isVisible === false) {
			return NextResponse.json({ error: 'Poll is hidden.' }, { status: 403 });
		}
		if (poll.thread?.isClosed) {
			return NextResponse.json({ error: 'Thread is closed.' }, { status: 403 });
		}
		if (poll.deadline && new Date(poll.deadline) <= new Date()) {
			return NextResponse.json({ error: 'Poll has ended.' }, { status: 403 });
		}

		const option = await prisma.pollOption.findFirst({
			where: { id: optionId, pollId },
			select: { id: true },
		});
		if (!option) {
			return NextResponse.json(
				{ error: 'Option does not belong to this poll.' },
				{ status: 400 },
			);
		}

		const existingVote = await prisma.pollVote.findFirst({
			where: { pollId, userId: user.userId },
			select: { id: true, optionId: true },
		});
		if (!existingVote) {
			return NextResponse.json({ error: 'No existing vote found.' }, { status: 404 });
		}

		if (existingVote.optionId === optionId) {
			return NextResponse.json(
				{ message: 'Vote updated successfully', vote: existingVote },
				{ status: 200 },
			);
		}

		const updatedVote = await prisma.pollVote.update({
			where: { id: existingVote.id },
			data: { optionId },
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: 'Vote updated successfully', vote: updatedVote },
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error changing vote:', error);
		return NextResponse.json({ error: 'Failed to change vote' }, { status: 500 });
	}
}

export async function DELETE(request, { params }) {
	try {
		const authResult = await getAuthorizedUser(request);
		if (authResult.error) {
			return NextResponse.json({ error: authResult.error }, { status: authResult.status });
		}

		const user = authResult.user;
		const pollId = parseInt((await params).id, 10);
		if (Number.isNaN(pollId)) {
			return NextResponse.json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		const poll = await prisma.poll.findUnique({
			where: { id: pollId },
			select: { id: true, isVisible: true, deadline: true, thread: { select: { id: true, isClosed: true } } },
		});
		if (!poll) {
			return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
		}
		if (poll.isVisible === false) {
			return NextResponse.json({ error: 'Poll is hidden.' }, { status: 403 });
		}
		if (poll.thread?.isClosed) {
			return NextResponse.json({ error: 'Thread is closed.' }, { status: 403 });
		}
		if (poll.deadline && new Date(poll.deadline) <= new Date()) {
			return NextResponse.json({ error: 'Poll has ended.' }, { status: 403 });
		}

		const existingVote = await prisma.pollVote.findFirst({
			where: { pollId, userId: user.userId },
			select: { id: true },
		});
		if (!existingVote) {
			return NextResponse.json({ error: 'No existing vote found.' }, { status: 404 });
		}

		await prisma.pollVote.delete({ where: { id: existingVote.id } });
		await invalidateRouteCache();
		return NextResponse.json(
			{ message: 'Vote removed successfully', success: true },
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error removing vote:', error);
		return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 });
	}
}
