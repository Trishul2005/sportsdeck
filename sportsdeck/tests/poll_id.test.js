import axios from 'axios';
import {
  createTestUser,
  createTestThreadWithPost,
  authHeaders,
  BASE_URL,
} from './helpers/testUtils';

describe('PUT /api/poll/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.put(`${BASE_URL}/poll/1`, { question: 'Updated question?' });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should update poll successfully', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    // Create poll
    const createRes = await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Original question?',
        options: ['Yes', 'No'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token)
    );

    const pollId = createRes.data.id;

    // Update poll
    const response = await axios.put(
      `${BASE_URL}/poll/${pollId}`,
      { question: 'Updated question?' },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.question).toBe('Updated question?');
  });

  it('should return 403 if trying to update another user\'s poll', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token1, 'Poll thread', 'Content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const createRes = await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Original question?',
        options: ['Yes', 'No'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token1)
    );

    try {
      await axios.put(
        `${BASE_URL}/poll/${createRes.data.id}`,
        { question: 'Hacked question?' },
        authHeaders(token2)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if poll not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.put(
        `${BASE_URL}/poll/999999`,
        { question: 'Updated question?' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});

describe('DELETE /api/poll/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.delete(`${BASE_URL}/poll/1`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should delete poll successfully', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Poll thread', 'Content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const createRes = await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Poll to delete?',
        options: ['Yes', 'No'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token)
    );

    const response = await axios.delete(
      `${BASE_URL}/poll/${createRes.data.id}`,
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Poll deleted successfully');
  });

  it('should return 403 if trying to delete another user\'s poll', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token1, 'Poll thread', 'Content');

    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const createRes = await axios.post(
      `${BASE_URL}/poll`,
      {
        question: 'Poll question?',
        options: ['Yes', 'No'],
        deadline: futureDate,
        threadId: thread.id,
      },
      authHeaders(token1)
    );

    try {
      await axios.delete(`${BASE_URL}/poll/${createRes.data.id}`, authHeaders(token2));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if poll not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.delete(`${BASE_URL}/poll/999999`, authHeaders(token));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});
