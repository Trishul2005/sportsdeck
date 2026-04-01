import axios from 'axios';
import { generateUniqueId, BASE_URL } from './helpers/testUtils';

describe('POST /api/user/signup', () => {
	it('registers a new user successfully', async () => {
		const uniqueId = generateUniqueId();
		const userData = {
			email: `test${uniqueId}@test.com`,
			username: `tester${uniqueId}`,
			password: 'password123',
		};

		const response = await axios.post(`${BASE_URL}/user/signup`, userData);

		expect(response.status).toBe(200);
		expect(response.data.user).toBeDefined();
		expect(response.data.user.email).toBe(userData.email);
		expect(response.data.user.username).toBe(userData.username);
		expect(response.data.user.id).toBeDefined();
		expect(response.data.user.password).toBeDefined(); // Hashed password
	});

	it('rejects missing fields', async () => {
		try {
			await axios.post(`${BASE_URL}/user/signup`, {
				email: 'fail@test.com',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Email, username, and password are required.',
			);
		}
	});

	it('rejects duplicate username', async () => {
		const uniqueId = generateUniqueId();
		const userData = {
			email: `first${uniqueId}@test.com`,
			username: `dupuser${uniqueId}`,
			password: 'pass123',
		};

		// Create first user
		await axios.post(`${BASE_URL}/user/signup`, userData);

		// Try to create duplicate
		try {
			await axios.post(`${BASE_URL}/user/signup`, {
				email: `second${uniqueId}@test.com`,
				username: userData.username,
				password: 'pass456',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Username already exists.');
		}
	});

	it('rejects duplicate email', async () => {
		const uniqueId = generateUniqueId();
		const userData = {
			email: `dupemail${uniqueId}@test.com`,
			username: `user1${uniqueId}`,
			password: 'pass123',
		};

		// Create first user
		await axios.post(`${BASE_URL}/user/signup`, userData);

		// Try to create duplicate with same email
		try {
			await axios.post(`${BASE_URL}/user/signup`, {
				email: userData.email,
				username: `user2${uniqueId}`,
				password: 'pass456',
			});
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Email already exists.');
		}
	});
});
