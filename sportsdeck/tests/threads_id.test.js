import axios from 'axios';
import {
  createTestUser,
  createTestThreadWithPost,
  authHeaders,
  generateUniqueId,
  BASE_URL,
} from './helpers/testUtils';

describe('PUT /api/threads/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.put(`${BASE_URL}/threads/1`, { title: 'Updated title' });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should update thread title successfully', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Original title', 'Content');

    const response = await axios.put(
      `${BASE_URL}/threads/${thread.id}`,
      { title: 'Updated title' },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.title).toBe('Updated title');
  });

  it('should return 403 if trying to update another user\'s thread', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token1, 'Original title', 'Content');

    try {
      await axios.put(
        `${BASE_URL}/threads/${thread.id}`,
        { title: 'Hacked title' },
        authHeaders(token2)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if thread not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.put(
        `${BASE_URL}/threads/999999`,
        { title: 'Updated title' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  it('should close a thread', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Thread title', 'Content');

    const response = await axios.put(
      `${BASE_URL}/threads/${thread.id}`,
      { isClosed: true },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.isClosed).toBe(true);
  });
});

describe('DELETE /api/threads/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.delete(`${BASE_URL}/threads/1`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should delete thread successfully', async () => {
    const { token } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token, 'Thread to delete', 'Content');

    const response = await axios.delete(`${BASE_URL}/threads/${thread.id}`, authHeaders(token));

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Thread deleted successfully');
  });

  it('should return 403 if trying to delete another user\'s thread', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const { thread } = await createTestThreadWithPost(token1, 'Thread title', 'Content');

    try {
      await axios.delete(`${BASE_URL}/threads/${thread.id}`, authHeaders(token2));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if thread not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.delete(`${BASE_URL}/threads/999999`, authHeaders(token));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});
