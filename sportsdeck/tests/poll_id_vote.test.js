import axios from 'axios';
import {
	createTestUser,
	createTestThreadWithPost,
	authHeaders,
	BASE_URL,
} from './helpers/testUtils';

describe('POST /api/poll/[id]/vote', () => {
	it('should return 401 without auth token', async () => {
		try {
			await axios.post(`${BASE_URL}/poll/1/vote`, { optionId: 1 });
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('should cast a vote successfully', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		// Create poll
		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball', 'Baseball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		const poll = pollRes.data;
		const optionId = poll.options[0].id;

		// Vote
		const response = await axios.post(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId },
			authHeaders(token),
		);

		expect(response.status).toBe(201);
		expect(response.data.message).toBe('Vote cast successfully');
		expect(response.data.vote.optionId).toBe(optionId);
	});

	it('should return 400 if optionId is missing', async () => {
		const { token } = await createTestUser();

		try {
			await axios.post(`${BASE_URL}/poll/1/vote`, {}, authHeaders(token));
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
		}
	});

	it('should return 404 if poll not found', async () => {
		const { token } = await createTestUser();

		try {
			await axios.post(
				`${BASE_URL}/poll/999999/vote`,
				{ optionId: 1 },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
		}
	});

	it('should return 400 if user already voted', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		const poll = pollRes.data;
		const optionId = poll.options[0].id;

		// Vote first time
		await axios.post(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId },
			authHeaders(token),
		);

		// Try to vote again
		try {
			await axios.post(
				`${BASE_URL}/poll/${poll.id}/vote`,
				{ optionId },
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(400);
		}
	});
});

describe('GET /api/poll/[id]/vote', () => {
	it('should check if user has voted', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		const poll = pollRes.data;

		// Vote
		await axios.post(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId: poll.options[0].id },
			authHeaders(token),
		);

		// Get user's vote
		const response = await axios.get(
			`${BASE_URL}/poll/${poll.id}/vote`,
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(response.data.userVote).toBeDefined();
		expect(response.data.userVote.optionId).toBe(poll.options[0].id);
	});

	it('should return 404 if poll not found', async () => {
		const { token } = await createTestUser();

		try {
			await axios.get(`${BASE_URL}/poll/999999/vote`, authHeaders(token));
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
		}
	});
});

describe('PATCH /api/poll/[id]/vote', () => {
	it('should change vote successfully', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		const poll = pollRes.data;

		// Vote first time
		await axios.post(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId: poll.options[0].id },
			authHeaders(token),
		);

		// Change vote
		const response = await axios.patch(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId: poll.options[1].id },
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe('Vote updated successfully');
	});

	it('should return 401 without auth token', async () => {
		try {
			await axios.patch(`${BASE_URL}/poll/1/vote`, { optionId: 1 });
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});
});

describe('DELETE /api/poll/[id]/vote', () => {
	it('should delete vote successfully', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		const poll = pollRes.data;

		// Vote
		await axios.post(
			`${BASE_URL}/poll/${poll.id}/vote`,
			{ optionId: poll.options[0].id },
			authHeaders(token),
		);

		// Delete vote
		const response = await axios.delete(
			`${BASE_URL}/poll/${poll.id}/vote`,
			authHeaders(token),
		);

		expect(response.status).toBe(200);
		expect(response.data.message).toBe('Vote removed successfully');
	});

	it('should return 401 without auth token', async () => {
		try {
			await axios.delete(`${BASE_URL}/poll/1/vote`);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(401);
		}
	});

	it('should return 404 if vote not found', async () => {
		const { token } = await createTestUser();
		const { thread } = await createTestThreadWithPost(
			token,
			'Poll thread',
			'Content',
		);

		const futureDate = new Date(Date.now() + 86400000).toISOString();

		const pollRes = await axios.post(
			`${BASE_URL}/poll`,
			{
				question: 'Favorite sport?',
				options: ['Football', 'Basketball'],
				deadline: futureDate,
				threadId: thread.id,
			},
			authHeaders(token),
		);

		try {
			await axios.delete(
				`${BASE_URL}/poll/${pollRes.data.id}/vote`,
				authHeaders(token),
			);
			fail('Should have thrown an error');
		} catch (error) {
			expect(error.response.status).toBe(404);
		}
	});
});
