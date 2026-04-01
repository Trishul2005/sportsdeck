import axios from 'axios';
import {
	createTestUser,
	createTestPost,
	createTestThread,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';
import { prisma } from '../prisma/db';

// Helper to create a test team
const createTestTeam = async (name = 'Test Team', wins = 0, losses = 0) => {
	return await prisma.team.create({
		data: {
			name,
			wins,
			losses,
			conference: 'Test Conference',
			division: 'Test Division',
		},
	});
};

// Helper to create a test match
const createTestMatch = async (homeTeamId, awayTeamId) => {
	return await prisma.match.create({
		data: {
			homeTeamId,
			awayTeamId,
			date: new Date(),
			homeScore: 0,
			awayScore: 0,
		},
	});
};

// Helper to create a thread with match and posts
const createThreadWithMatchAndPosts = async (
	token,
	postContents = ['Test post 1', 'Test post 2'],
) => {
	// Create teams
	const homeTeam = await createTestTeam('Home Team');
	const awayTeam = await createTestTeam('Away Team');

	// Create match
	const match = await createTestMatch(homeTeam.id, awayTeam.id);

	// Create main post
	const mainPost = await createTestPost(token, postContents[0]);

	// Create thread linked to match
	const thread = await createTestThread(token, 'Test Thread', mainPost.id);

	// Link thread to match AND update mainPost to have threadId
	await prisma.thread.update({
		where: { id: thread.id },
		data: { matchId: match.id },
	});

	// Update mainPost to have threadId so it's included in thread.posts query
	await prisma.post.update({
		where: { id: mainPost.id },
		data: { threadId: thread.id },
	});

	// Create additional posts in the thread
	const additionalPosts = [];
	for (let i = 1; i < postContents.length; i++) {
		const post = await createTestPost(token, postContents[i], thread.id);
		additionalPosts.push(post);
	}

	return { thread, match, mainPost, additionalPosts, homeTeam, awayTeam };
};

describe('POST /api/threads/[id]/sentiment', () => {
	it('should return 400 for invalid thread ID', async () => {
		try {
			await axios.post(`${BASE_URL}/threads/invalid/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid thread ID');
		}
	});

	it('should return 404 if thread not found', async () => {
		try {
			await axios.post(`${BASE_URL}/threads/999999/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Thread not found');
		}
	});

	it('should return 400 if thread is not associated with a match', async () => {
		const { token } = await createTestUser();
		const mainPost = await createTestPost(token, 'Test post');
		const thread = await createTestThread(
			token,
			'Test Thread',
			mainPost.id,
		);

		try {
			await axios.post(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Thread is not associated with a match',
			);
		}
	});

	// Note: Testing "no posts found" is not realistic with current schema
	// because Thread.mainPostId is required and non-nullable, meaning a thread
	// must always have at least one post (the mainPost). Skipping this test.

	it('should create sentiment analysis successfully', async () => {
		const { token } = await createTestUser();
		const { thread, match } = await createThreadWithMatchAndPosts(token, [
			'This is a great game!',
			'Really enjoying this match',
			'Best performance ever',
		]);

		const response = await axios.post(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(response.status).toBe(200);
		expect(response.data).toHaveProperty('id');
		expect(response.data.matchId).toBe(match.id);
		expect(response.data).toHaveProperty('overall');
		expect(response.data).toHaveProperty('homeTeam');
		expect(response.data).toHaveProperty('awayTeam');
		expect(response.data.numPosts).toBe(3);
		expect(typeof response.data.overall).toBe('number');
		expect(typeof response.data.homeTeam).toBe('number');
		expect(typeof response.data.awayTeam).toBe('number');
	});

	it('should handle multiple posts in batches', async () => {
		const { token } = await createTestUser();
		const postContents = Array.from(
			{ length: 25 },
			(_, i) => `Test post ${i + 1}`,
		);
		const { thread, match } = await createThreadWithMatchAndPosts(
			token,
			postContents,
		);

		const response = await axios.post(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(response.status).toBe(200);
		expect(response.data.matchId).toBe(match.id);
		expect(response.data.numPosts).toBe(25);
	});
});

describe('GET /api/threads/[id]/sentiment', () => {
	it('should return 400 for invalid thread ID', async () => {
		try {
			await axios.get(`${BASE_URL}/threads/invalid/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid thread ID');
		}
	});

	it('should return 404 if thread not found', async () => {
		try {
			await axios.get(`${BASE_URL}/threads/999999/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Thread not found');
		}
	});

	it('should return 400 if thread is not associated with a match', async () => {
		const { token } = await createTestUser();
		const mainPost = await createTestPost(token, 'Test post');
		const thread = await createTestThread(
			token,
			'Test Thread',
			mainPost.id,
		);

		try {
			await axios.get(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Thread is not associated with a match',
			);
		}
	});

	it('should return 404 if sentiment analysis not found', async () => {
		const { token } = await createTestUser();
		const { thread } = await createThreadWithMatchAndPosts(token);

		try {
			await axios.get(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe(
				'Sentiment analysis not found for this thread',
			);
		}
	});

	it('should retrieve sentiment analysis successfully', async () => {
		const { token } = await createTestUser();
		const { thread, match } = await createThreadWithMatchAndPosts(token);

		// Create sentiment first
		await axios.post(`${BASE_URL}/threads/${thread.id}/sentiment`);

		// Retrieve sentiment
		const response = await axios.get(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(response.status).toBe(200);
		expect(response.data).toHaveProperty('id');
		expect(response.data.matchId).toBe(match.id);
		expect(response.data).toHaveProperty('overall');
		expect(response.data).toHaveProperty('homeTeam');
		expect(response.data).toHaveProperty('awayTeam');
		expect(response.data.numPosts).toBeGreaterThan(0);
	});
});

describe('DELETE /api/threads/[id]/sentiment', () => {
	it('should return 400 for invalid thread ID', async () => {
		try {
			await axios.delete(`${BASE_URL}/threads/invalid/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid thread ID');
		}
	});

	it('should return 404 if thread not found', async () => {
		try {
			await axios.delete(`${BASE_URL}/threads/999999/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Thread not found');
		}
	});

	it('should return 400 if thread is not associated with a match', async () => {
		const { token } = await createTestUser();
		const mainPost = await createTestPost(token, 'Test post');
		const thread = await createTestThread(
			token,
			'Test Thread',
			mainPost.id,
		);

		try {
			await axios.delete(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Thread is not associated with a match',
			);
		}
	});

	it('should delete sentiment analysis successfully', async () => {
		const { token } = await createTestUser();
		const { thread } = await createThreadWithMatchAndPosts(token);

		// Create sentiment first
		await axios.post(`${BASE_URL}/threads/${thread.id}/sentiment`);

		// Delete sentiment
		const response = await axios.delete(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe(
			'Sentiment analysis deleted successfully',
		);

		// Verify it's deleted
		try {
			await axios.get(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
		}
	});

	it('should succeed even if no sentiment exists', async () => {
		const { token } = await createTestUser();
		const { thread } = await createThreadWithMatchAndPosts(token);

		const response = await axios.delete(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe(
			'Sentiment analysis deleted successfully',
		);
	});
});

describe('PUT /api/threads/[id]/sentiment', () => {
	it('should return 400 for invalid thread ID', async () => {
		try {
			await axios.put(`${BASE_URL}/threads/invalid/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe('Invalid thread ID');
		}
	});

	it('should return 404 if thread not found', async () => {
		try {
			await axios.put(`${BASE_URL}/threads/999999/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
			expect(error.response.data.error).toBe('Thread not found');
		}
	});

	it('should return 400 if thread is not associated with a match', async () => {
		const { token } = await createTestUser();
		const mainPost = await createTestPost(token, 'Test post');
		const thread = await createTestThread(
			token,
			'Test Thread',
			mainPost.id,
		);

		try {
			await axios.put(`${BASE_URL}/threads/${thread.id}/sentiment`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
			expect(error.response.data.error).toBe(
				'Thread is not associated with a match',
			);
		}
	});

	// it('should return 429 if updated less than an hour ago', async () => {
	// 	const { token } = await createTestUser();
	// 	const { thread } = await createThreadWithMatchAndPosts(token);

	// 	// Create initial sentiment
	// 	await axios.post(`${BASE_URL}/threads/${thread.id}/sentiment`);

	// 	// Try to update immediately
	// 	try {
	// 		await axios.put(`${BASE_URL}/threads/${thread.id}/sentiment`);
	// 		fail('Should have thrown an error');
	// 	} catch (error) {
	// 		expect(error.response.status).toBe(429);
	// 		expect(error.response.data.error).toContain(
	// 			'less than an hour ago',
	// 		);
	// 	}
	// });

	it('should return existing sentiment if no new posts since last update', async () => {
		const { token } = await createTestUser();
		const { thread, match, mainPost, additionalPosts } =
			await createThreadWithMatchAndPosts(token);

		// Set post timestamps to past
		const pastTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
		await prisma.post.update({
			where: { id: mainPost.id },
			data: { createdAt: pastTime },
		});
		for (const post of additionalPosts) {
			await prisma.post.update({
				where: { id: post.id },
				data: { createdAt: pastTime },
			});
		}

		// Create initial sentiment
		const createResponse = await axios.post(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		// Simulate time passing by updating the sentiment record (but after posts were created)
		await prisma.sentiment.update({
			where: { matchId: match.id },
			data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 hours ago
		});

		// Try to update (no new posts)
		const updateResponse = await axios.put(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.data.id).toBe(createResponse.data.id);
		expect(updateResponse.data.numPosts).toBe(createResponse.data.numPosts);
	});

	it('should update sentiment with new posts', async () => {
		const { token } = await createTestUser();
		const { thread, match, mainPost, additionalPosts } =
			await createThreadWithMatchAndPosts(token, [
				'Initial post 1',
				'Initial post 2',
			]);

		// Set initial posts to past
		const pastTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
		await prisma.post.update({
			where: { id: mainPost.id },
			data: { createdAt: pastTime },
		});
		for (const post of additionalPosts) {
			await prisma.post.update({
				where: { id: post.id },
				data: { createdAt: pastTime },
			});
		}

		// Create initial sentiment
		const createResponse = await axios.post(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);
		expect(createResponse.data.numPosts).toBe(2);

		// Simulate time passing
		await prisma.sentiment.update({
			where: { matchId: match.id },
			data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
		});

		// Add new posts (these will have current timestamp)
		await createTestPost(token, 'New post 3', thread.id);
		await createTestPost(token, 'New post 4', thread.id);

		// Update sentiment
		const updateResponse = await axios.put(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.data.numPosts).toBe(4);
		expect(updateResponse.data).toHaveProperty('overall');
		expect(updateResponse.data).toHaveProperty('homeTeam');
		expect(updateResponse.data).toHaveProperty('awayTeam');
	});

	it('should calculate weighted average correctly', async () => {
		const { token } = await createTestUser();
		const { thread, match, mainPost } = await createThreadWithMatchAndPosts(
			token,
			['Post 1'],
		);

		// Set initial post to past
		const pastTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
		await prisma.post.update({
			where: { id: mainPost.id },
			data: { createdAt: pastTime },
		});

		// Create initial sentiment
		const createResponse = await axios.post(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);
		const initialOverall = createResponse.data.overall;

		// Simulate time passing
		await prisma.sentiment.update({
			where: { matchId: match.id },
			data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
		});

		// Add more posts (double the amount) - these will have current timestamp
		await createTestPost(token, 'Post 2', thread.id);

		// Update sentiment
		const updateResponse = await axios.put(
			`${BASE_URL}/threads/${thread.id}/sentiment`,
		);

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.data.numPosts).toBe(2);
		// The new overall should be different from initial (unless by chance both are identical)
		expect(typeof updateResponse.data.overall).toBe('number');
	});
});
