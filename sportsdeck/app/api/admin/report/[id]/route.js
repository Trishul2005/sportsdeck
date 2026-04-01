import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

function parseAttemptedPostOffenderId(reason) {
	if (typeof reason !== 'string') {
		return null;
	}
	const match = reason.match(/made by user\s+(\d+)/i);
	if (!match) {
		return null;
	}
	const parsed = parseInt(match[1], 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export async function PATCH(req, { params }) {
	try {
		// authenticate admin
		const auth = await getAuthUserFromCookie(req);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}
		
		const payload = auth.payload;
		
		
		const userRecord = await prisma.user.findUnique({
			where: { id: payload.userId },
		});
		
		if (!userRecord || userRecord.role !== 'ADMIN') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// get report
		const { id } = await params;
		if (!id) {
			return NextResponse.json(
				{ error: 'Report ID is required' },
				{ status: 400 },
			);
		}
		if (isNaN(parseInt(id))) {
			return NextResponse.json(
				{ error: 'Invalid Report ID' },
				{ status: 400 },
			);
		}

		const report = await prisma.report.findUnique({
			where: { id: parseInt(id) },
		});

		if (!report) {
			return NextResponse.json(
				{ error: 'Report not found' },
				{ status: 404 },
			);
		}

		if (report.isResolved) {
			return NextResponse.json(
				{ error: 'Report already reviewed' },
				{ status: 400 },
			);
		}

		const body = await req.json();
		const { action } = body;

		if (!action) {
			return NextResponse.json(
				{ error: 'Action is required' },
				{ status: 400 },
			);
		}

		if (typeof action !== 'string') {
			return NextResponse.json(
				{ error: 'Action must be a string' },
				{ status: 400 },
			);
		}

		if (!['APPROVE', 'DISMISS', 'BAN_USER'].includes(action)) {
			return NextResponse.json(
				{ error: 'Invalid action. Must be APPROVE, DISMISS, or BAN_USER' },
				{ status: 400 },
			);
		}

		const targetPost = report.postId
			? await prisma.post.findUnique({ where: { id: report.postId } })
			: null;
		const targetPoll = report.pollId
			? await prisma.poll.findUnique({ where: { id: report.pollId } })
			: null;
		const targetThread = report.threadId
			? await prisma.thread.findUnique({ where: { id: report.threadId } })
			: null;
		const attemptedPostOffenderId = parseAttemptedPostOffenderId(report.reason);
		const isAttemptedPostModerationReport =
			!report.postId && report.threadId && attemptedPostOffenderId !== null;

		const groupWhere = report.postId
			? { postId: report.postId, isResolved: false }
			: report.pollId
				? { pollId: report.pollId, isResolved: false }
			: isAttemptedPostModerationReport
				? { id: report.id, isResolved: false }
				: { threadId: report.threadId, isResolved: false };

		// if APPROVED hide content
		if (action === 'APPROVE' || action === 'BAN_USER') {
			if (report.threadId && !report.postId && !isAttemptedPostModerationReport) {
				await prisma.thread.update({
					where: { id: report.threadId },
					data: { isVisible: false, isClosed: true },
				});
			}

			if (report.postId) {
				await prisma.post.update({
					where: { id: report.postId },
					data: { isVisible: false },
				});

				const parentThread = await prisma.thread.findFirst({
					where: { mainPostId: report.postId },
					select: { id: true },
				});
				if (parentThread) {
					await prisma.thread.update({
						where: { id: parentThread.id },
						data: { isVisible: false, isClosed: true },
					});
				}
			}

			if (report.pollId) {
				await prisma.poll.update({
					where: { id: report.pollId },
					data: { isVisible: false },
				});
				if (targetPoll?.threadId) {
					await prisma.thread.update({
						where: { id: targetPoll.threadId },
						data: { isVisible: false, isClosed: true },
					});
				}
			}
		}

		if (action === 'BAN_USER') {
			const offenderUserId =
				targetPost?.authorId ||
				targetPoll?.createdById ||
				attemptedPostOffenderId ||
				targetThread?.createdById;
			if (!offenderUserId) {
				return NextResponse.json(
					{ error: 'Unable to identify offending user for this report.' },
					{ status: 400 },
				);
			}

			await prisma.user.update({
				where: { id: offenderUserId },
				data: { isBanned: true },
			});
		}

		// resolve all unresolved reports for the same content target
		await prisma.report.updateMany({
			where: groupWhere,
			data: {
				isResolved: true,
				resolvedAt: new Date(),
			},
		});
		await invalidateRouteCache();

		return NextResponse.json(
			{ message: `Report ${action.toLowerCase()} successfully` },
			{ status: 200 },
		);
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
