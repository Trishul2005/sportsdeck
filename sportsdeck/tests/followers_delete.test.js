import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL } from './helpers/testUtils';

describe('DELETE /api/user/followers/[followerId]', () => {
	it('returns 401 if no auth header', async () => {
		try {
			await axios.delete(`${BASE_URL}/user/followers/2`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('returns 401 if token is invalid', async () => {
		try {
			await axios.delete(`${BASE_URL}/user/followers/2`, {
				headers: { Authorization: 'Bearer invalidtoken' },
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Invalid token');
		}
	});

	it('returns 400 if followerId is not a number', async () => {
		const { token } = await createTestUser();

		try {
			await axios.delete(
				`${BASE_URL}/user/followers/notanumber`,
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid follower ID');
		}
	});

	it('returns 404 if follow relationship does not exist', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2 } = await createTestUser();

		try {
			await axios.delete(
				`${BASE_URL}/user/followers/${user2.id}`,
				authHeaders(token1),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe(
				'Follower relationship not found',
			);
		}
	});

	it('successfully removes a follower', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2, token: token2 } = await createTestUser();

		// User2 follows user1
		await axios.post(
			`${BASE_URL}/user/${user1.id}/follow`,
			{ followerId: user2.id },
			authHeaders(token2),
		);

		// User1 removes user2 as a follower
		const response = await axios.delete(
			`${BASE_URL}/user/followers/${user2.id}`,
			authHeaders(token1),
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe('Follower removed successfully');
	});
});
