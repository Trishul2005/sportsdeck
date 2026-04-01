const path = require('path');

const ROUTES = [
	['GET', /^\/api\/user\/me$/, '../../app/api/user/me/route.js'],
	['POST', /^\/api\/user\/signup$/, '../../app/api/user/signup/route.js'],
	['POST', /^\/api\/user\/login$/, '../../app/api/user/login/route.js'],
	['POST', /^\/api\/user\/refresh$/, '../../app/api/user/refresh/route.js'],
	['POST', /^\/api\/user\/logout$/, '../../app/api/user/logout/route.js'],
	['POST', /^\/api\/user\/appeal$/, '../../app/api/user/appeal/route.js'],
	['GET', /^\/api\/user\/followers$/, '../../app/api/user/followers/route.js'],
	['GET', /^\/api\/user\/following$/, '../../app/api/user/following/route.js'],
	['PATCH', /^\/api\/user\/profile$/, '../../app/api/user/profile/route.js'],
	['PATCH', /^\/api\/user\/theme$/, '../../app/api/user/theme/route.js'],
	['GET', /^\/api\/user\/([^/]+)\/profile$/, '../../app/api/user/[id]/profile/route.js', ['id']],
	['POST', /^\/api\/user\/([^/]+)\/follow$/, '../../app/api/user/[id]/follow/route.js', ['id']],
	['DELETE', /^\/api\/user\/([^/]+)\/follow$/, '../../app/api/user/[id]/follow/route.js', ['id']],
	['DELETE', /^\/api\/user\/followers\/([^/]+)$/, '../../app/api/user/followers/[followerId]/route.js', ['followerId']],
	['PATCH', /^\/api\/admin\/ban\/([^/]+)$/, '../../app/api/admin/ban/[userId]/route.js', ['userId']],
	['GET', /^\/api\/admin\/report\/queue$/, '../../app/api/admin/report/queue/route.js'],
	['PATCH', /^\/api\/admin\/report\/([^/]+)$/, '../../app/api/admin/report/[id]/route.js', ['id']],
	['GET', /^\/api\/admin\/appeal$/, '../../app/api/admin/appeal/route.js'],
	['PATCH', /^\/api\/admin\/appeal\/([^/]+)$/, '../../app/api/admin/appeal/[id]/route.js', ['id']],
	['GET', /^\/api\/post$/, '../../app/api/post/route.js'],
	['POST', /^\/api\/post$/, '../../app/api/post/route.js'],
	['PUT', /^\/api\/post\/([^/]+)$/, '../../app/api/post/[id]/route.js', ['id']],
	['DELETE', /^\/api\/post\/([^/]+)$/, '../../app/api/post/[id]/route.js', ['id']],
	['POST', /^\/api\/post\/([^/]+)\/report$/, '../../app/api/post/[id]/report/route.js', ['id']],
	['POST', /^\/api\/post\/([^/]+)\/translate$/, '../../app/api/post/[id]/translate/route.js', ['id']],
	['GET', /^\/api\/threads$/, '../../app/api/threads/route.js'],
	['POST', /^\/api\/threads$/, '../../app/api/threads/route.js'],
	['GET', /^\/api\/threads\/([^/]+)$/, '../../app/api/threads/[id]/route.js', ['id']],
	['PUT', /^\/api\/threads\/([^/]+)$/, '../../app/api/threads/[id]/route.js', ['id']],
	['DELETE', /^\/api\/threads\/([^/]+)$/, '../../app/api/threads/[id]/route.js', ['id']],
	['POST', /^\/api\/threads\/([^/]+)\/report$/, '../../app/api/threads/[id]/report/route.js', ['id']],
	['POST', /^\/api\/threads\/([^/]+)\/sentiment$/, '../../app/api/threads/[id]/sentiment/route.js', ['id']],
	['GET', /^\/api\/threads\/([^/]+)\/sentiment$/, '../../app/api/threads/[id]/sentiment/route.js', ['id']],
	['DELETE', /^\/api\/threads\/([^/]+)\/sentiment$/, '../../app/api/threads/[id]/sentiment/route.js', ['id']],
	['PUT', /^\/api\/threads\/([^/]+)\/sentiment$/, '../../app/api/threads/[id]/sentiment/route.js', ['id']],
	['POST', /^\/api\/poll$/, '../../app/api/poll/route.js'],
	['GET', /^\/api\/poll$/, '../../app/api/poll/route.js'],
	['PUT', /^\/api\/poll\/([^/]+)$/, '../../app/api/poll/[id]/route.js', ['id']],
	['DELETE', /^\/api\/poll\/([^/]+)$/, '../../app/api/poll/[id]/route.js', ['id']],
	['POST', /^\/api\/poll\/([^/]+)\/report$/, '../../app/api/poll/[id]/report/route.js', ['id']],
	['POST', /^\/api\/poll\/([^/]+)\/vote$/, '../../app/api/poll/[id]/vote/route.js', ['id']],
	['GET', /^\/api\/poll\/([^/]+)\/vote$/, '../../app/api/poll/[id]/vote/route.js', ['id']],
	['PATCH', /^\/api\/poll\/([^/]+)\/vote$/, '../../app/api/poll/[id]/vote/route.js', ['id']],
	['DELETE', /^\/api\/poll\/([^/]+)\/vote$/, '../../app/api/poll/[id]/vote/route.js', ['id']],
	['POST', /^\/api\/teams$/, '../../app/api/teams/route.js'],
	['GET', /^\/api\/teams$/, '../../app/api/teams/route.js'],
	['POST', /^\/api\/matches$/, '../../app/api/matches/route.js'],
	['GET', /^\/api\/matches$/, '../../app/api/matches/route.js'],
	['GET', /^\/api\/digest\/daily$/, '../../app/api/digest/daily/route.js'],
	['GET', /^\/api\/standings$/, '../../app/api/standings/route.js'],
];

