import axios from 'axios';
import { prisma } from '@/prisma/db';
import bcrypt from 'bcrypt';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';

// Helper to create unique test data
let testCounter = 0;
export const generateUniqueId = () => {
	testCounter++;
	const random = Math.floor(Math.random() * 10000);
	return `test${Date.now()}${testCounter}${random}`;
};

// Helper to create a test user directly in DB (faster and more reliable)
export const createTestUserInDB = async (customData = {}) => {
	const uniqueId = generateUniqueId();
	const userData = {
		username: customData.username || `user${uniqueId}`,
		email: customData.email || `${uniqueId}@test.com`,
		password: customData.password || 'testpass123',
	};

	const hashedPassword = await bcrypt.hash(userData.password, 10);

	const user = await prisma.user.create({
		data: {
			username: userData.username,
			email: userData.email,
			password: hashedPassword,
		},
	});

	// Login to get tokens
	const loginRes = await axios.post(`${BASE_URL}/user/login`, {
		username: userData.username,
		password: userData.password,
	});

	return {
		user,
		token: loginRes.data.accessToken,
		refreshToken: loginRes.data.refreshToken,
		credentials: userData,
	};
};

// Helper to create a test user via API (use this when you want to test the full flow)
export const createTestUser = async (customData = {}) => {
	const uniqueId = generateUniqueId();
	const userData = {
		username: customData.username || `user${uniqueId}`,
		email: customData.email || `${uniqueId}@test.com`,
		password: customData.password || 'testpass123',
	};

	const signupRes = await axios.post(`${BASE_URL}/user/signup`, userData);
	const loginRes = await axios.post(`${BASE_URL}/user/login`, {
		username: userData.username,
		password: userData.password,
	});

	return {
		user: signupRes.data.user,
		token: loginRes.data.accessToken,
		refreshToken: loginRes.data.refreshToken,
		credentials: userData,
	};
};

// Helper to create authenticated headers
export const authHeaders = (token) => ({
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`,
	},
});

// Helper to create a test post
export const createTestPost = async (
	token,
	content,
	threadId = null,
	parentId = null,
) => {
	const postData = {
		content: content || `Test post ${generateUniqueId()}`,
	};
	if (threadId) postData.threadId = threadId;
	if (parentId) postData.parentId = parentId;

	const res = await axios.post(
		`${BASE_URL}/post`,
		postData,
		authHeaders(token),
	);
	return res.data;
};

// Helper to create a test thread
export const createTestThread = async (
	token,
	title,
	mainPostId,
	teamId = null,
	tags = [],
) => {
	const threadData = {
		title: title || `Test thread ${generateUniqueId()}`,
		mainPostId,
	};
	if (teamId) threadData.teamId = teamId;
	if (tags.length > 0) threadData.tags = tags;

	const res = await axios.post(
		`${BASE_URL}/threads`,
		threadData,
		authHeaders(token),
	);
	return res.data;
};

// Helper to create a full thread with main post
export const createTestThreadWithPost = async (token, title, content) => {
	const post = await createTestPost(token, content);
	const thread = await createTestThread(token, title, post.id);
	return { thread, mainPost: post };
};

// Helper to create a test team
export const createTestTeam = async (token, name) => {
	const teamData = {
		name: name || `Test Team ${generateUniqueId()}`,
	};
	const res = await axios.post(
		`${BASE_URL}/teams`,
		teamData,
		authHeaders(token),
	);
	return res.data;
};

// Helper to create a test match
export const createTestMatch = async (token, teamAId, teamBId, date) => {
	const matchData = {
		teamAId,
		teamBId,
		date: date || new Date().toISOString(),
	};
	const res = await axios.post(
		`${BASE_URL}/matches`,
		matchData,
		authHeaders(token),
	);
	return res.data;
};

// Direct DB helpers for missing API endpoints
export const createTestTeamInDB = async (name = 'Test Team') => {
	return await prisma.team.create({
		data: {
			name: `${name} ${Date.now()}`,
			logoUrl: 'https://example.com/logo.png',
			wins: 10,
			losses: 5,
			conference: 'Eastern',
			division: 'Atlantic',
		},
	});
};

export const createTestMatchInDB = async (
	homeTeamId,
	awayTeamId,
	date = new Date(),
) => {
	return await prisma.match.create({
		data: {
			homeTeamId,
			awayTeamId,
			homeScore: 105,
			awayScore: 98,
			date: date,
		},
	});
};

// Designed for fast setup of threads and posts without api calls.
export const createTestPostInDB = async (
	authorId,
	content,
	threadId = null,
	parentId = null,
) => {
	return await prisma.post.create({
		data: {
			content: content || `Test post ${generateUniqueId()}`,
			authorId,
			threadId,
			parentId,
			isVisible: true,
		},
	});
};
// Designed for fast setup of threads and posts without api calls. Does not handle tags or team associations, use API helper for that.
export const createTestThreadInDB = async (
	createdById,
	title,
	mainPost,
	teamId = null,
	matchId = null,
) => {
	return await prisma.thread.create({
		data: {
			title: title || `Test thread ${generateUniqueId()}`,
			mainPostId: mainPost,
			createdById,
			teamId,
			matchId,
			isVisible: true,
		},
	});
};

// Export axios instance for custom requests
export const api = axios;
export { BASE_URL };
