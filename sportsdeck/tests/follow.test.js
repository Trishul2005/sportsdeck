import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL } from './helpers/testUtils';

describe('POST /api/user/[id]/follow', () => {

	it('should follow a user successfully', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2 } = await createTestUser();

		const response = await axios.post(
			`${BASE_URL}/user/${user2.id}/follow`,
			{}, // body no longer needed
			authHeaders(token1),
		);

		expect(response.status).toBe(201);
		expect(response.data.message).toBe('Followed successfully');
		expect(response.data.follow.followerId).toBe(user1.id);
		expect(response.data.follow.followingId).toBe(user2.id);
	});

	it('should return 400 if trying to follow yourself', async () => {
		const { user, token } = await createTestUser();

		try {
			await axios.post(
				`${BASE_URL}/user/${user.id}/follow`,
				{},
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Cannot follow yourself');
		}
	});

	it('should return 409 if already following the user', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2 } = await createTestUser();

		// Follow once
		await axios.post(
			`${BASE_URL}/user/${user2.id}/follow`,
			{},
			authHeaders(token1),
		);

		// Try again
		try {
			await axios.post(
				`${BASE_URL}/user/${user2.id}/follow`,
				{},
				authHeaders(token1),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(409);
			expect(error.response.data.error).toBe(
				'Already following this user',
			);
		}
	});

	it('should return 404 if user to follow does not exist', async () => {
		const { token } = await createTestUser();

		try {
			await axios.post(
				`${BASE_URL}/user/999999/follow`,
				{},
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe(
				'User to follow not found',
			);
		}
	});
});


describe('DELETE /api/user/[id]/follow', () => {

	it('should unfollow a user successfully', async () => {
		const { user: user1, token: token1 } = await createTestUser();
		const { user: user2 } = await createTestUser();

		// Follow first
		await axios.post(
			`${BASE_URL}/user/${user2.id}/follow`,
			{},
			authHeaders(token1),
		);

		// Then unfollow
		const response = await axios.delete(
			`${BASE_URL}/user/${user2.id}/follow`,
			authHeaders(token1),
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe('Unfollowed successfully');
	});

	it('should return 404 if follow relationship does not exist', async () => {
		const { user: user2 } = await createTestUser();
		const { token } = await createTestUser();

		try {
			await axios.delete(
				`${BASE_URL}/user/${user2.id}/follow`,
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe(
				'Follow relationship not found',
			);
		}
	});

	it('should return 400 if trying to unfollow yourself', async () => {
		const { user, token } = await createTestUser();

		try {
			await axios.delete(
				`${BASE_URL}/user/${user.id}/follow`,
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Cannot unfollow yourself',
			);
		}
	});

});