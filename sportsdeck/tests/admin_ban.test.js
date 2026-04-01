import axios from 'axios';
import {
	createTestUser,
	createTestUserInDB,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';
import { prisma } from '@/prisma/db';

describe('PATCH /api/admin/ban/[userId]', () => {
	it('should return 401 if Authorization header is missing', async () => {
		try {
			await axios.patch(`${BASE_URL}/admin/ban/1`, { result: 'BAN' });
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('should return 401 if token is invalid', async () => {
		try {
			await axios.patch(
				`${BASE_URL}/admin/ban/1`,
				{ result: 'BAN' },
				{ headers: { Authorization: 'Bearer invalidtoken' } },
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Invalid token');
		}
	});

	it('should return 403 if user is not admin', async () => {
		const { user, token } = await createTestUser();

		try {
			await axios.patch(
				`${BASE_URL}/admin/ban/${user.id}`,
				{ result: 'BAN' },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(403);
			expect(error.response.data.error).toBe('Forbidden');
		}
	});

	it('should ban user successfully as admin', async () => {
		// Create admin user
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		// Create regular user to ban
		const { user: regularUser } = await createTestUserInDB();

		const response = await axios.patch(
			`${BASE_URL}/admin/ban/${regularUser.id}`,
			{ result: 'BAN' },
			authHeaders(adminToken),
		);

		expect(response.status).toBe(200);
		expect(response.data.isBanned).toBe(true);
	});

	it('should return 404 if user to ban does not exist', async () => {
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		try {
			await axios.patch(
				`${BASE_URL}/admin/ban/999999`,
				{ result: 'BAN' },
				authHeaders(adminToken),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('User not found');
		}
	});

	it('should unban user successfully as admin', async () => {
		const { user: adminUser, token: adminToken } =
			await createTestUserInDB();
		await prisma.user.update({
			where: { id: adminUser.id },
			data: { role: 'ADMIN' },
		});

		const { user: bannedUser } = await createTestUserInDB();
		await prisma.user.update({
			where: { id: bannedUser.id },
			data: { isBanned: true },
		});

		const response = await axios.patch(
			`${BASE_URL}/admin/ban/${bannedUser.id}`,
			{ result: 'UNBAN' },
			authHeaders(adminToken),
		);

		expect(response.status).toBe(200);
		expect(response.data.isBanned).toBe(false);
	});
});
