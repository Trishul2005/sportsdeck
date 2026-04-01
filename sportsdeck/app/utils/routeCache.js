import { NextResponse } from 'next/server';
import { getRedisClient } from '@/app/utils/redis';

const ROUTE_CACHE_PREFIX = 'route-cache';
const DEFAULT_ROUTE_TTL_SECONDS = 60;

function serializeKeyPart(part) {
	if (part === null || part === undefined || part === '') {
		return 'none';
	}

	if (typeof part === 'string') {
		return part;
	}

	return JSON.stringify(part);
}

export function buildRouteCacheKey(request, namespace = 'default', extraParts = []) {
	const suffix = extraParts.map(serializeKeyPart).join(':');
	return `${ROUTE_CACHE_PREFIX}:${namespace}:${request.url}${suffix ? `:${suffix}` : ''}`;
}

export async function withRedisRouteCache(
	request,
	handler,
	{
		ttlSeconds = DEFAULT_ROUTE_TTL_SECONDS,
		namespace = 'default',
		shouldCache,
		keyParts = [],
	} = {},
) {
	const cacheKey = buildRouteCacheKey(request, namespace, keyParts);

	try {
		const redis = await getRedisClient();
		const cachedPayload = await redis.get(cacheKey);
		if (cachedPayload) {
			const parsed = JSON.parse(cachedPayload);
			if (parsed.kind === 'json') {
				return NextResponse.json(parsed.body, { status: parsed.status });
			}

			return new NextResponse(parsed.body, {
				status: parsed.status,
				headers: parsed.contentType
					? { 'Content-Type': parsed.contentType }
					: undefined,
			});
		}
	} catch (error) {
		console.error(`Redis ${namespace} cache read failed:`, error);
	}

	const response = await handler();

	const contentType = String(response?.headers?.get?.('content-type') || '');
	const isJsonResponse =
		response &&
		typeof response?.clone === 'function' &&
		typeof response?.headers?.get === 'function' &&
		contentType.includes('application/json');
	const isTextResponse =
		response &&
		typeof response?.clone === 'function' &&
		typeof response?.headers?.get === 'function' &&
		contentType.includes('text/plain');
	const isSuccessful = response && response.status >= 200 && response.status < 300;

	if (
		(!isJsonResponse && !isTextResponse) ||
		!isSuccessful ||
		(typeof shouldCache === 'function' && !shouldCache(response))
	) {
		return response;
	}

	try {
		const body = isJsonResponse
			? await response.clone().json()
			: await response.clone().text();
		const redis = await getRedisClient();
		await redis.set(
			cacheKey,
			JSON.stringify({
				status: response.status,
				body,
				kind: isJsonResponse ? 'json' : 'text',
				contentType: isTextResponse ? contentType : null,
			}),
			{ EX: ttlSeconds },
		);
	} catch (error) {
		console.error(`Redis ${namespace} cache write failed:`, error);
	}

	return response;
}

export async function invalidateRouteCache(namespace = null) {
	const pattern = namespace
		? `${ROUTE_CACHE_PREFIX}:${namespace}:*`
		: `${ROUTE_CACHE_PREFIX}:*`;

	try {
		const redis = await getRedisClient();
		const keys = await redis.keys(pattern);
		if (keys.length > 0) {
			await redis.del(keys);
		}
	} catch (error) {
		console.error(`Redis route cache invalidation failed for pattern ${pattern}:`, error);
	}
}
