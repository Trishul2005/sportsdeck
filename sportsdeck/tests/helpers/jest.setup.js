const axios = require('axios');
const { prisma, resetMockDb } = require('./mockPrisma');
const { dispatch } = require('./mockHttp');

process.env.ACCESS_TOKEN_SECRET =
	process.env.ACCESS_TOKEN_SECRET || 'sportsdeck-access-token-secret';
process.env.REFRESH_TOKEN_SECRET =
	process.env.REFRESH_TOKEN_SECRET || 'sportsdeck-refresh-token-secret';
process.env.AUTH_SECRET =
	process.env.AUTH_SECRET || 'sportsdeck-auth-secret';
process.env.SPORTSDECK_TEST_MODE = 'true';
process.env.MOCK_EXTERNAL_APIS = 'true';

jest.mock('@/prisma/db', () => {
	const { prisma: mockPrisma } = require('./mockPrisma');
	return { prisma: mockPrisma };
});

jest.mock('redis', () => {
	const mockClient = {
		connect: jest.fn().mockResolvedValue(undefined),
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue('OK'),
		keys: jest.fn().mockResolvedValue([]),
		del: jest.fn().mockResolvedValue(1),
		on: jest.fn(),
		quit: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn(),
	};

	return {
		createClient: jest.fn(() => mockClient),
	};
});

jest.mock('@huggingface/inference', () => ({
	InferenceClient: jest.fn().mockImplementation(() => ({
		translation: jest.fn(async ({ inputs }) => ({
			translation_text: `[MOCK] ${inputs}`,
		})),
	})),
}));

beforeEach(() => {
	resetMockDb();
});

axios.get = jest.fn((url, config) => dispatch('GET', url, undefined, config));
axios.post = jest.fn((url, data, config) => dispatch('POST', url, data, config));
axios.patch = jest.fn((url, data, config) => dispatch('PATCH', url, data, config));
axios.put = jest.fn((url, data, config) => dispatch('PUT', url, data, config));
axios.delete = jest.fn((url, config) => dispatch('DELETE', url, undefined, config));
axios.request = jest.fn((config) =>
	dispatch(
		String(config.method || 'GET').toUpperCase(),
		config.url,
		config.data,
		config,
	),
);
axios.defaults.adapter = undefined;

global.fetch = jest.fn(async (url) => {
	throw new Error(`Unexpected fetch in mock test harness: ${url}`);
});

global.prisma = prisma;
