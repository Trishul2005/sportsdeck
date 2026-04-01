import axios from 'axios';
import {
	createTestUser,
	createTestUserInDB,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';
import { prisma } from '@/prisma/db';

describe('Appeal endpoint', () => {
	it('should return 401 if not authenticated', async () => {
		try {
			await axios.post(`${BASE_URL}/user/appeal`, {
				reason: 'I should be unbanned',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('should return 400 if user is not banned', async () => {
		const { token } = await createTestUser();

		try {
			await axios.post(
				`${BASE_URL}/user/appeal`,
				{ reason: 'I should be unbanned' },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('You are not banned');
		}
	});

	it('should return 400 if reason is missing', async () => {
		const { user, token } = await createTestUserInDB();

		// Ban the user
		await prisma.user.update({
			where: { id: user.id },
			data: { isBanned: true },
		});

		try {
			await axios.post(`${BASE_URL}/user/appeal`, {}, authHeaders(token));
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Reason must be a string');
		}
	});

	it('should create appeal successfully for banned user', async () => {
		const { user, token } = await createTestUserInDB();

		// Ban the user
		await prisma.user.update({
			where: { id: user.id },
			data: { isBanned: true },
		});

		const response = await axios.post(
			`${BASE_URL}/user/appeal`,
			{ reason: 'I should be unbanned' },
			authHeaders(token),
		);

		expect(response.status).toBe(201);
		expect(response.data.id).toBeDefined();
		expect(response.data.userId).toBe(user.id);
		expect(response.data.reason).toBe('I should be unbanned');
		expect(response.data.status).toBe('PENDING');
	});
});
