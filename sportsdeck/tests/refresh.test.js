import axios from 'axios';
import { BASE_URL, createTestUser } from './helpers/testUtils';

describe('POST /api/user/refresh', () => {
	it('rotates tokens when the refresh cookie is valid', async () => {
		const { token, refreshToken } = await createTestUser();

		const response = await axios.post(
			`${BASE_URL}/user/refresh`,
			{},
			{
				headers: {
					Cookie: `refreshToken=${refreshToken}; accessToken=${token}`,
				},
			},
		);

		expect(response.status).toBe(200);
		expect(response.data.accessToken).toBeDefined();
		expect(response.data.refreshToken).toBeDefined();
		expect(response.data.accessToken).not.toBe(token);
		expect(response.data.refreshToken).not.toBe(refreshToken);
	});

	it('rejects a revoked refresh token after logout', async () => {
		const { token, refreshToken } = await createTestUser();

		await axios.post(
			`${BASE_URL}/user/logout`,
			{},
			{
				headers: {
					Cookie: `refreshToken=${refreshToken}; accessToken=${token}`,
				},
			},
		);

		try {
			await axios.post(
				`${BASE_URL}/user/refresh`,
				{},
				{
					headers: {
						Cookie: `refreshToken=${refreshToken}`,
					},
				},
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Refresh token invalid.');
		}
	});
});
