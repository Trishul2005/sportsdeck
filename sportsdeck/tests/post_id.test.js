import axios from 'axios';
import {
  createTestUser,
  createTestPost,
  createTestThread,
  createTestThreadWithPost,
  authHeaders,
  generateUniqueId,
  BASE_URL,
} from './helpers/testUtils';

describe('PUT /api/post/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.put(`${BASE_URL}/post/1`, { content: 'Updated content' });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should update post content successfully', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Original content');

    const response = await axios.put(
      `${BASE_URL}/post/${post.id}`,
      { content: 'Updated content' },
      authHeaders(token)
    );

    expect(response.status).toBe(200);
    expect(response.data.content).toBe('Updated content');
    expect(response.data.version).toBe(2);
  });

  it('should return 403 if trying to update another user\'s post', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const post = await createTestPost(token1, 'Original content');

    try {
      await axios.put(
        `${BASE_URL}/post/${post.id}`,
        { content: 'Hacked content' },
        authHeaders(token2)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if post not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.put(
        `${BASE_URL}/post/999999`,
        { content: 'Updated content' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  it('should return 400 if content is empty', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Original content');

    try {
      await axios.put(
        `${BASE_URL}/post/${post.id}`,
        { content: '' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
    }
  });
});

describe('DELETE /api/post/[id]', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.delete(`${BASE_URL}/post/1`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should delete post successfully', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Content to delete');

    const response = await axios.delete(`${BASE_URL}/post/${post.id}`, authHeaders(token));

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Post deleted successfully');
  });

  it('should return 403 if trying to delete another user\'s post', async () => {
    const { token: token1 } = await createTestUser();
    const { token: token2 } = await createTestUser();
    const post = await createTestPost(token1, 'Original content');

    try {
      await axios.delete(`${BASE_URL}/post/${post.id}`, authHeaders(token2));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should return 404 if post not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.delete(`${BASE_URL}/post/999999`, authHeaders(token));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});
