import axios from 'axios';
import { createTestUser, authHeaders, BASE_URL, generateUniqueId } from './helpers/testUtils';
import { prisma } from '@/prisma/db';

const { createClient } = jest.requireMock('redis');

function getRedisMockClient() {
	return createClient();
}

describe('GET /api/user/me', () => {
	beforeEach(() => {
		const redis = getRedisMockClient();
		redis.get.mockReset();
		redis.get.mockResolvedValue(null);
		redis.set.mockReset();
		redis.set.mockResolvedValue('OK');
		redis.del.mockReset();
		redis.del.mockResolvedValue(1);
	});

	it('returns cached me payload from redis when available', async () => {
		const { token } = await createTestUser();
		const redis = getRedisMockClient();
		prisma.user.findUnique.mockClear();
		redis.get.mockResolvedValueOnce(
			JSON.stringify({
				id: 999,
				email: 'cached@test.com',
				username: 'cached-user',
				avatar: null,
				favoriteTeamId: null,
				role: 'USER',
				isBanned: false,
				themeMode: 'LIGHT',
				favoriteTeam: null,
			}),
		);

		const response = await axios.get(`${BASE_URL}/user/me`, authHeaders(token));

		expect(response.status).toBe(200);
		expect(response.data.username).toBe('cached-user');
		expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
		expect(redis.set).not.toHaveBeenCalled();
	});

	it('caches fresh me payloads in redis after reading from prisma', async () => {
		const { token, user } = await createTestUser();
		const redis = getRedisMockClient();

		const response = await axios.get(`${BASE_URL}/user/me`, authHeaders(token));

		expect(response.status).toBe(200);
		expect(response.data.id).toBe(user.id);
		expect(redis.set).toHaveBeenCalledTimes(1);
		const [cacheKey, cachePayload] = redis.set.mock.calls[0];
		expect(cacheKey).toBe(`user:me:${user.id}`);
		expect(JSON.parse(cachePayload)).toMatchObject({
			id: user.id,
			username: user.username,
		});
	});
});

describe('user/me cache invalidation', () => {
	beforeEach(() => {
		const redis = getRedisMockClient();
		redis.get.mockReset();
		redis.get.mockResolvedValue(null);
		redis.set.mockReset();
		redis.set.mockResolvedValue('OK');
		redis.del.mockReset();
		redis.del.mockResolvedValue(1);
	});

	it('invalidates user/me cache after profile updates', async () => {
		const { token, user } = await createTestUser();
		const redis = getRedisMockClient();

		const response = await axios.patch(
			`${BASE_URL}/user/profile`,
			{ username: `updated-${generateUniqueId()}` },
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(redis.del).toHaveBeenCalledWith(`user:me:${user.id}`);
	});

	it('invalidates user/me cache after theme updates', async () => {
		const { token, user } = await createTestUser();
		const redis = getRedisMockClient();

		const response = await axios.patch(
			`${BASE_URL}/user/theme`,
			{ themeMode: 'DARK' },
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(redis.del).toHaveBeenCalledWith(`user:me:${user.id}`);
	});
});
