import axios from 'axios';
import {
	createTestUser,
	createTestUserInDB,
	createTestThreadWithPost,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';
import { prisma } from '@/prisma/db';

describe('PATCH /api/admin/report/[id]', () => {
	it('returns 401 if no auth header', async () => {
		try {
			await axios.patch(`${BASE_URL}/admin/report/1`, {
				action: 'APPROVE',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('returns 401 if token invalid', async () => {
		try {
			await axios.patch(
				`${BASE_URL}/admin/report/1`,
				{ action: 'APPROVE' },
				{ headers: { Authorization: 'Bearer invalidtoken' } },
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('returns 403 if user is not admin', async () => {
		const { token } = await createTestUser();

		try {
			await axios.patch(
				`${BASE_URL}/admin/report/1`,
				{ action: 'APPROVE' },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(403);
			expect(error.response.data.error).toBe('Forbidden');
		}
	});

	it('successfully resolves a report', async () => {
		// Create admin user
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		// Create a report
		const { token: reporter, user: reporterUser } = await createTestUser();
		const { token: author } = await createTestUser();
		const { mainPost } = await createTestThreadWithPost(
			author,
			'Test thread',
			'Test content',
		);

		const reportRes = await axios.post(
			`${BASE_URL}/post/${mainPost.id}/report`,
			{ reason: 'BAN' },
			authHeaders(reporter),
		);

		const reportId = reportRes.data.report.id;

		// Resolve the report
		const response = await axios.patch(
			`${BASE_URL}/admin/report/${reportId}`,
			{ action: 'APPROVE' },
			authHeaders(adminToken),
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe('Report approve successfully');
	});

	it('returns 404 if report not found', async () => {
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		try {
			await axios.patch(
				`${BASE_URL}/admin/report/999999`,
				{ action: 'APPROVE' },
				authHeaders(adminToken),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Report not found');
		}
	});

	it('returns 400 if action is invalid', async () => {
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		const { token: reporter } = await createTestUser();
		const { token: author } = await createTestUser();
		const { mainPost } = await createTestThreadWithPost(
			author,
			'Test thread',
			'Test content',
		);

		const reportRes = await axios.post(
			`${BASE_URL}/post/${mainPost.id}/report`,
			{ reason: 'BAN' },
			authHeaders(reporter),
		);

		try {
			await axios.patch(
				`${BASE_URL}/admin/report/${reportRes.data.report.id}`,
				{ action: 'invalid_action' },
				authHeaders(adminToken),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
		}
	});
});
