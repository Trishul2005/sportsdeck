import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import { getAuthUserFromCookie } from '@/lib/auth';
import { withRedisRouteCache } from '@/app/utils/routeCache';

const DEFAULT_REPLY_PAGE_SIZE = 6;
const DEFAULT_FOLLOWING_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 25;

function parsePositiveInt(rawValue, fallback) {
	if (rawValue === null || rawValue === undefined) return fallback;
	const parsed = parseInt(rawValue, 10);
	if (Number.isNaN(parsed) || parsed < 1) return fallback;
	return parsed;
}

function normalizeSort(rawValue, allowed, fallback) {
	if (!rawValue || typeof rawValue !== 'string') return fallback;
	return allowed.has(rawValue) ? rawValue : fallback;
}

function toIso(value) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

function emptyPayload() {
	return {
		me: null,
		summary: {
			replies: 0,
			following: 0,
			team: 0,
		},
		replies: {
			items: [],
			meta: {
				page: 1,
				pageSize: DEFAULT_REPLY_PAGE_SIZE,
				totalItems: 0,
				totalPages: 1,
				sort: 'recent',
			},
		},
		following: {
			items: [],
			meta: {
				page: 1,
				pageSize: DEFAULT_FOLLOWING_PAGE_SIZE,
				totalItems: 0,
				totalPages: 1,
				sort: 'recent',
			},
		},
		team: {
			threads: [],
			matches: [],
		},
	};
}

