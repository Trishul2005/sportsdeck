import axios from 'axios';
import {
	createTestUser,
	createTestUserInDB,
	createTestThreadWithPost,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';
import { prisma } from '@/prisma/db';

describe('GET /api/admin/report/queue', () => {
	it('returns 401 if no auth header', async () => {
		try {
			await axios.get(`${BASE_URL}/admin/report/queue`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('returns 401 if token invalid', async () => {
		try {
			await axios.get(`${BASE_URL}/admin/report/queue`, {
				headers: { Authorization: 'Bearer invalidtoken' },
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('returns 403 if user is not admin', async () => {
		const { token } = await createTestUser();

		try {
			await axios.get(
				`${BASE_URL}/admin/report/queue`,
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(403);
			expect(error.response.data.error).toBe('Forbidden');
		}
	});

	it('returns unresolved reports for admin', async () => {
		// Create admin user
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		// Create a report
		const { token: reporter } = await createTestUser();
		const { token: author } = await createTestUser();
		const { mainPost } = await createTestThreadWithPost(
			author,
			'Test thread',
			'Test content',
		);

		await axios.post(
			`${BASE_URL}/post/${mainPost.id}/report`,
			{ reason: 'Inappropriate content' },
			authHeaders(reporter),
		);

		const response = await axios.get(
			`${BASE_URL}/admin/report/queue`,
			authHeaders(adminToken),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data)).toBe(true);
	});

	it('filters reports by status', async () => {
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		const response = await axios.get(
			`${BASE_URL}/admin/report/queue?status=unresolved`,
			authHeaders(adminToken),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data)).toBe(true);
	});
});
