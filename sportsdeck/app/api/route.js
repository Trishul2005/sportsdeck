import { withRedisRouteCache } from '@/app/utils/routeCache';

export async function GET(request) {
	return withRedisRouteCache(
		request,
		async () => new Response('Hello, World!'),
		{ namespace: 'api-root', ttlSeconds: 300 },
	);
}
