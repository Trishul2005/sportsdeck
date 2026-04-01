import axios from 'axios';
import {
  createTestUser,
  createTestThreadWithPost,
  authHeaders,
  BASE_URL,
} from './helpers/testUtils';

describe('POST /api/poll', () => {
  it('should return 401 if no auth header', async () => {
    try {
      await axios.post(`${BASE_URL}/poll`, {
        question: 'Favorite sport?',
        options: ['Football', 'Basketball'],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        threadId: 1,
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should return 401 if token invalid', async () => {
    try {
      await axios.post(
        `${BASE_URL}/poll`,
        {
          question: 'Favorite sport?',
          options: ['Football', 'Basketball'],
          deadline: new Date(Date.now() + 86400000).toISOString(),
          threadId: 1,
        },
        { headers: { Authorization: 'Bearer invalidtoken' } }
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should create a poll successfully', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Thread content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const response = await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Favorite sport?',
        options: ['Football', 'Basketball', 'Baseball'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBeDefined();
    expect(response.data.question).toBe('Favorite sport?');
    expect(response.data.options).toBeDefined();
    expect(response.data.options.length).toBe(3);
  });

  it('should return 400 if question is missing', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Thread content');

    try {
      await axios.post(
        `${BASE_URL}/poll`,
        {
          options: ['Option 1', 'Option 2'],
          deadline: new Date(Date.now() + 86400000).toISOString(),
          threadId: thread.id,
        },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
    }
  });

  it('should return 400 if deadline is in the past', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Thread content');

    try {
      await axios.post(
        `${BASE_URL}/poll`,
        {
          question: 'Test poll?',
          options: ['Option 1', 'Option 2'],
          deadline: new Date(Date.now() - 86400000).toISOString(),
          threadId: thread.id,
        },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
    }
  });
});

describe('GET /api/poll', () => {
  it('should retrieve polls', async () => {
    const response = await axios.get(`${BASE_URL}/poll`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should filter polls by threadId', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Thread content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Test poll?',
        options: ['Yes', 'No'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token)
    );

    const response = await axios.get(`${BASE_URL}/poll?threadId=${thread.id}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    if (response.data.length > 0) {
      expect(response.data.some(p => p.threadId === thread.id)).toBe(true);
    }
  });
});
