import axios from 'axios';
import {
  createTestUser,
  createTestPost,
  createTestThread,
  createTestThreadWithPost,
  createTestTeamInDB,
  createTestMatchInDB,
  authHeaders,
  generateUniqueId,
  BASE_URL,
} from './helpers/testUtils';
import { prisma } from '@/prisma/db';
import { getAuthUserFromCookie } from '@/lib/auth';
import { GET as getThreads, POST as postThreads } from '../app/api/threads/route.js';
const { getAuthUserFromCookie: actualGetAuthUserFromCookie } = jest.requireActual('@/lib/auth');

const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock('@/lib/auth', () => ({
  getAuthUserFromCookie: jest.fn(),
}));

function buildMockRequest({
  method = 'GET',
  url = 'http://localhost/api/threads',
  headers = {},
  body,
} = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  );

  return {
    method,
    url,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name).toLowerCase()) ?? null;
      },
    },
    cookies: {
      get() {
        return undefined;
      },
    },
    async json() {
      return body ?? {};
    },
  };
}

beforeEach(() => {
  mockRedisClient.get.mockReset();
  mockRedisClient.get.mockResolvedValue(null);
  mockRedisClient.set.mockReset();
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.keys.mockReset();
  mockRedisClient.keys.mockResolvedValue([]);
  mockRedisClient.del.mockReset();
  mockRedisClient.del.mockResolvedValue(1);
  getAuthUserFromCookie.mockReset();
  getAuthUserFromCookie.mockImplementation(actualGetAuthUserFromCookie);
});

describe('POST /api/threads', () => {
  it('should return 401 if no Authorization header', async () => {
    try {
      await axios.post(`${BASE_URL}/threads`, {
        title: 'Test',
        mainPostId: 1,
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.error).toBe('Unauthorized');
    }
  });

  it('should return 401 if token is invalid', async () => {
    try {
      await axios.post(
        `${BASE_URL}/threads`,
        { title: 'Test', mainPostId: 1 },
        { headers: { Authorization: 'Bearer invalidtoken' } }
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.error).toBe('Invalid token');
    }
  });

  it('should return 400 if title or mainPostId missing', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(`${BASE_URL}/threads`, { title: 'Test' }, authHeaders(token));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe(
        'Title is required and provide exactly one mode: mainPostId (discussion) or poll (poll thread).',
      );
    }
  });

  it('should return 404 if post not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(
        `${BASE_URL}/threads`,
        { title: 'Test', mainPostId: 999999 },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe('Post not found.');
    }
  });

  it('should return 403 if trying to use another user\'s post', async () => {
    const { token: userToken1 } = await createTestUser();
    const { token: userToken2 } = await createTestUser();
    
    const post = await createTestPost(userToken1, 'Test post');

    try {
      await axios.post(
        `${BASE_URL}/threads`,
        { title: 'Test', mainPostId: post.id },
        authHeaders(userToken2)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
      expect(error.response.data.error).toBe('You can only create threads with your own posts.');
    }
  });

  it('should create thread successfully', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Main post content');

    const response = await axios.post(
      `${BASE_URL}/threads`,
      {
        title: `Test thread ${generateUniqueId()}`,
        mainPostId: post.id,
      },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBeDefined();
    expect(response.data.title).toBeDefined();
    expect(response.data.mainPostId).toBe(post.id);
    expect(response.data.mainPost).toBeDefined();
  });

  it('should create thread with tags', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Main post content');

    const response = await axios.post(
      `${BASE_URL}/threads`,
      {
        title: `Test thread ${generateUniqueId()}`,
        mainPostId: post.id,
        tags: ['sports', 'basketball'],
      },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.tags).toBeDefined();
    expect(response.data.tags.length).toBeGreaterThan(0);
  });

  it('should return 400 if post already used as main post', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Main post content');
    
    // Create first thread
    await createTestThread(token, 'First thread', post.id);

    // Try to create second thread with same post
    try {
      await axios.post(
        `${BASE_URL}/threads`,
        {
          title: 'Second thread',
          mainPostId: post.id,
        },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('This post is already used as a main post for another thread.');
    }
  });
});

