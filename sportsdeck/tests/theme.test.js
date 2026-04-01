import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL } from './helpers/testUtils';

describe('PATCH /api/user/theme', () => {
	it('returns 401 if no Authorization header', async () => {
		try {
			await axios.patch(`${BASE_URL}/user/theme`, { themeMode: 'DARK' });
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Unauthorized');
		}
	});

	it('returns 401 if token is invalid', async () => {
		try {
			await axios.patch(
				`${BASE_URL}/user/theme`,
				{ themeMode: 'DARK' },
				{ headers: { Authorization: 'Bearer invalidtoken' } },
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe('Invalid token');
		}
	});

	it('returns 400 for invalid theme mode', async () => {
		const { token } = await createTestUser();

		try {
			await axios.patch(
				`${BASE_URL}/user/theme`,
				{ themeMode: 'BLUE' },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid theme mode. Must be LIGHT or DARK');
		}
	});

	it('updates theme mode to DARK successfully', async () => {
		const { token } = await createTestUser();

		const response = await axios.patch(
			`${BASE_URL}/user/theme`,
			{ themeMode: 'DARK' },
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(response.data.themeMode).toBe('DARK');
	});

	it('updates theme mode to LIGHT successfully', async () => {
		const { token } = await createTestUser();

		const response = await axios.patch(
			`${BASE_URL}/user/theme`,
			{ themeMode: 'LIGHT' },
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(response.data.themeMode).toBe('LIGHT');
	});
});