function makeHeaders(inputHeaders = {}) {
	const normalized = new Map(
		Object.entries(inputHeaders).map(([key, value]) => [String(key).toLowerCase(), value]),
	);
	return {
		get(name) {
			return normalized.get(String(name).toLowerCase()) ?? null;
		},
	};
}

function buildRequest(method, url, data, config = {}) {
	const cookieMap = new Map();
	const cookieHeader = config.headers?.Cookie || config.headers?.cookie;
	if (cookieHeader) {
		for (const pair of String(cookieHeader).split(';')) {
			const [rawKey, rawValue] = pair.split('=');
			if (rawKey) cookieMap.set(rawKey.trim(), (rawValue || '').trim());
		}
	}

	return {
		method,
		url,
		headers: makeHeaders({
			'content-type': data !== undefined ? 'application/json' : undefined,
			...(config.headers || {}),
		}),
		cookies: {
			get(name) {
				const value = cookieMap.get(name);
				return value ? { value } : undefined;
			},
		},
		async json() {
			return data ?? {};
		},
		async formData() {
			return new Map();
		},
	};
}

function buildAxiosError(status, data, config) {
	const error = new Error(`Request failed with status code ${status}`);
	error.response = {
		status,
		data,
		config,
	};
	return error;
}

async function dispatch(method, url, data, config = {}) {
	const parsed = new URL(url, 'http://localhost');
	for (const [routeMethod, pattern, modulePath, paramNames = []] of ROUTES) {
		if (routeMethod !== method) continue;
		const match = parsed.pathname.match(pattern);
		if (!match) continue;

		const routeModule = require(path.resolve(__dirname, modulePath));
		const handler = routeModule[method];
		if (!handler) {
			throw new Error(`Missing ${method} handler for ${parsed.pathname}`);
		}

		const paramsObject = {};
		paramNames.forEach((key, index) => {
			paramsObject[key] = match[index + 1];
		});

		const request = buildRequest(method, parsed.toString(), data, config);
		const response = await handler(request, { params: Promise.resolve(paramsObject) });
		const body = await response.json();
		const axiosResponse = {
			status: response.status,
			data: body,
			config: { url, method, data, ...config },
		};
		if (response.status >= 400) {
			throw buildAxiosError(response.status, body, axiosResponse.config);
		}
		return axiosResponse;
	}

	throw new Error(`No mock route found for ${method} ${parsed.pathname}`);
}

module.exports = {
	dispatch,
};