describe('GET /api/threads', () => {
  it('should retrieve threads', async () => {
    const response = await axios.get(`${BASE_URL}/threads`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should retrieve threads with title filter', async () => {
    const { token } = await createTestUser();
    const uniqueTitle = `UniqueTitle${generateUniqueId()}`;
    await createTestThreadWithPost(token, uniqueTitle, 'Test content');

    const response = await axios.get(`${BASE_URL}/threads?title=${uniqueTitle}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.some(t => t.title.includes(uniqueTitle))).toBe(true);
  });

  it('should return 400 if page or pageSize is less than 1', async () => {
    try {
      await axios.get(`${BASE_URL}/threads?page=0`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('Page and pageSize must be positive integers.');
    }
  });

  it('should handle pagination', async () => {
    const response = await axios.get(`${BASE_URL}/threads?page=1&pageSize=5`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeLessThanOrEqual(5);
  });

  it('should filter threads by tags', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Test content');
    const uniqueTag = `tag${generateUniqueId()}`;
    
    await axios.post(
      `${BASE_URL}/threads`,
      {
        title: 'Tagged thread',
        mainPostId: post.id,
        tags: [uniqueTag],
      },
      authHeaders(token)
    );

    const response = await axios.get(`${BASE_URL}/threads?tags=${uniqueTag}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.some((t) => t.title === 'Tagged thread')).toBe(true);
  });

  it('should hide match threads that are outside open window', async () => {
    const { token, user } = await createTestUser();
    const homeTeam = await createTestTeamInDB(`Home ${generateUniqueId()}`);
    const awayTeam = await createTestTeamInDB(`Away ${generateUniqueId()}`);
    const match = await createTestMatchInDB(homeTeam.id, awayTeam.id, new Date(Date.now() - 21 * 24 * 60 * 60 * 1000));

    const mainPost = await prisma.post.create({
      data: {
        content: `Match thread post ${generateUniqueId()}`,
        authorId: user.id,
      },
    });

    const closedMatchThread = await prisma.thread.create({
      data: {
        title: `Closed match thread ${generateUniqueId()}`,
        mainPostId: mainPost.id,
        createdById: user.id,
        matchId: match.id,
        opensAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        closesAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        isVisible: true,
      },
    });

    await prisma.post.update({
      where: { id: mainPost.id },
      data: { threadId: closedMatchThread.id },
    });

    await createTestThreadWithPost(token, `Normal thread ${generateUniqueId()}`, 'Normal content');

    const response = await axios.get(`${BASE_URL}/threads`);

    expect(response.status).toBe(200);
    expect(response.data.some((t) => t.id === closedMatchThread.id)).toBe(false);
  });
});

describe('threads cache behavior (isolated)', () => {
  it('serves cached GET responses from redis without touching prisma', async () => {
    const cachedThreads = [
      {
        id: 987,
        title: 'Cached thread',
        teamId: null,
        matchId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        mainPost: { id: 654, content: 'Cached content' },
        team: null,
        match: null,
      },
    ];
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedThreads));

    const response = await getThreads(
      buildMockRequest({ url: 'http://localhost/api/threads?title=cached' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cachedThreads);
    expect(prisma.thread.findMany).not.toHaveBeenCalled();
    expect(prisma.thread.count).not.toHaveBeenCalled();
  });

  it('invalidates thread cache after a successful POST without using test db setup', async () => {
    getAuthUserFromCookie.mockResolvedValue({
      payload: { userId: 42, username: 'tester', role: 'USER' },
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 42,
      username: 'tester',
      isBanned: false,
    });
    prisma.post.findUnique.mockResolvedValueOnce({
      id: 99,
      authorId: 42,
    });
    prisma.thread.findFirst.mockResolvedValueOnce(null);
    mockRedisClient.keys.mockResolvedValueOnce(['threads:all', 'threads:title:test']);

    const tx = {
      post: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 99, threadId: 123 }),
      },
      thread: {
        create: jest.fn().mockResolvedValue({ id: 123 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 123,
          title: 'Thread title',
          mainPostId: 99,
          mainPost: { id: 99, content: 'Main post content' },
          tags: [],
          polls: [],
        }),
      },
      poll: {
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementationOnce(async (callback) => callback(tx));

    const response = await postThreads(
      buildMockRequest({
        method: 'POST',
        body: {
          title: 'Thread title',
          mainPostId: 99,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 123,
      title: 'Thread title',
      mainPostId: 99,
    });
    expect(mockRedisClient.keys).toHaveBeenCalledWith('threads:*');
    expect(mockRedisClient.del).toHaveBeenCalledWith([
      'threads:all',
      'threads:title:test',
    ]);
  });
});
