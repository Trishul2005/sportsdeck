import axios from 'axios';
import {
  createTestUser,
  createTestPost,
  createTestThreadWithPost,
  authHeaders,
  BASE_URL,
} from './helpers/testUtils';

describe('POST /api/post', () => {
  it('should return 401 without auth token', async () => {
    try {
      await axios.post(`${BASE_URL}/post`, {
        content: 'Test post',
      });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  it('should create a post without threadId', async () => {
    const { token } = await createTestUser();

    const response = await axios.post(
      `${BASE_URL}/post`,
      { content: 'Test post content' },
			authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBeDefined();
    expect(response.data.content).toBe('Test post content');
    expect(response.data.threadId).toBeNull();
  });

  it('should create a post with threadId', async () => {
    const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Test thread',
			'Main post',
		);

    const response = await axios.post(
      `${BASE_URL}/post`,
      {
        content: 'Reply post content',
        threadId: thread.id,
      },
			authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBeDefined();
    expect(response.data.content).toBe('Reply post content');
    expect(response.data.threadId).toBe(thread.id);
  });

  it('should return 400 if content is missing', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(`${BASE_URL}/post`, {}, authHeaders(token));
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Content is required to create a post.',
			);
    }
  });

  it('should return 404 if thread not found', async () => {
    const { token } = await createTestUser();

    try {
      await axios.post(
        `${BASE_URL}/post`,
        {
          content: 'Test post',
          threadId: 999999,
        },
				authHeaders(token),
      );
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe('Thread not found.');
    }
  });

  it('should create a reply to a post', async () => {
    const { token } = await createTestUser();
		const { thread, mainPost } = await createTestThreadWithPost(
			token,
			'Test thread',
			'Main post',
		);

    const response = await axios.post(
      `${BASE_URL}/post`,
      {
        content: 'Reply to main post',
        threadId: thread.id,
        parentId: mainPost.id,
      },
			authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.content).toBe('Reply to main post');
    expect(response.data.parentId).toBe(mainPost.id);
  });
});

describe('GET /api/post', () => {
  it('should return 400 if no post ID provided', async () => {
    try {
      await axios.get(`${BASE_URL}/post`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('Post ID is required.');
    }
  });

  it('should retrieve a post by ID', async () => {
    const { token } = await createTestUser();
    const post = await createTestPost(token, 'Test post content');

    const response = await axios.get(`${BASE_URL}/post?id=${post.id}`);

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(post.id);
    expect(response.data.content).toBe('Test post content');
    expect(response.data.author).toBeDefined();
  });

  it('should retrieve a post with nested replies', async () => {
    const { token } = await createTestUser();
    const { thread, mainPost } = await createTestThreadWithPost(
      token,
      'Thread for nested replies',
      'Root post content',
    );

    const levelOneReply = await createTestPost(
      token,
      'Level one reply',
      thread.id,
      mainPost.id,
    );

    await createTestPost(
      token,
      'Level two reply',
      thread.id,
      levelOneReply.id,
    );

    const response = await axios.get(`${BASE_URL}/post?id=${mainPost.id}`);
    const nestedRepliesResponse = await axios.get(
      `${BASE_URL}/post?parentId=${response.data.replies[0].id}`,
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(mainPost.id);
    expect(response.data.replies).toHaveLength(1);
    expect(response.data.replies[0].content).toBe('Level one reply');
    expect(response.data.replies[0].replyCount).toBe(1);
    expect(nestedRepliesResponse.status).toBe(200);
    expect(nestedRepliesResponse.data.replies).toHaveLength(1);
    expect(nestedRepliesResponse.data.replies[0].content).toBe('Level two reply');
  });

  it('should return 404 if post not found', async () => {
    try {
      await axios.get(`${BASE_URL}/post?id=999999`);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe('Post not found.');
    }
  });
});
