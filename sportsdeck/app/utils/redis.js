import { createClient } from 'redis';

const globalForRedis = globalThis;

function attachErrorHandler(client) {
	if (client.__sportsdeckErrorHandlerAttached) {
		return;
	}

	client.on('error', (err) => {
		console.error('Redis Client Error', err);
	});
	client.__sportsdeckErrorHandlerAttached = true;
}

export async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not configured.');
  }

  if (!globalForRedis.__sportsdeckRedisClient) {
    globalForRedis.__sportsdeckRedisClient = createClient({
      url: process.env.REDIS_URL,
    });
    globalForRedis.__sportsdeckRedisConnectPromise = null;
  }

  const redisClient = globalForRedis.__sportsdeckRedisClient;
  attachErrorHandler(redisClient);

  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!globalForRedis.__sportsdeckRedisConnectPromise) {
    globalForRedis.__sportsdeckRedisConnectPromise = redisClient
      .connect()
      .catch((error) => {
        globalForRedis.__sportsdeckRedisConnectPromise = null;
        throw error;
      });
  }

  await globalForRedis.__sportsdeckRedisConnectPromise;
  return redisClient;
}
