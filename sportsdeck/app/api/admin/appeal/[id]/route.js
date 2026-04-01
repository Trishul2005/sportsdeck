import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { invalidateRouteCache } from '@/app/utils/routeCache';

export async function PATCH(req, { params }) {
	try {
		const auth = await getAuthUserFromCookie(req);
		if (auth.error) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		const adminUser = await prisma.user.findUnique({
			where: { id: auth.payload.userId },
		});

		if (!adminUser || adminUser.role !== 'ADMIN') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { id } = await params;
		if (!id || Number.isNaN(Number.parseInt(id, 10))) {
			return NextResponse.json({ error: 'Invalid appeal ID' }, { status: 400 });
		}

		const body = await req.json();
		const action = typeof body?.action === 'string' ? body.action.toUpperCase() : '';

		if (!['APPROVE', 'REJECT'].includes(action)) {
			return NextResponse.json(
				{ error: 'Invalid action. Must be APPROVE or REJECT' },
				{ status: 400 },
			);
		}

		const appealId = Number.parseInt(id, 10);
		const appeal = await prisma.appeal.findUnique({
			where: { id: appealId },
		});

		if (!appeal) {
			return NextResponse.json({ error: 'Appeal not found' }, { status: 404 });
		}

		if (appeal.status !== 'PENDING') {
			return NextResponse.json(
				{ error: 'Appeal has already been reviewed' },
				{ status: 400 },
			);
		}

		const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
		const shouldUnban = action === 'APPROVE';

		const [updatedAppeal] = await prisma.$transaction([
			prisma.appeal.update({
				where: { id: appeal.id },
				data: {
					status: nextStatus,
					reviewedAt: new Date(),
				},
			}),
			prisma.user.update({
				where: { id: appeal.userId },
				data: { isBanned: !shouldUnban },
			}),
		]);
		await invalidateRouteCache();

		return NextResponse.json(updatedAppeal, { status: 200 });
	} catch (error) {
		console.error(error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		);
	}
}
