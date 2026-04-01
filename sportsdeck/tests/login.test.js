import axios from 'axios';
import {
	generateUniqueId,
	createTestUser,
	BASE_URL,
} from './helpers/testUtils';

describe('POST /api/user/login', () => {
	it('logs in successfully with correct credentials', async () => {
		// Create a test user first
		const { credentials } = await createTestUser();

		// Now try to login
		const response = await axios.post(`${BASE_URL}/user/login`, {
			username: credentials.username,
			password: credentials.password,
		});

		expect(response.status).toBe(200);
		expect(response.data.accessToken).toBeDefined();
		expect(response.data.refreshToken).toBeDefined();
	});

	it('logs in successfully with email', async () => {
		// Create a test user first
		const { credentials } = await createTestUser();

		// Now try to login with email
		const response = await axios.post(`${BASE_URL}/user/login`, {
			email: credentials.email,
			password: credentials.password,
		});

		expect(response.status).toBe(200);
		expect(response.data.accessToken).toBeDefined();
		expect(response.data.refreshToken).toBeDefined();
	});

	it('fails if user does not exist', async () => {
		try {
			await axios.post(`${BASE_URL}/user/login`, {
				username: `nonexistent${generateUniqueId()}`,
				password: 'Password123',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe(
				'Invalid username or email and password.',
			);
		}
	});

	it('fails with incorrect password', async () => {
		// Create a test user first
		const { credentials } = await createTestUser();

		try {
			await axios.post(`${BASE_URL}/user/login`, {
				username: credentials.username,
				password: 'WrongPassword123',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
			expect(error.response.data.error).toBe(
				'Invalid username or email and password.',
			);
		}
	});

	it('fails with missing credentials', async () => {
		try {
			await axios.post(`${BASE_URL}/user/login`, {
				username: 'testuser',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Username or email, and password are required.',
			);
		}
	});
});
