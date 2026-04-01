import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL } from './helpers/testUtils';
import { prisma } from '@/prisma/db';

describe('GET /api/user/followers', () => {
	it('returns 401 if no authorization header', async () => {
		try {
			await axios.get(`${BASE_URL}/user/followers`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('returns 401 if token is invalid', async () => {
		try {
			await axios.get(`${BASE_URL}/user/followers`, {
				headers: { Authorization: 'Bearer invalidtoken' },
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('returns empty array if user has no followers', async () => {
		const { token } = await createTestUser();

		const response = await axios.get(
			`${BASE_URL}/user/followers`,
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data.followers)).toBe(true);
		expect(response.data.followers.length).toBe(0);
	});

	it('returns list of followers', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2, token: token2 } = await createTestUser();

		// User2 follows user1
		await axios.post(
			`${BASE_URL}/user/${user1.id}/follow`,
			{ followerId: user2.id },
			authHeaders(token2),
		);

		// Get user1's followers
		const response = await axios.get(
			`${BASE_URL}/user/followers`,
			authHeaders(token1),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data.followers)).toBe(true);
		expect(response.data.followers.length).toBeGreaterThan(0);
		expect(response.data.followers[0].id).toBe(user2.id);
		expect(response.data.followers[0].username).toBeDefined();
	});
});
