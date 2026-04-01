import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL } from './helpers/testUtils';

describe('GET /api/user/following', () => {
	it('returns 401 if no auth header', async () => {
		try {
			await axios.get(`${BASE_URL}/user/following`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('returns 401 if token is invalid', async () => {
		try {
			await axios.get(`${BASE_URL}/user/following`, {
				headers: { Authorization: 'Bearer invalidtoken' },
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Invalid token');
		}
	});

	it('returns empty array if user follows nobody', async () => {
		const { token } = await createTestUser();

		const response = await axios.get(
			`${BASE_URL}/user/following`,
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data.following)).toBe(true);
		expect(response.data.following.length).toBe(0);
	});

	it('returns list of users being followed', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2 } = await createTestUser();

		// User1 follows user2
		await axios.post(
			`${BASE_URL}/user/${user2.id}/follow`,
			{ followerId: user1.id },
			authHeaders(token1),
		);

		// Get user1's following list
		const response = await axios.get(
			`${BASE_URL}/user/following`,
			authHeaders(token1),
		);

		expect(response.status).toBe(200);
		expect(Array.isArray(response.data.following)).toBe(true);
		expect(response.data.following.length).toBeGreaterThan(0);
		expect(response.data.following[0].id).toBe(user2.id);
		expect(response.data.following[0].username).toBeDefined();
	});
});
