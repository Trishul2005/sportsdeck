import axios from 'axios';
import {
	createTestUser,
	createTestPost,
	createTestThread,
	BASE_URL,
} from './helpers/testUtils';

describe('POST /api/post/[id]/translate', () => {
	const mockExternalHeaders = {
		headers: { 'x-mock-external-apis': 'true' },
		timeout: 25000,
	};

	it('returns 404 if post does not exist', async () => {
		try {
			await axios.post(
				`${BASE_URL}/post/999999/translate`,
				{},
				mockExternalHeaders,
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Post not found');
		}
	});

	it('returns translated text successfully for a reply', async () => {
		const { token } = await createTestUser();

		// Create a main post and thread
		const mainPost = await createTestPost(token, 'Main post content');
		const thread = await createTestThread(
			token,
			'Test thread',
			mainPost.id,
		);

		// Create a reply to the main post
		const reply = await createTestPost(
			token,
			'Reply content',
			thread.id,
			mainPost.id,
		);

		const response = await axios.post(
			`${BASE_URL}/post/${reply.id}/translate`,
			{},
			mockExternalHeaders,
		);

		expect(response.status).toBe(200);
		expect(response.data.id).toBe(String(reply.id));
		expect(response.data.originalText).toBe('Reply content');
		expect(response.data.translatedText).toBe('[MOCK] Reply content');
	});

	it('returns translated text successfully', async () => {
		const { token } = await createTestUser();

		// Create a post with foreign language text
		const post = await createTestPost(token, 'Bonjour le monde');
		const thread = await createTestThread(token, 'Test thread', post.id);

		const response = await axios.post(
			`${BASE_URL}/post/${post.id}/translate`,
			{}, // empty body
			mockExternalHeaders,
		);

		expect(response.status).toBe(200);
		expect(response.data.id).toBe(String(post.id));
		expect(response.data.message).toBe('Translation fetched successfully');
		expect(response.data.originalText).toBe('Bonjour le monde');
		expect(response.data.translatedText).toBe('[MOCK] Bonjour le monde');
	}, 30000); // 30 second timeout for AI API
});
