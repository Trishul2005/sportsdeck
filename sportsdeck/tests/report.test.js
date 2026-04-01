import axios from 'axios';
import {
  createTestUser,
  createTestThreadWithPost,
  authHeaders,
  BASE_URL,
} from './helpers/testUtils';

describe('POST /api/post/[id]/report', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.post(`${BASE_URL}/post/1/report`, {
        reason: 'Spam',
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should create a report for a post', async () => {
    const { token: reporter } = await createTestUser();
    const { token: author } = await createTestUser();
    const { mainPost } = await createTestThreadWithPost(author, 'Test thread', 'Test content');

    const response = await axios.post(
      `${BASE_URL}/post/${mainPost.id}/report`,
      { reason: 'Inappropriate content' },
      authHeaders(reporter)
    );

    expect(response.status).toBe(201);
    expect(response.data.message).toBe('Post reported successfully');
    expect(response.data.report).toBeDefined();
    expect(response.data.report.postId).toBe(mainPost.id);
  });

  it('should return 400 if reason is missing', async () => {
    const { token: reporter } = await createTestUser();
    const { token: author } = await createTestUser();
    const { mainPost } = await createTestThreadWithPost(author, 'Test thread', 'Test content');

    try {
      await axios.post(
        `${BASE_URL}/post/${mainPost.id}/report`,
        {},
        authHeaders(reporter)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('Reason is required');
    }
  });

  it('should return 404 if post not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(
        `${BASE_URL}/post/999999/report`,
        { reason: 'Spam' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe('Post not found');
    }
  });
});

describe('POST /api/threads/[id]/report', () => {
  it('should create a report for a thread', async () => {
    const { token: reporter } = await createTestUser();
    const { token: author } = await createTestUser();
    const { thread } = await createTestThreadWithPost(author, 'Test thread', 'Test content');

    const response = await axios.post(
      `${BASE_URL}/threads/${thread.id}/report`,
      { reason: 'Inappropriate thread' },
      authHeaders(reporter)
    );

    expect(response.status).toBe(201);
    expect(response.data.message).toBe('Thread reported successfully');
    expect(response.data.report).toBeDefined();
    expect(response.data.report.threadId).toBe(thread.id);
  });

  it('should return 404 if thread not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(
        `${BASE_URL}/threads/999999/report`,
        { reason: 'Spam' },
        authHeaders(token)
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
});
