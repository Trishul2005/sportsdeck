import { getRedisClient } from '@/app/utils/redis';

const USER_ME_CACHE_PREFIX = 'user:me';
const USER_ME_TTL_SECONDS = 60;

export function buildUserMeCacheKey(userId) {
	return `${USER_ME_CACHE_PREFIX}:${userId}`;
}

export async function getCachedUserMe(userId) {
	try {
		const redis = await getRedisClient();
		const cachedPayload = await redis.get(buildUserMeCacheKey(userId));
		return cachedPayload ? JSON.parse(cachedPayload) : null;
	} catch (redisError) {
		console.error('Redis user/me cache read failed:', redisError);
		return null;
	}
}

export async function setCachedUserMe(userId, payload) {
	try {
		const redis = await getRedisClient();
		await redis.set(buildUserMeCacheKey(userId), JSON.stringify(payload), {
			EX: USER_ME_TTL_SECONDS,
		});
	} catch (redisError) {
		console.error('Redis user/me cache write failed:', redisError);
	}
}

export async function invalidateUserMeCache(userId) {
	try {
		const redis = await getRedisClient();
		await redis.del(buildUserMeCacheKey(userId));
	} catch (redisError) {
		console.error('Redis user/me cache invalidation failed:', redisError);
	}
}