export async function GET(request) {
	const auth = await getAuthUserFromCookie(request);
	const viewerKey = auth.error ? 'anon' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(request, async () => {
	try {
		if (auth.error) {
			return NextResponse.json(emptyPayload(), { status: 200 });
		}

		const { searchParams } = new URL(request.url);
		const replyPage = parsePositiveInt(searchParams.get('replyPage'), 1);
		const replyPageSize = Math.min(
			parsePositiveInt(searchParams.get('replyPageSize'), DEFAULT_REPLY_PAGE_SIZE),
			MAX_PAGE_SIZE,
		);
		const followingPage = parsePositiveInt(searchParams.get('followingPage'), 1);
		const followingPageSize = Math.min(
			parsePositiveInt(searchParams.get('followingPageSize'), DEFAULT_FOLLOWING_PAGE_SIZE),
			MAX_PAGE_SIZE,
		);

		const replySort = normalizeSort(
			searchParams.get('replySort'),
			new Set(['recent', 'oldest', 'thread']),
			'recent',
		);
		const followingSort = normalizeSort(
			searchParams.get('followingSort'),
			new Set(['recent', 'posts', 'threads']),
			'recent',
		);

		const me = await prisma.user.findUnique({
			where: { id: auth.payload.userId },
			select: {
				id: true,
				username: true,
				avatar: true,
				favoriteTeam: {
					select: {
						id: true,
						name: true,
						logoUrl: true,
					},
				},
			},
		});

		if (!me) {
			return NextResponse.json(emptyPayload(), { status: 200 });
		}

		const myPosts = await prisma.post.findMany({
			where: {
				authorId: me.id,
				isVisible: true,
			},
			select: {
				id: true,
				content: true,
				createdAt: true,
				threadId: true,
			},
		});

		const myPostIds = myPosts.map((post) => post.id);
		const myPostById = new Map(myPosts.map((post) => [post.id, post]));

		let replyItems = [];
		let totalReplyGroups = 0;
		let totalReplyCount = 0;

		if (myPostIds.length > 0) {
			const replyAggregates = await prisma.post.groupBy({
				by: ['parentId'],
				where: {
					isVisible: true,
					authorId: { not: me.id },
					parentId: { in: myPostIds },
				},
				_count: { _all: true },
				_max: { createdAt: true },
			});

			const groups = replyAggregates
				.filter((group) => group.parentId && myPostById.has(group.parentId))
				.map((group) => {
					const ownedPost = myPostById.get(group.parentId);
					return {
						post: {
							id: ownedPost.id,
							content: ownedPost.content,
							createdAt: toIso(ownedPost.createdAt),
							threadId: ownedPost.threadId,
						},
						count: group._count._all,
						latestAt: toIso(group._max.createdAt) || toIso(ownedPost.createdAt),
					};
				});

			totalReplyGroups = groups.length;
			totalReplyCount = groups.reduce((sum, group) => sum + group.count, 0);

			groups.sort((a, b) => {
				if (replySort === 'oldest') {
					return +new Date(a.latestAt || 0) - +new Date(b.latestAt || 0);
				}
				if (replySort === 'thread') {
					const aThread = a.post.threadId || Number.MAX_SAFE_INTEGER;
					const bThread = b.post.threadId || Number.MAX_SAFE_INTEGER;
					if (aThread !== bThread) return aThread - bThread;
				}
				return +new Date(b.latestAt || 0) - +new Date(a.latestAt || 0);
			});

			const replySkip = (replyPage - 1) * replyPageSize;
			const pagedGroups = groups.slice(replySkip, replySkip + replyPageSize);

			replyItems = [];
			for (const group of pagedGroups) {
				const previewReplies = await prisma.post.findMany({
					where: {
						parentId: group.post.id,
						isVisible: true,
						authorId: { not: me.id },
					},
					orderBy: { createdAt: 'desc' },
					take: 3,
					select: {
						id: true,
						content: true,
						createdAt: true,
						author: {
							select: {
								id: true,
								username: true,
								avatar: true,
							},
						},
					},
				});

				replyItems.push({
					...group,
					previewReplies: previewReplies.map((reply) => ({
						id: reply.id,
						content: reply.content,
						createdAt: toIso(reply.createdAt),
						author: reply.author,
					})),
				});
			}
		}

		const follows = await prisma.follow.findMany({
			where: { followerId: me.id },
			select: { followingId: true },
		});
		const followedIds = follows.map((entry) => entry.followingId);

		let followingItems = [];
		let totalFollowingPosts = 0;
		let totalFollowingGroups = 0;

		if (followedIds.length > 0) {
			const followingAggregates = await prisma.post.groupBy({
				by: ['authorId'],
				where: {
					isVisible: true,
					authorId: { in: followedIds },
				},
				_count: { _all: true },
				_max: { createdAt: true },
			});

			const threadCountsByAuthor = new Map();
			if (followingSort === 'threads') {
				const threadRows = await prisma.post.findMany({
					where: {
						isVisible: true,
						authorId: { in: followedIds },
						threadId: { not: null },
					},
					select: {
						authorId: true,
						threadId: true,
					},
					distinct: ['authorId', 'threadId'],
				});

				for (const row of threadRows) {
					const prev = threadCountsByAuthor.get(row.authorId) || 0;
					threadCountsByAuthor.set(row.authorId, prev + 1);
				}
			}

			const groupedFollowing = followingAggregates.map((aggregate) => ({
				authorId: aggregate.authorId,
				count: aggregate._count._all,
				latestAt: toIso(aggregate._max.createdAt),
				threadCount: threadCountsByAuthor.get(aggregate.authorId) || 0,
			}));

			totalFollowingPosts = groupedFollowing.reduce((sum, group) => sum + group.count, 0);
			totalFollowingGroups = groupedFollowing.length;

			groupedFollowing.sort((a, b) => {
				if (followingSort === 'posts') {
					if (b.count !== a.count) return b.count - a.count;
					return +new Date(b.latestAt || 0) - +new Date(a.latestAt || 0);
				}
				if (followingSort === 'threads') {
					if (b.threadCount !== a.threadCount) return b.threadCount - a.threadCount;
					return +new Date(b.latestAt || 0) - +new Date(a.latestAt || 0);
				}
				return +new Date(b.latestAt || 0) - +new Date(a.latestAt || 0);
			});

			const followingSkip = (followingPage - 1) * followingPageSize;
			const pagedFollowing = groupedFollowing.slice(
				followingSkip,
				followingSkip + followingPageSize,
			);
			const pagedAuthorIds = pagedFollowing.map((group) => group.authorId);

			const authors = await prisma.user.findMany({
				where: { id: { in: pagedAuthorIds } },
				select: { id: true, username: true, avatar: true },
			});
			const previewPosts = await prisma.post.findMany({
				where: {
					isVisible: true,
					authorId: { in: pagedAuthorIds },
				},
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					content: true,
					createdAt: true,
					threadId: true,
					authorId: true,
				},
			});

			const authorById = new Map(authors.map((author) => [author.id, author]));
			const previewsByAuthor = new Map();
			for (const post of previewPosts) {
				const list = previewsByAuthor.get(post.authorId) || [];
				if (list.length < 3) {
					list.push({
						id: post.id,
						content: post.content,
						createdAt: toIso(post.createdAt),
						threadId: post.threadId,
					});
					previewsByAuthor.set(post.authorId, list);
				}
			}

			followingItems = pagedFollowing
				.map((group) => {
					const author = authorById.get(group.authorId);
					if (!author) return null;
					return {
						authorId: group.authorId,
						authorName: author.username,
						authorAvatar: author.avatar,
						count: group.count,
						latestAt: group.latestAt,
						threadCount: group.threadCount,
						previewPosts: previewsByAuthor.get(group.authorId) || [],
					};
				})
				.filter(Boolean);
		}

		let teamThreads = [];
		if (me.favoriteTeam?.id) {
			teamThreads = await prisma.thread.findMany({
				where: {
					isVisible: true,
					teamId: me.favoriteTeam.id,
				},
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					title: true,
					createdAt: true,
					mainPost: {
						select: {
							content: true,
						},
					},
				},
			});
		}

		let teamMatches = [];
		if (me.favoriteTeam?.id) {
			const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			teamMatches = await prisma.match.findMany({
				where: {
					OR: [
						{ homeTeamId: me.favoriteTeam.id },
						{ awayTeamId: me.favoriteTeam.id },
					],
					date: { gte: fromDate },
				},
				orderBy: { date: 'desc' },
				take: 6,
				select: {
					id: true,
					date: true,
					homeTeam: { select: { id: true, name: true, logoUrl: true } },
					awayTeam: { select: { id: true, name: true, logoUrl: true } },
					homeScore: true,
					awayScore: true,
					status: true,
				},
			});
		}

		const teamUpdates = teamThreads.length + teamMatches.length;
		const replyTotalPages = Math.max(1, Math.ceil(totalReplyGroups / replyPageSize));
		const followingTotalPages = Math.max(
			1,
			Math.ceil(totalFollowingGroups / followingPageSize),
		);

		return NextResponse.json(
			{
				me,
				summary: {
					replies: totalReplyCount,
					following: totalFollowingPosts,
					team: teamUpdates,
				},
				replies: {
					items: replyItems,
					meta: {
						page: replyPage,
						pageSize: replyPageSize,
						totalItems: totalReplyGroups,
						totalPages: replyTotalPages,
						sort: replySort,
					},
				},
				following: {
					items: followingItems,
					meta: {
						page: followingPage,
						pageSize: followingPageSize,
						totalItems: totalFollowingGroups,
						totalPages: followingTotalPages,
						sort: followingSort,
					},
				},
				team: {
					threads: teamThreads.map((thread) => ({
						...thread,
						createdAt: toIso(thread.createdAt),
					})),
					matches: teamMatches.map((match) => ({
						...match,
						date: toIso(match.date),
					})),
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Error loading feed:', error);
		return NextResponse.json(
			{ error: 'Failed to load feed' },
			{ status: 500 },
		);
	}
	}, { namespace: 'feed', ttlSeconds: 60, keyParts: [viewerKey] });
}
