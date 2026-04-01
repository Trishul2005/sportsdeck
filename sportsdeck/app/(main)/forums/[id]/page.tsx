'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Author = {
	id: number;
	username: string;
	avatar: string | null;
};

type Post = {
	id: number;
	content: string;
	authorId?: number;
	parentId?: number | null;
	version: number;
	isVisible?: boolean;
	createdAt: string;
	updatedAt?: string;
	author?: Author | null;
	replyCount?: number;
	replies?: Post[];
};

type PostVersion = {
	version: number;
	content: string;
	editedAt: string;
};

type PollVote = {
	id: number;
	userId: number;
};

type PollOption = {
	id: number;
	text: string;
	votes: PollVote[];
};

type Poll = {
	id: number;
	question: string;
	deadline: string;
	updatedAt?: string;
	version: number;
	isVisible?: boolean;
	threadId?: number | null;
	createdById: number;
	createdBy?: { id: number; username: string; avatar?: string | null } | null;
	post?: {
		id: number;
		threadId: number | null;
		parentId: number | null;
		content: string;
	} | null;
	thread?: {
		id: number;
		title: string;
		isClosed: boolean;
		isVisible: boolean;
	} | null;
	options: PollOption[];
};

type PollVersion = {
	version: number;
	question: string;
	deadline: string | null;
	options: string[];
	editedAt: string;
};

type Thread = {
	id: number;
	title: string;
	createdById: number;
	teamId: number | null;
	matchId: number | null;
		tags?: Array<{ tag: { name: string } }>;
	team?: {
		id: number;
		name: string;
		logoUrl: string | null;
	} | null;
	match?: {
		id: number;
		date: string | null;
		sentiment?: {
			overall: number | null;
			homeTeam: number | null;
			awayTeam: number | null;
		} | null;
		homeTeam: { id: number; name: string; logoUrl: string | null };
		awayTeam: { id: number; name: string; logoUrl: string | null };
	} | null;
	isClosed?: boolean;
	isVisible?: boolean;
	mainPostId: number;
	mainPost?: Post;
	polls?: Poll[];
};

type ReportTarget = {
	kind: 'thread' | 'post' | 'poll';
	id: number;
};

type ReplyPageResponse = {
	replies: Post[];
	nextCursor: number | null;
	hasMore: boolean;
};

type ElevatedBranch = {
	rootPostId: number;
	rootAuthor: string;
	replies: Post[];
};

const REPLIES_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 5;
const MAX_REPLY_DEPTH = 10;

function toLocalDateInputValue(value: Date) {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function localDatePlusDays(days: number) {
	const next = new Date();
	next.setDate(next.getDate() + days);
	return toLocalDateInputValue(next);
}

function toEndOfDayIso(localDate: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const deadline = new Date(year, month - 1, day, 23, 59, 59, 999);
	if (Number.isNaN(deadline.getTime())) return null;
	return deadline.toISOString();
}

export default function ThreadPage() {
	const params = useParams();
	const threadId = params.id as string;

	const [thread, setThread] = useState<Thread | null>(null);
	const [mainPost, setMainPost] = useState<Post | null>(null);
	const [pollUserVoteOptionId, setPollUserVoteOptionId] = useState<number | null>(null);
	const [isSubmittingPollVote, setIsSubmittingPollVote] = useState(false);
	const [pollSubmittingOptionId, setPollSubmittingOptionId] = useState<number | null>(null);
	const [pollVoteAction, setPollVoteAction] = useState<'cast' | 'change' | 'remove' | null>(null);
	const [pollError, setPollError] = useState('');
	const [pollSuccess, setPollSuccess] = useState('');
	const [isEditingPoll, setIsEditingPoll] = useState(false);
	const [pollQuestionDraft, setPollQuestionDraft] = useState('');
	const [pollDeadlineDateDraft, setPollDeadlineDateDraft] = useState('');
	const [pollOptionsDraft, setPollOptionsDraft] = useState<string[]>(['', '']);
	const [isSavingPoll, setIsSavingPoll] = useState(false);
	const [pollVersions, setPollVersions] = useState<PollVersion[]>([]);
	const [pollHistoryNextCursor, setPollHistoryNextCursor] = useState<number | null>(null);
	const [pollHistoryHasMore, setPollHistoryHasMore] = useState(false);
	const [isLoadingPollHistory, setIsLoadingPollHistory] = useState(false);
	const [pollHistoryError, setPollHistoryError] = useState('');
	const [showPollHistory, setShowPollHistory] = useState(false);
	const [replies, setReplies] = useState<Post[]>([]);
	const [showMainReplies, setShowMainReplies] = useState(true);
	const [hasLoadedMainReplies, setHasLoadedMainReplies] = useState(false);
	const [isLoadingInitialMainReplies, setIsLoadingInitialMainReplies] =
		useState(false);
	const [mainRepliesNextCursor, setMainRepliesNextCursor] =
		useState<number | null>(null);
	const [mainRepliesHasMore, setMainRepliesHasMore] = useState(false);
	const [isLoadingMoreMainReplies, setIsLoadingMoreMainReplies] = useState(false);

	function ContextTeam({
		name,
		logoUrl,
		href,
	}: {
		name: string;
		logoUrl: string | null;
		href?: string;
	}) {
		const content = (
			<span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-2 py-1 text-xs">
				{logoUrl ? (
					<Image
						src={logoUrl}
						alt={`${name} logo`}
						width={16}
						height={16}
						className="h-4 w-4 rounded-full object-cover"
					/>
				) : (
					<span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--card-soft)] text-[10px] font-semibold text-[var(--accent)]">
						{name.charAt(0).toUpperCase()}
					</span>
				)}
				{name}
			</span>
		);

		if (!href) {
			return content;
		}

		return (
			<Link href={href} className="inline-flex transition hover:text-[var(--accent-soft)]">
				{content}
			</Link>
		);
	}
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	const [mainPostVersions, setMainPostVersions] = useState<PostVersion[]>([]);
	const [mainHistoryNextCursor, setMainHistoryNextCursor] =
		useState<number | null>(null);
	const [mainHistoryHasMore, setMainHistoryHasMore] = useState(false);
	const [isLoadingMainHistory, setIsLoadingMainHistory] = useState(false);
	const [mainHistoryError, setMainHistoryError] = useState('');
	const [showMainHistory, setShowMainHistory] = useState(false);

	const [replyContent, setReplyContent] = useState('');
	const [isSubmittingReply, setIsSubmittingReply] = useState(false);
	const [replyError, setReplyError] = useState('');
	const [isEditingMainPost, setIsEditingMainPost] = useState(false);
	const [mainPostEditContent, setMainPostEditContent] = useState('');
	const [isSavingMainPostEdit, setIsSavingMainPostEdit] = useState(false);
	const [mainPostEditError, setMainPostEditError] = useState('');
	const [currentUserId, setCurrentUserId] = useState<number | null>(null);
	const [currentUserRole, setCurrentUserRole] = useState<'USER' | 'ADMIN' | null>(null);
	const [currentUserBanned, setCurrentUserBanned] = useState(false);

	// Tag editing UI state
	const [isEditingTags, setIsEditingTags] = useState(false);
	const [tagsDraft, setTagsDraft] = useState<string[]>([]);
	const [tagInputThread, setTagInputThread] = useState('');
	const [tagSuggestionsThread, setTagSuggestionsThread] = useState<Array<{ id: number; name: string }>>([]);
	const [liveTagSuggestionsThread, setLiveTagSuggestionsThread] = useState<Array<{ id: number; name: string }>>([]);
	const [activeTagSuggestionIndex, setActiveTagSuggestionIndex] = useState(-1);
	const [tagLoadingThread, setTagLoadingThread] = useState(false);
	const [elevatedBranch, setElevatedBranch] = useState<ElevatedBranch | null>(null);
	const [translatedMainPostContent, setTranslatedMainPostContent] = useState<string | null>(null);
	const [showTranslatedMainPost, setShowTranslatedMainPost] = useState(false);
	const [isTranslatingMainPost, setIsTranslatingMainPost] = useState(false);
	const [translationError, setTranslationError] = useState('');
	const [threadActionError, setThreadActionError] = useState('');
	const [threadActionSuccess, setThreadActionSuccess] = useState('');
	const [isSavingThreadAction, setIsSavingThreadAction] = useState(false);
	const [isEditingThreadTitle, setIsEditingThreadTitle] = useState(false);
	const [threadTitleDraft, setThreadTitleDraft] = useState('');

	const getAuthorName = (post: Post) =>
		post.author?.username?.trim() || 'Unknown User';
	const getAuthorAvatar = (post: Post) => post.author?.avatar || null;
	const getAuthorId = (post: Post) => post.author?.id ?? post.authorId ?? null;
	const getAuthorInitial = (post: Post) => getAuthorName(post).charAt(0).toUpperCase();
	const getPollCreatorName = (poll: Poll) =>
		poll.createdBy?.username?.trim() || 'Unknown User';
	const getPollCreatorAvatar = (poll: Poll) => poll.createdBy?.avatar || null;
	const getPollCreatorId = (poll: Poll) => poll.createdBy?.id ?? poll.createdById ?? null;
	const getPollCreatorInitial = (poll: Poll) =>
		getPollCreatorName(poll).charAt(0).toUpperCase();

	const normalizeVersion = (version: unknown, fallback = 1) => {
		if (typeof version !== 'number' || Number.isNaN(version)) {
			return Math.max(1, fallback);
		}
		return Math.max(1, Math.trunc(version));
	};

	const mergeUniquePosts = (existing: Post[], incoming: Post[]) => {
		const byId = new Map<number, Post>();
		for (const post of existing) {
			byId.set(post.id, post);
		}
		for (const post of incoming) {
			if (!byId.has(post.id)) {
				byId.set(post.id, post);
			}
		}
		return Array.from(byId.values());
	};

	const mergeRepliesForParent = (
		posts: Post[],
		parentId: number,
		newReplies: Post[],
	): Post[] => {
		return posts.map((post) => {
			if (post.id === parentId) {
				return {
					...post,
					replies: mergeUniquePosts(post.replies || [], newReplies),
				};
			}

			if (!post.replies || post.replies.length === 0) {
				return post;
			}

			return {
				...post,
				replies: mergeRepliesForParent(post.replies, parentId, newReplies),
			};
		});
	};

	const addReplyToTree = (posts: Post[], parentId: number, newReply: Post): Post[] => {
		return posts.map((post) => {
			if (post.id === parentId) {
				const hasReplyAlready = (post.replies || []).some((r) => r.id === newReply.id);
				return {
					...post,
					replyCount: (post.replyCount || 0) + (hasReplyAlready ? 0 : 1),
					replies: hasReplyAlready
						? post.replies || []
						: [...(post.replies || []), newReply],
				};
			}

			if (!post.replies || post.replies.length === 0) {
				return post;
			}

			return {
				...post,
				replies: addReplyToTree(post.replies, parentId, newReply),
			};
		});
	};

	const updateReplyInTree = (
		posts: Post[],
		postId: number,
		updatedPost: Post,
	): Post[] => {
		return posts.map((post) => {
			if (post.id === postId) {
				return {
					...post,
					...updatedPost,
					version: normalizeVersion(
						updatedPost.version,
						normalizeVersion(post.version),
					),
					replies: post.replies || updatedPost.replies || [],
				};
			}

			if (!post.replies || post.replies.length === 0) {
				return post;
			}

			return {
				...post,
				replies: updateReplyInTree(post.replies, postId, updatedPost),
			};
		});
	};

	const removeReplyFromTree = (posts: Post[], postId: number): Post[] => {
		return posts
			.filter((post) => post.id !== postId)
			.map((post) => ({
				...post,
				replies: post.replies ? removeReplyFromTree(post.replies, postId) : post.replies,
			}));
	};

	const decrementParentReplyCount = (posts: Post[], parentId: number): Post[] => {
		return posts.map((post) => {
			if (post.id === parentId) {
				return {
					...post,
					replyCount: Math.max(0, (post.replyCount || 0) - 1),
				};
			}

			if (!post.replies || post.replies.length === 0) {
				return post;
			}

			return {
				...post,
				replies: decrementParentReplyCount(post.replies, parentId),
			};
		});
	};

	const getPostVersions = (post: Post | null, versions: PostVersion[]) => {
		if (!post) return [];

		const normalized = versions
			.map((v) => ({
				version: normalizeVersion(v.version),
				content: typeof v.content === 'string' ? v.content : '',
				editedAt: v.editedAt,
			}))
			.sort((a, b) => a.version - b.version);

		if (normalized.length === 0) {
			return [
				{
					version: normalizeVersion(post.version),
					content: post.content,
					editedAt: post.updatedAt || post.createdAt,
				},
			];
		}

		return normalized;
	};

	const fetchRepliesPage = async (
		parentId: number,
		cursor: number | null,
	): Promise<{ ok: true; data: ReplyPageResponse } | { ok: false; error: string }> => {
		const qs = new URLSearchParams({
			parentId: String(parentId),
			limit: String(REPLIES_PAGE_SIZE),
		});
		if (cursor !== null) {
			qs.set('cursor', String(cursor));
		}

		const response = await fetch(`/api/post?${qs.toString()}`, { cache: 'no-store' });
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			return { ok: false, error: data?.error || 'Failed to load replies.' };
		}

		return {
			ok: true,
			data: {
				replies: Array.isArray(data?.replies) ? data.replies : [],
				nextCursor:
					typeof data?.nextCursor === 'number' ? data.nextCursor : null,
				hasMore: Boolean(data?.hasMore),
			},
		};
	};

	const loadMoreMainReplies = async () => {
		if (!mainPost || !mainRepliesHasMore || isLoadingMoreMainReplies) {
			return;
		}

		setIsLoadingMoreMainReplies(true);
		const result = await fetchRepliesPage(mainPost.id, mainRepliesNextCursor);
		setIsLoadingMoreMainReplies(false);

		if (!result.ok) {
			setReplyError(result.error);
			return;
		}

		setReplies((prev) => mergeUniquePosts(prev, result.data.replies));
		setMainRepliesNextCursor(result.data.nextCursor);
		setMainRepliesHasMore(result.data.hasMore);
	};

	const loadMoreMainHistory = async () => {
		if (!mainPost || !mainHistoryHasMore || isLoadingMainHistory) {
			return;
		}

		setIsLoadingMainHistory(true);
		setMainHistoryError('');
		try {
			const qs = new URLSearchParams({
				includeHistory: 'true',
				limit: String(HISTORY_PAGE_SIZE),
			});
			if (mainHistoryNextCursor !== null) {
				qs.set('cursor', String(mainHistoryNextCursor));
			}

			const response = await fetch(`/api/post/${mainPost.id}?${qs.toString()}`, {
				cache: 'no-store',
			});
			const data = await response.json().catch(() => null);

			if (!response.ok || !Array.isArray(data?.versions)) {
				setMainHistoryError(data?.error || 'Unable to load post history.');
				return;
			}

			setMainPostVersions((prev) => {
				const merged = [...prev, ...data.versions];
				const byVersion = new Map<number, PostVersion>();
				for (const item of merged) {
					const version = normalizeVersion(item.version);
					if (!byVersion.has(version)) {
						byVersion.set(version, {
							version,
							content: item.content,
							editedAt: item.editedAt,
						});
					}
				}
				return Array.from(byVersion.values()).sort((a, b) => a.version - b.version);
			});
			setMainHistoryNextCursor(
				typeof data?.nextCursor === 'number' ? data.nextCursor : null,
			);
			setMainHistoryHasMore(Boolean(data?.hasMore));
		} catch {
			setMainHistoryError('Unable to load post history.');
		} finally {
			setIsLoadingMainHistory(false);
		}
	};

	const toggleMainHistory = async () => {
		const next = !showMainHistory;
		setShowMainHistory(next);
		if (next && mainPostVersions.length <= 1 && mainHistoryHasMore) {
			await loadMoreMainHistory();
		}
	};

	const loadMorePollHistory = async () => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll || !pollHistoryHasMore || isLoadingPollHistory) {
			return;
		}

		setIsLoadingPollHistory(true);
		setPollHistoryError('');
		try {
			const qs = new URLSearchParams({
				includeHistory: 'true',
				limit: String(HISTORY_PAGE_SIZE),
			});
			if (pollHistoryNextCursor !== null) {
				qs.set('cursor', String(pollHistoryNextCursor));
			}

			const response = await fetch(`/api/poll/${poll.id}?${qs.toString()}`, {
				cache: 'no-store',
			});
			const data = await response.json().catch(() => null);
			if (!response.ok || !Array.isArray(data?.versions)) {
				setPollHistoryError(data?.error || 'Unable to load poll history.');
				return;
			}

			setPollVersions((prev) => {
				const merged = [...prev, ...data.versions];
				const byVersion = new Map<number, PollVersion>();
				for (const item of merged) {
					const version =
						typeof item?.version === 'number' && !Number.isNaN(item.version)
							? Math.max(1, Math.trunc(item.version))
							: 1;
					if (!byVersion.has(version)) {
						byVersion.set(version, {
							version,
							question: typeof item?.question === 'string' ? item.question : '',
							deadline: typeof item?.deadline === 'string' ? item.deadline : null,
							options: Array.isArray(item?.options)
								? item.options.filter((option: unknown): option is string => typeof option === 'string')
								: [],
							editedAt:
								typeof item?.editedAt === 'string'
									? item.editedAt
									: new Date().toISOString(),
						});
					}
				}
				return Array.from(byVersion.values()).sort((a, b) => b.version - a.version);
			});
			setPollHistoryNextCursor(
				typeof data?.nextCursor === 'number' ? data.nextCursor : null,
			);
			setPollHistoryHasMore(Boolean(data?.hasMore));
		} catch {
			setPollHistoryError('Unable to load poll history.');
		} finally {
			setIsLoadingPollHistory(false);
		}
	};

	const togglePollHistory = async () => {
		const next = !showPollHistory;
		setShowPollHistory(next);
		if (next && pollVersions.length <= 1 && pollHistoryHasMore) {
			await loadMorePollHistory();
		}
	};

	const loadNestedReplies = async (parentId: number, cursor: number | null) => {
		const result = await fetchRepliesPage(parentId, cursor);
		if (!result.ok) {
			return { ok: false, error: result.error, nextCursor: null, hasMore: false };
		}

		setReplies((prev) => mergeRepliesForParent(prev, parentId, result.data.replies));
		return {
			ok: true,
			error: '',
			nextCursor: result.data.nextCursor,
			hasMore: result.data.hasMore,
		};
	};

	const applyUserVoteLocally = (nextOptionId: number | null) => {
		if (!currentUserId) return;
		setThread((prev) => {
			if (!prev || !Array.isArray(prev.polls) || prev.polls.length === 0) return prev;
			const existingPoll = prev.polls[0];
			const updatedPoll = {
				...existingPoll,
				options: existingPoll.options.map((option) => {
					const withoutMine = option.votes.filter((vote) => vote.userId !== currentUserId);
					if (nextOptionId !== null && option.id === nextOptionId) {
						return {
							...option,
							votes: [...withoutMine, { id: Date.now(), userId: currentUserId }],
						};
					}
					return {
						...option,
						votes: withoutMine,
					};
				}),
			};
			return { ...prev, polls: [updatedPoll] };
		});
	};

	useEffect(() => {
		let isMounted = true;

		async function loadCurrentUser() {
			try {
				const response = await fetch('/api/user/me', { cache: 'no-store' });
				const data = await response.json().catch(() => null);
				if (!isMounted) return;
				if (response.ok && data?.id) {
					setCurrentUserId(data.id);
					setCurrentUserRole(data?.role === 'ADMIN' ? 'ADMIN' : 'USER');
					setCurrentUserBanned(Boolean(data?.isBanned));
				} else {
					setCurrentUserId(null);
					setCurrentUserRole(null);
					setCurrentUserBanned(false);
				}
			} catch {
				if (!isMounted) return;
				setCurrentUserId(null);
				setCurrentUserRole(null);
				setCurrentUserBanned(false);
			}
		}

		async function loadThread() {
			setIsLoading(true);
			setError('');

			try {
				const threadRes = await fetch(`/api/threads/${threadId}`, {
					cache: 'no-store',
				});
				const threadData = await threadRes.json().catch(() => null);

				if (!threadRes.ok || !threadData?.id) {
					if (!isMounted) return;
					setError(threadData?.error || 'Unable to load thread.');
					setThread(null);
					setMainPost(null);
					setIsLoading(false);
					return;
				}

				if (!isMounted) return;
				setThread(threadData);
				setTagsDraft(Array.isArray(threadData?.tags) ? threadData.tags.map((t: any) => t.tag?.name).filter(Boolean) : []);
				setThreadTitleDraft(typeof threadData.title === 'string' ? threadData.title : '');
				setThreadActionError('');
				setThreadActionSuccess('');
				setPollError('');
				setPollSuccess('');

				const primaryPoll =
					Array.isArray(threadData.polls) && threadData.polls.length > 0
						? threadData.polls[0]
						: null;
				if (primaryPoll) {
					setPollQuestionDraft(typeof primaryPoll.question === 'string' ? primaryPoll.question : '');
					const deadlineDate = new Date(primaryPoll.deadline);
					setPollDeadlineDateDraft(
						Number.isNaN(deadlineDate.getTime())
							? ''
							: toLocalDateInputValue(deadlineDate),
					);
					setPollOptionsDraft(
						Array.isArray(primaryPoll.options) && primaryPoll.options.length > 0
							? primaryPoll.options.map((option: PollOption) => option.text)
							: ['', ''],
					);
					const currentPollVersion =
						typeof primaryPoll.version === 'number' && !Number.isNaN(primaryPoll.version)
							? Math.max(1, Math.trunc(primaryPoll.version))
							: 1;
					setPollVersions([
						{
							version: currentPollVersion,
							question: typeof primaryPoll.question === 'string' ? primaryPoll.question : '',
							deadline:
								typeof primaryPoll.deadline === 'string' ? primaryPoll.deadline : null,
							options:
								Array.isArray(primaryPoll.options) && primaryPoll.options.length > 0
									? primaryPoll.options.map((option: PollOption) => option.text)
									: [],
							editedAt:
								typeof primaryPoll.updatedAt === 'string'
									? primaryPoll.updatedAt
									: new Date().toISOString(),
						},
					]);
					setPollHistoryNextCursor(currentPollVersion);
					setPollHistoryHasMore(currentPollVersion > 1);
					setPollHistoryError('');
					setShowPollHistory(false);
				} else {
					setPollVersions([]);
					setPollHistoryNextCursor(null);
					setPollHistoryHasMore(false);
					setPollHistoryError('');
					setShowPollHistory(false);
				}

				const postRes = await fetch(
					`/api/post?id=${threadData.mainPostId}&includeReplies=false`,
					{ cache: 'no-store' },
				);
				const postData = await postRes.json().catch(() => null);

				if (!postRes.ok) {
					if (!isMounted) return;
					setError('Unable to load post.');
					setIsLoading(false);
					return;
				}

				if (!isMounted) return;
				setMainPost(postData);
				setTranslatedMainPostContent(null);
				setShowTranslatedMainPost(false);
				setTranslationError('');
				setReplies([]);
				setElevatedBranch(null);
				setShowMainReplies(true);
				setHasLoadedMainReplies(false);
				setMainRepliesNextCursor(null);
				setMainRepliesHasMore((postData.replyCount || 0) > 0);

				if ((postData.replyCount || 0) > 0) {
					const firstReplyPage = await fetchRepliesPage(postData.id, null);
					if (isMounted) {
						if (firstReplyPage.ok) {
							setReplies(firstReplyPage.data.replies);
							setMainRepliesNextCursor(firstReplyPage.data.nextCursor);
							setMainRepliesHasMore(firstReplyPage.data.hasMore);
							setHasLoadedMainReplies(true);
						} else {
							setReplyError(firstReplyPage.error);
						}
					}
				} else {
					setHasLoadedMainReplies(true);
				}

				const latestVersion = normalizeVersion(postData.version);
				setMainPostVersions([
					{
						version: latestVersion,
						content: postData.content,
						editedAt: postData.updatedAt || postData.createdAt,
					},
				]);
				setMainHistoryNextCursor(latestVersion);
				setMainHistoryHasMore(latestVersion > 1);
				setMainHistoryError('');
			} catch {
				if (!isMounted) return;
				setError('Unable to load thread right now.');
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		loadThread();
		loadCurrentUser();

		return () => {
			isMounted = false;
		};
	}, [threadId]);

// Load popular tags when editing tags
useEffect(() => {
	let mounted = true;
	if (!isEditingTags) return;
	(async function loadTags() {
		setTagLoadingThread(true);
		try {
			const res = await fetch('/api/tags?page=1&pageSize=50');
			const data = await res.json().catch(() => null);
			if (!mounted) return;
			setTagSuggestionsThread(Array.isArray(data?.items) ? data.items : []);
		} catch {
			// ignore
		} finally {
			if (mounted) setTagLoadingThread(false);
		}
	})();
	return () => { mounted = false; };
}, [isEditingTags]);

// Debounced live suggestions for tag input in thread editor
useEffect(() => {
	let mounted = true;
	const value = tagInputThread.trim();
	if (!value) {
		setLiveTagSuggestionsThread([]);
		setActiveTagSuggestionIndex(-1);
		return;
	}

	const controller = new AbortController();
	const t = setTimeout(async () => {
		try {
			const qs = new URLSearchParams({ q: value, page: '1', pageSize: '8' });
			const res = await fetch(`/api/tags?${qs.toString()}`, { signal: controller.signal, cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (!mounted) return;
			setLiveTagSuggestionsThread(Array.isArray(data?.items) ? data.items : []);
			setActiveTagSuggestionIndex(-1);
		} catch {
			if (!mounted) return;
			setLiveTagSuggestionsThread([]);
		}
	}, 220);

	return () => { mounted = false; controller.abort(); clearTimeout(t); };
}, [tagInputThread]);

useEffect(() => {
	setMainPostEditContent(mainPost?.content || '');
	setMainPostEditError('');
	setIsEditingMainPost(false);
}, [mainPost?.id, mainPost?.content]);

const saveTagsUpdate = async () => {
	if (!thread) return;
	setThreadActionError('');
	setThreadActionSuccess('');
	setIsSavingThreadAction(true);
	try {
		const response = await fetch(`/api/threads/${thread.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tags: tagsDraft }),
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			setThreadActionError(data?.error || 'Failed to update tags.');
			return;
		}

		// Reload thread detail
		const threadRes = await fetch(`/api/threads/${thread.id}`, { cache: 'no-store' });
		const threadData = await threadRes.json().catch(() => null);
		if (threadRes.ok && threadData?.id) {
			setThread(threadData);
			setTagsDraft(Array.isArray(threadData?.tags) ? threadData.tags.map((t: any) => t.tag?.name).filter(Boolean) : []);
			setIsEditingTags(false);
			setThreadActionSuccess('Tags updated.');
		} else {
			setThreadActionError('Updated but failed to reload thread.');
		}
	} catch (err) {
		setThreadActionError('Unable to update tags right now.');
	} finally {
		setIsSavingThreadAction(false);
	}
};

	useEffect(() => {
		let isMounted = true;

		async function loadPollVote() {
			const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
			if (!poll || !currentUserId || currentUserBanned) {
				if (isMounted) {
					setPollUserVoteOptionId(null);
				}
				return;
			}

			try {
				const response = await fetch(`/api/poll/${poll.id}/vote`, { cache: 'no-store' });
				const data = await response.json().catch(() => null);
				if (!isMounted) return;
				setPollUserVoteOptionId(
					typeof data?.userVote?.optionId === 'number' ? data.userVote.optionId : null,
				);
			} catch {
				if (!isMounted) return;
				setPollUserVoteOptionId(null);
			}
		}

		loadPollVote();

		return () => {
			isMounted = false;
		};
	}, [thread, currentUserId, currentUserBanned]);

	const castPollVote = async (optionId: number) => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll) return;
		if (currentUserBanned || currentUserId === null) {
			setPollError('You must be signed in and not banned to vote.');
			return;
		}

		setIsSubmittingPollVote(true);
		setPollSubmittingOptionId(optionId);
		setPollVoteAction('cast');
		setPollError('');
		setPollSuccess('');
		try {
			const response = await fetch(`/api/poll/${poll.id}/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ optionId }),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setPollError(data?.error || 'Failed to cast vote.');
				return;
			}

			setPollUserVoteOptionId(optionId);
			setPollSuccess('Vote recorded.');
			applyUserVoteLocally(optionId);
		} catch {
			setPollError('Failed to cast vote.');
		} finally {
			setIsSubmittingPollVote(false);
			setPollSubmittingOptionId(null);
			setPollVoteAction(null);
		}
	};

	const changePollVote = async (optionId: number) => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll) return;
		if (currentUserBanned || currentUserId === null) {
			setPollError('You must be signed in and not banned to vote.');
			return;
		}

		setIsSubmittingPollVote(true);
		setPollSubmittingOptionId(optionId);
		setPollVoteAction('change');
		setPollError('');
		setPollSuccess('');
		try {
			const response = await fetch(`/api/poll/${poll.id}/vote`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ optionId }),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setPollError(data?.error || 'Failed to change vote.');
				return;
			}

			setPollUserVoteOptionId(optionId);
			setPollSuccess('Vote updated.');
			applyUserVoteLocally(optionId);
		} catch {
			setPollError('Failed to change vote.');
		} finally {
			setIsSubmittingPollVote(false);
			setPollSubmittingOptionId(null);
			setPollVoteAction(null);
		}
	};

	const removePollVote = async () => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll || pollUserVoteOptionId === null) return;
		if (currentUserBanned || currentUserId === null) {
			setPollError('You must be signed in and not banned to vote.');
			return;
		}

		setIsSubmittingPollVote(true);
		setPollSubmittingOptionId(pollUserVoteOptionId);
		setPollVoteAction('remove');
		setPollError('');
		setPollSuccess('');
		try {
			const response = await fetch(`/api/poll/${poll.id}/vote`, {
				method: 'DELETE',
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setPollError(data?.error || 'Failed to remove vote.');
				return;
			}

			setPollUserVoteOptionId(null);
			setPollSuccess('Vote removed.');
			applyUserVoteLocally(null);
		} catch {
			setPollError('Failed to remove vote.');
		} finally {
			setIsSubmittingPollVote(false);
			setPollSubmittingOptionId(null);
			setPollVoteAction(null);
		}
	};

	const savePollUpdate = async () => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll) return;

		if (thread?.isClosed) {
			setPollError('Cannot edit poll for a closed thread.');
			return;
		}

		const normalizedOptions = pollOptionsDraft
			.map((option) => option.trim())
			.filter(Boolean);

		if (!pollQuestionDraft.trim()) {
			setPollError('Poll question is required.');
			return;
		}
		if (!pollDeadlineDateDraft.trim()) {
			setPollError('Poll deadline is required.');
			return;
		}
		const normalizedDeadlineIso = toEndOfDayIso(pollDeadlineDateDraft);
		if (!normalizedDeadlineIso) {
			setPollError('Poll deadline must be a valid date.');
			return;
		}
		if (new Date(normalizedDeadlineIso) <= new Date()) {
			setPollError('Poll deadline must be in the future.');
			return;
		}
		if (normalizedOptions.length < 2) {
			setPollError('At least two poll options are required.');
			return;
		}

		setIsSavingPoll(true);
		setPollError('');
		setPollSuccess('');
		try {
			const response = await fetch(`/api/poll/${poll.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: pollQuestionDraft.trim(),
					deadline: normalizedDeadlineIso,
					options: normalizedOptions,
				}),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setPollError(data?.error || 'Failed to update poll.');
				return;
			}

			setThread((prev) => {
				if (!prev || !Array.isArray(prev.polls) || prev.polls.length === 0) return prev;
				const existingPoll = prev.polls[0];
				const updatedPoll = {
					...existingPoll,
					question: data?.question ?? pollQuestionDraft.trim(),
					version:
						typeof data?.version === 'number' && !Number.isNaN(data.version)
							? Math.max(1, Math.trunc(data.version))
							: existingPoll.version,
					updatedAt:
						typeof data?.updatedAt === 'string'
							? data.updatedAt
							: existingPoll.updatedAt,
					isVisible:
						typeof data?.isVisible === 'boolean'
							? data.isVisible
							: existingPoll.isVisible,
					deadline:
						typeof data?.deadline === 'string'
							? data.deadline
							: normalizedDeadlineIso,
					options: Array.isArray(data?.options)
						? data.options.map((option: unknown) => {
							const o = option as PollOption;
							const votesCandidate = (o as unknown & { votes?: unknown }).votes;
							const votes = Array.isArray(votesCandidate) ? (votesCandidate as PollVote[]) : [];
							return {
								id: o.id,
								text: o.text,
								votes,
							};
						})
						: existingPoll.options,
				};
				return {
					...prev,
					title:
						typeof data?.thread?.title === 'string'
							? data.thread.title
							: prev.title,
					polls: [updatedPoll],
				};
			});
			const nextVersion =
				typeof data?.version === 'number' && !Number.isNaN(data.version)
					? Math.max(1, Math.trunc(data.version))
					: 1;
			setPollVersions([
				{
					version: nextVersion,
					question: typeof data?.question === 'string' ? data.question : pollQuestionDraft.trim(),
					deadline:
						typeof data?.deadline === 'string' ? data.deadline : normalizedDeadlineIso,
					options: normalizedOptions,
					editedAt:
						typeof data?.updatedAt === 'string'
							? data.updatedAt
							: new Date().toISOString(),
				},
			]);
			setPollHistoryNextCursor(nextVersion);
			setPollHistoryHasMore(nextVersion > 1);
			setPollHistoryError('');
			setShowPollHistory(false);
			setIsEditingPoll(false);
			setPollSuccess('Poll updated successfully.');
		} catch {
			setPollError('Failed to update poll.');
		} finally {
			setIsSavingPoll(false);
		}
	};

	const handlePollDelete = async () => {
		const poll = Array.isArray(thread?.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
		if (!poll) return { ok: false, error: 'Poll not found.' };
		if (!confirm('Delete this poll? This cannot be undone.')) return { ok: false, error: 'Cancelled' };

		setIsSavingPoll(true);
		try {
			const res = await fetch(`/api/poll/${poll.id}`, { method: 'DELETE' });
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setPollError(data?.error || 'Failed to delete poll.');
				return { ok: false, error: data?.error || 'Failed to delete poll.' };
			}
			setThread((prev) => (prev ? { ...prev, polls: [] } : prev));
			setPollSuccess('Poll deleted.');
			return { ok: true, error: '' };
		} catch (err) {
			setPollError('Unable to delete poll right now.');
			return { ok: false, error: 'Unable to delete poll right now.' };
		} finally {
			setIsSavingPoll(false);
		}
	};

	const submitReply = async (parentId: number, content: string) => {
		if (!content.trim() || !thread || !mainPost) {
			return { ok: false, error: 'Reply content is required.' };
		}

		const response = await fetch('/api/post', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: content.trim(),
				parentId,
				threadId: thread.id,
			}),
		});

		const data = await response.json().catch(() => null);
		if (!response.ok) {
			return { ok: false, error: data?.error || 'Failed to post reply.' };
		}

		if (data) {
			setReplies((prevReplies) => {
				if (parentId === mainPost.id) {
					return [...prevReplies, data];
				}
				return addReplyToTree(prevReplies, parentId, data);
			});
			setMainPost((prev) =>
				prev
					? {
							...prev,
							replyCount: (prev.replyCount || 0) + (parentId === mainPost.id ? 1 : 0),
					  }
					: prev,
			);
		}

		return { ok: true, error: '' };
	};

	const handleReplySubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!replyContent.trim() || !mainPost) return;

		setIsSubmittingReply(true);
		setReplyError('');
		try {
			const result = await submitReply(mainPost.id, replyContent);
			if (!result.ok) {
				setReplyError(result.error);
				return;
			}
			setReplyContent('');
		} catch {
			setReplyError('Unable to post reply right now');
		} finally {
			setIsSubmittingReply(false);
		}
	};

	const handleNestedReplySubmit = async (parentId: number, content: string) => {
		try {
			return await submitReply(parentId, content);
		} catch {
			return { ok: false, error: 'Unable to post reply right now' };
		}
	};

	const handleReplyEdit = async (postId: number, content: string) => {
		if (!content.trim()) {
			return { ok: false, error: 'Reply content cannot be empty.' };
		}

		try {
			const response = await fetch(`/api/post/${postId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: content.trim() }),
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				return { ok: false, error: data?.error || 'Failed to edit reply.' };
			}

			if (data) {
				setReplies((prevReplies) => updateReplyInTree(prevReplies, postId, data));
			}

			if (mainPost && mainPost.id === postId && data) {
				setMainPost((prev) =>
					prev
						? {
								...prev,
								...data,
								version: normalizeVersion(
									data.version,
									normalizeVersion(prev.version),
								),
						  }
						: prev,
				);
				const nextVersion = normalizeVersion(data.version, normalizeVersion(mainPost.version));
				setMainPostVersions((prev) => {
					const merged = [...prev, {
						version: nextVersion,
						content: data.content,
						editedAt: data.updatedAt || new Date().toISOString(),
					}];
					const byVersion = new Map<number, PostVersion>();
					for (const item of merged) {
						byVersion.set(normalizeVersion(item.version), {
							version: normalizeVersion(item.version),
							content: item.content,
							editedAt: item.editedAt,
						});
					}
					return Array.from(byVersion.values()).sort((a, b) => a.version - b.version);
				});
				setMainHistoryHasMore(nextVersion > 1);
				setMainHistoryNextCursor(nextVersion);
			}
			return { ok: true, error: '' };
		} catch {
			return { ok: false, error: 'Unable to edit reply right now.' };
		}
	};

	const handleMainPostEditSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!mainPost) return;
		if (thread?.isClosed) {
			setMainPostEditError('Thread is closed.');
			return;
		}
		if (!mainPostEditContent.trim()) {
			setMainPostEditError('Post content cannot be empty.');
			return;
		}

		setIsSavingMainPostEdit(true);
		setMainPostEditError('');
		const result = await handleReplyEdit(mainPost.id, mainPostEditContent);
		setIsSavingMainPostEdit(false);

		if (!result.ok) {
			setMainPostEditError(result.error);
			return;
		}

		setIsEditingMainPost(false);
		setShowTranslatedMainPost(false);
		setTranslatedMainPostContent(null);
	};

	const canManageThread =
		currentUserId !== null &&
		(thread?.createdById === currentUserId || currentUserRole === 'ADMIN');
	const isAdmin = currentUserRole === 'ADMIN';

	const router = useRouter();

	const handleThreadDelete = async () => {
		if (!thread) return { ok: false, error: 'Thread not loaded.' };
		if (!confirm('Delete this thread? This cannot be undone.')) return { ok: false, error: 'Cancelled' };

		setIsSavingThreadAction(true);
		try {
			const res = await fetch(`/api/threads/${thread.id}`, { method: 'DELETE' });
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setThreadActionError(data?.error || 'Failed to delete thread.');
				return { ok: false, error: data?.error || 'Failed to delete thread.' };
			}
			router.push('/forums');
			return { ok: true, error: '' };
		} catch (err) {
			setThreadActionError('Unable to delete thread right now.');
			return { ok: false, error: 'Unable to delete thread right now.' };
		} finally {
			setIsSavingThreadAction(false);
		}
	};

	const saveThreadUpdate = async (payload: { title?: string; isClosed?: boolean; isVisible?: boolean }) => {
		if (!thread) {
			return { ok: false, error: 'Thread not found.' };
		}

		setIsSavingThreadAction(true);
		setThreadActionError('');
		setThreadActionSuccess('');
		try {
			const response = await fetch(`/api/threads/${thread.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setThreadActionError(data?.error || 'Failed to update thread.');
				return { ok: false, error: data?.error || 'Failed to update thread.' };
			}

			setThread((prev) => (prev ? { ...prev, ...data } : prev));
			if (typeof data?.title === 'string') {
				setThreadTitleDraft(data.title);
			}
			setThreadActionSuccess('Thread updated.');
			return { ok: true, error: '' };
		} catch {
			setThreadActionError('Unable to update thread right now.');
			return { ok: false, error: 'Unable to update thread right now.' };
		} finally {
			setIsSavingThreadAction(false);
		}
	};

	const handleThreadTitleSave = async () => {
		if (!threadTitleDraft.trim()) {
			setThreadActionError('Thread title cannot be empty.');
			return;
		}
		const result = await saveThreadUpdate({ title: threadTitleDraft.trim() });
		if (result.ok) {
			setIsEditingThreadTitle(false);
		}
	};

	const handleThreadCloseToggle = async () => {
		if (!thread) return;
		await saveThreadUpdate({ isClosed: !Boolean(thread.isClosed) });
	};

	const handleThreadVisibilityToggle = async () => {
		if (!thread) return;
		await saveThreadUpdate({ isVisible: !Boolean(thread.isVisible) });
	};

	const handlePostVisibilityToggle = async (postId: number, nextVisible: boolean) => {
		if (!mainPost) {
			return { ok: false, error: 'Main post not loaded.' };
		}

		try {
			const response = await fetch(`/api/post/${postId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isVisible: nextVisible }),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				return { ok: false, error: data?.error || 'Failed to update post visibility.' };
			}

			if (mainPost.id === postId) {
				setMainPost((prev) => (prev ? { ...prev, ...data } : prev));
			} else {
				setReplies((prevReplies) => updateReplyInTree(prevReplies, postId, data));
			}

			return { ok: true, error: '' };
		} catch {
			return { ok: false, error: 'Unable to update post visibility right now.' };
		}
	};

	const handleReplyDelete = async (postId: number) => {
		if (!mainPost) {
			return { ok: false, error: 'Main post not loaded.' };
		}

		try {
			const response = await fetch(`/api/post/${postId}`, {
				method: 'DELETE',
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				return { ok: false, error: data?.error || 'Failed to delete reply.' };
			}

			const parentId = typeof data?.parentId === 'number' ? data.parentId : null;
			setReplies((prevReplies) => {
				let nextReplies = removeReplyFromTree(prevReplies, postId);
				if (parentId !== null && parentId !== mainPost.id) {
					nextReplies = decrementParentReplyCount(nextReplies, parentId);
				}
				return nextReplies;
			});

			if (parentId === mainPost.id) {
				setMainPost((prev) =>
					prev
						? {
								...prev,
								replyCount: Math.max(0, (prev.replyCount || 0) - 1),
						  }
						: prev,
				);
			}

			return { ok: true, error: '' };
		} catch {
			return { ok: false, error: 'Unable to delete reply right now.' };
		}
	};

	const handleTranslateMainPost = async () => {
		if (!mainPost) {
			return;
		}

		if (translatedMainPostContent && !showTranslatedMainPost) {
			setShowTranslatedMainPost(true);
			return;
		}

		setIsTranslatingMainPost(true);
		setTranslationError('');
		try {
			const response = await fetch(`/api/post/${mainPost.id}/translate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setTranslationError(data?.error || 'Failed to translate post.');
				return;
			}

			setTranslatedMainPostContent(
				typeof data?.translatedText === 'string' ? data.translatedText : null,
			);
			setShowTranslatedMainPost(true);
		} catch {
			setTranslationError('Unable to translate post right now.');
		} finally {
			setIsTranslatingMainPost(false);
		}
	};

	useEffect(() => {
		setTranslatedMainPostContent(null);
		setShowTranslatedMainPost(false);
		setTranslationError('');
	}, [mainPost?.content, mainPost?.version]);

	const handleToggleMainReplies = async () => {
		if (!mainPost) {
			return;
		}

		const next = !showMainReplies;
		setShowMainReplies(next);
		if (!next) {
			setElevatedBranch(null);
		}

		if (next && !hasLoadedMainReplies && (mainPost.replyCount || 0) > 0) {
			await loadInitialMainReplies();
		}
	};

	const loadInitialMainReplies = async () => {
		if (!mainPost || hasLoadedMainReplies || isLoadingInitialMainReplies) {
			return;
		}

		setIsLoadingInitialMainReplies(true);
		setReplyError('');
		const result = await fetchRepliesPage(mainPost.id, null);
		setIsLoadingInitialMainReplies(false);

		if (!result.ok) {
			setReplyError(result.error);
			return;
		}

		setReplies(result.data.replies);
		setMainRepliesNextCursor(result.data.nextCursor);
		setMainRepliesHasMore(result.data.hasMore);
		setHasLoadedMainReplies(true);
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-40 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				<div className="h-56 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
			</div>
		);
	}

	if (error || !thread || (!mainPost && !(Array.isArray(thread.polls) && thread.polls.length > 0))) {
		return (
			<section className="theme-danger-panel rounded-[2rem] p-5 sm:p-8">
				<h1 className="font-[family:var(--font-heading)] text-3xl uppercase">Error</h1>
				<p className="mt-3">{error || 'Thread not found.'}</p>
				<Link
					href="/forums"
					className="mt-6 inline-block rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
				>
					Back to Forums
				</Link>
			</section>
		);
	}

	const activePoll = Array.isArray(thread.polls) && thread.polls.length > 0 ? thread.polls[0] : null;
	const isPollThread = Boolean(activePoll);

	const availableMainVersions = mainPost ? getPostVersions(mainPost, mainPostVersions) : [];
	const latestMainVersion = mainPost ? normalizeVersion(mainPost.version) : 1;
	const mainHistoryVersions = [...availableMainVersions].sort((a, b) => b.version - a.version);
	const baseMainContent = mainPost?.content || '';
	const displayedMainContent =
		showTranslatedMainPost && translatedMainPostContent
			? translatedMainPostContent
			: baseMainContent;
	const mainAuthorId = mainPost ? getAuthorId(mainPost) : null;
	const canEditMainPost =
		mainPost !== null &&
		currentUserId !== null &&
		mainAuthorId === currentUserId;

	const threadContext =
		thread.match && thread.match.homeTeam && thread.match.awayTeam ? (
			<span className="inline-flex flex-wrap items-center gap-2">
				<ContextTeam
					name={thread.match.awayTeam.name}
					logoUrl={thread.match.awayTeam.logoUrl}
					href={`/teams/${thread.match.awayTeam.id}`}
				/>
				<span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] bg-[var(--card-inset)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
					vs
				</span>
				<ContextTeam
					name={thread.match.homeTeam.name}
					logoUrl={thread.match.homeTeam.logoUrl}
					href={`/teams/${thread.match.homeTeam.id}`}
				/>
				<Link
					href={`/matches/${thread.match.id}`}
					className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] bg-[var(--card-inset)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-[var(--accent-soft)]"
				>
					View Match
				</Link>
			</span>
		) : thread.team ? (
			<ContextTeam
				name={thread.team.name}
				logoUrl={thread.team.logoUrl}
				href={`/teams/${thread.team.id}`}
			/>
		) : (
			<span>General Discussion</span>
		);

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-8 shadow-[var(--shadow)] sm:p-10">
				<Link
					href="/forums"
					className="inline-block rounded-full border border-[color:color-mix(in_srgb,var(--accent)_80%,transparent)] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]"
				>
					← Back to Forums
				</Link>
				<h1 className="mt-6 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.03em] sm:text-5xl">
					{thread.title}
				</h1>
				{isEditingThreadTitle && canManageThread && !thread.isClosed && (
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<input
							type="text"
							value={threadTitleDraft}
							onChange={(e) => setThreadTitleDraft(e.target.value)}
							disabled={isSavingThreadAction}
							className="rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-2 text-sm theme-muted outline-none"
						/>
						<button
							type="button"
							onClick={handleThreadTitleSave}
							disabled={!threadTitleDraft.trim() || isSavingThreadAction}
							className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
						>
							Save title
						</button>
						<button
							type="button"
							onClick={() => {
								setIsEditingThreadTitle(false);
								setThreadTitleDraft(thread.title);
							}}
							className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
						>
							Cancel
						</button>
					</div>
				)}
				<p className="theme-muted mt-4 flex max-w-3xl flex-wrap items-center gap-2 text-base">
					{threadContext}
				</p>
				{/* Tags (styled like team badges) - editable for owners */}
				<div className="mt-3">
					{!isEditingTags ? (
						Array.isArray(thread.tags) && thread.tags.length > 0 ? (
							<div className="flex flex-wrap items-center gap-2">
								{thread.tags.map((t, idx) => (
									<Link
										key={`${t.tag.name}-${idx}`}
										href={`/forums?tags=${encodeURIComponent(t.tag.name)}`}
										className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-2 py-1 text-xs font-semibold transition hover:bg-[var(--card-soft)]"
									>
										{t.tag.name}
									</Link>
								))}
							</div>
						) : (
							<div className="text-xs theme-muted">No tags</div>
						)
					) : (
						<div>
							<div className="flex gap-2 relative">
								<input
									type="text"
									value={tagInputThread}
									onChange={(e) => setTagInputThread(e.target.value)}
									placeholder="Add a tag and press Enter"
									onKeyDown={(e) => {
										if (e.key === 'ArrowDown') {
											e.preventDefault();
											setActiveTagSuggestionIndex((i) => Math.min((liveTagSuggestionsThread.length ? liveTagSuggestionsThread.length : tagSuggestionsThread.slice(0,8).length) - 1, Math.max(0, i + 1)));
											return;
										}
										if (e.key === 'ArrowUp') {
											e.preventDefault();
											setActiveTagSuggestionIndex((i) => Math.max(-1, i - 1));
											return;
										}
										if (e.key === 'Enter') {
											e.preventDefault();
											const source = tagInputThread.trim();
											const suggestions = liveTagSuggestionsThread.length ? liveTagSuggestionsThread : tagSuggestionsThread.slice(0,8);
												if (activeTagSuggestionIndex >= 0 && suggestions[activeTagSuggestionIndex]) {
												const t = suggestions[activeTagSuggestionIndex].name;
												if (t && !tagsDraft.includes(t) && tagsDraft.length < 5) setTagsDraft(prev => [...prev, t]);
											} else if (source) {
												if (!tagsDraft.includes(source) && tagsDraft.length < 5) setTagsDraft(prev => [...prev, source]);
											}
											setTagInputThread('');
											setLiveTagSuggestionsThread([]);
											setActiveTagSuggestionIndex(-1);
										}
									}}
									className="w-full rounded-xl border border-[var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm"
								/>
								{((liveTagSuggestionsThread.length > 0) || (tagInputThread.trim() && tagSuggestionsThread.length > 0)) && (
									<div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-[color:var(--line)] bg-[var(--card)] shadow-[var(--shadow)]">
										<ul className="max-h-48 overflow-auto">
											{(liveTagSuggestionsThread.length ? liveTagSuggestionsThread : tagSuggestionsThread.slice(0,8)).map((s, idx) => (
												<li key={s.id}>
													<button
														type="button"
														onMouseDown={(ev) => ev.preventDefault()}
														onClick={() => {
															if (!tagsDraft.includes(s.name) && tagsDraft.length < 5) setTagsDraft(prev => [...prev, s.name]);
															setTagInputThread('');
															setLiveTagSuggestionsThread([]);
															setActiveTagSuggestionIndex(-1);
														}}
														className={`block w-full px-3 py-2 text-left text-sm ${activeTagSuggestionIndex === idx ? 'bg-[var(--card-soft)]' : ''}`}
													>
														{s.name}
													</button>
												</li>
											))}
										</ul>
									</div>
								)}
								<button
									type="button"
									onClick={() => {
										const t = tagInputThread.trim();
										if (t && !tagsDraft.includes(t) && tagsDraft.length < 5) setTagsDraft(prev => [...prev, t]);
										setTagInputThread('');
									}}
									className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black"
								>
									Add
								</button>
							</div>
							<div className="flex flex-wrap gap-2 mt-2">
								{tagsDraft.map((t) => (
									<span key={t} className="rounded-full border px-3 py-1 text-sm bg-[var(--card)]">{t}
										<button type="button" onClick={() => setTagsDraft(prev => prev.filter(x => x !== t))} className="ml-2 text-xs">×</button>
									</span>
								))}
							</div>
							<div className="mt-1 text-xs text-[var(--muted)]">{tagsDraft.length} / 5 tags</div>
							<div className="mt-2 flex gap-2">
								<button type="button" onClick={saveTagsUpdate} disabled={isSavingThreadAction} className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black">Save Tags</button>
								<button type="button" onClick={() => { setIsEditingTags(false); setTagsDraft(Array.isArray(thread.tags) ? thread.tags.map((t:any) => t.tag?.name).filter(Boolean) : []); }} className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-xs theme-muted">Cancel</button>
							</div>
						</div>
					)}
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{canManageThread && !thread.isClosed && (
						<>
							<button
								type="button"
								onClick={() => setIsEditingThreadTitle((prev) => !prev)}
								disabled={isSavingThreadAction}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
							>
								{isEditingThreadTitle ? 'Cancel Edit Title' : 'Edit Thread Title'}
							</button>
							<button
								type="button"
								onClick={() => { setIsEditingTags((v) => !v); setThreadActionError(''); setThreadActionSuccess(''); }}
								disabled={isSavingThreadAction}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
							>
								{isEditingTags ? 'Cancel Edit Tags' : 'Edit Tags'}
							</button>
						</>
					)}
					{canManageThread && (
						<>
							<button
								type="button"
								onClick={handleThreadCloseToggle}
								disabled={isSavingThreadAction}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
							>
								{thread.isClosed ? 'Reopen Thread' : 'Close Thread'}
							</button>

							<button
								type="button"
								onClick={handleThreadDelete}
								disabled={isSavingThreadAction}
								className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
							>
								Delete Thread
							</button>
						</>
					)}
					{isAdmin && (
						<button
							type="button"
							onClick={handleThreadVisibilityToggle}
							disabled={isSavingThreadAction}
							className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
						>
							{thread.isVisible === false ? 'Set Thread Visible' : 'Hide Thread'}
						</button>
					)}
					<ReportAction
						target={{ kind: 'thread', id: thread.id }}
						translationPostId={mainPost?.id ?? null}
						variant="grouped"
					/>
					{thread.isClosed && (
						<span className="theme-warning-panel rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
							Thread Closed
						</span>
					)}
					{thread.isVisible === false && (
						<span className="theme-danger-panel rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
							Thread Hidden
						</span>
					)}
				</div>
				{threadActionError && <p className="theme-danger mt-2 text-xs">{threadActionError}</p>}
				{threadActionSuccess && <p className="mt-2 text-xs text-emerald-300">{threadActionSuccess}</p>}
			</section>

			{isPollThread && activePoll && (
				<section className="theme-card rounded-[2rem] p-5 sm:p-8">
					<div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] theme-muted">Poll</p>
							<h2 className="mt-2 font-[family:var(--font-heading)] text-2xl uppercase tracking-[-0.02em]">
								{activePoll.question}
							</h2>
							<p className="theme-muted mt-2 text-xs">Ends {new Date(activePoll.deadline).toLocaleString()}</p>
							<div className="mt-3 flex flex-wrap items-center gap-3">
								<div className="shrink-0">
									{getPollCreatorId(activePoll) ? (
										<Link
											href={`/profile/${getPollCreatorId(activePoll)}`}
											className="block transition hover:opacity-85"
										>
											<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)]">
												{getPollCreatorAvatar(activePoll) ? (
													<Image
														src={getPollCreatorAvatar(activePoll) as string}
														alt={getPollCreatorName(activePoll)}
														width={40}
														height={40}
														className="h-full w-full object-cover"
													/>
												) : (
													<span className="theme-muted text-sm font-semibold">
														{getPollCreatorInitial(activePoll)}
													</span>
												)}
											</div>
										</Link>
									) : (
										<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)]">
											{getPollCreatorAvatar(activePoll) ? (
												<Image
													src={getPollCreatorAvatar(activePoll) as string}
													alt={getPollCreatorName(activePoll)}
													width={40}
													height={40}
													className="h-full w-full object-cover"
												/>
											) : (
												<span className="theme-muted text-sm font-semibold">
													{getPollCreatorInitial(activePoll)}
												</span>
											)}
										</div>
									)}
								</div>
								<div className="min-w-0">
									<p className="theme-muted text-[11px] uppercase tracking-[0.18em]">
										Created By
									</p>
									{getPollCreatorId(activePoll) ? (
										<Link
											href={`/profile/${getPollCreatorId(activePoll)}`}
											className="mt-1 block text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--accent-soft)]"
										>
											{getPollCreatorName(activePoll)}
										</Link>
									) : (
										<p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
											{getPollCreatorName(activePoll)}
										</p>
									)}
								</div>
							</div>
						</div>
						{(currentUserRole === 'ADMIN' || activePoll.createdById === currentUserId) && !thread?.isClosed && (
							<button
								type="button"
								onClick={() => {
									setIsEditingPoll((prev) => !prev);
									setPollError('');
									setPollSuccess('');
								}}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
							>
								{isEditingPoll ? 'Cancel Edit' : 'Edit Poll'}
							</button>
						)}
					</div>

					<div className="mb-4 flex flex-wrap items-center gap-2">
						{activePoll.version > 1 && (
							<button
								type="button"
								onClick={togglePollHistory}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
							>
								{showPollHistory ? 'Hide History' : 'View History'}
							</button>
						)}
						<ReportAction target={{ kind: 'poll', id: activePoll.id }} variant="grouped" />
						{activePoll.isVisible === false && (
							<span className="theme-danger-panel rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
								Poll Hidden
							</span>
						)}
					</div>

					{showPollHistory && (
						<div className="mb-4 rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] p-3">
							{isLoadingPollHistory && (
								<p className="theme-muted text-xs">Loading edit history...</p>
							)}
							{pollHistoryError && (
								<p className="theme-danger text-xs">{pollHistoryError}</p>
							)}
							{!isLoadingPollHistory && !pollHistoryError && pollVersions.length <= 1 && (
								<p className="theme-muted text-xs">No previous edits.</p>
							)}
							{pollVersions.length > 0 && (
								<ul className="space-y-2">
									{pollVersions.map((versionItem) => (
										<li
											key={`${activePoll.id}-v-${versionItem.version}`}
											className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] p-2"
										>
											<p className="theme-muted text-xs">
												Version {versionItem.version} • {new Date(versionItem.editedAt).toLocaleString()}
											</p>
											<p className="mt-1 text-xs font-semibold text-[var(--foreground)]">
												{versionItem.question}
											</p>
											{versionItem.options.length > 0 && (
												<p className="theme-muted mt-1 whitespace-pre-wrap text-xs leading-5">
													Options: {versionItem.options.join(' | ')}
												</p>
											)}
											{versionItem.deadline && (
												<p className="theme-muted mt-1 text-xs">
													Deadline: {new Date(versionItem.deadline).toLocaleString()}
												</p>
											)}
										</li>
									))}
								</ul>
							)}
							{pollHistoryHasMore && (
								<button
									type="button"
									onClick={loadMorePollHistory}
									disabled={isLoadingPollHistory}
									className="mt-3 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
								>
									{isLoadingPollHistory ? 'Loading...' : 'See more history'}
								</button>
							)}
						</div>
					)}

					{isEditingPoll && (
						<div className="space-y-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
							<input
								type="text"
								value={pollQuestionDraft}
								onChange={(e) => setPollQuestionDraft(e.target.value)}
								className="theme-input w-full rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
							/>
							<input
								type="date"
								value={pollDeadlineDateDraft}
								onChange={(e) => setPollDeadlineDateDraft(e.target.value)}
								min={toLocalDateInputValue(new Date())}
								className="theme-input w-full rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
							/>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setPollDeadlineDateDraft(localDatePlusDays(1))}
									className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
								>
									Tomorrow
								</button>
								<button
									type="button"
									onClick={() => setPollDeadlineDateDraft(localDatePlusDays(3))}
									className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
								>
									In 3 days
								</button>
								<button
									type="button"
									onClick={() => setPollDeadlineDateDraft(localDatePlusDays(7))}
									className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
								>
									In 1 week
								</button>
							</div>
							<p className="theme-muted text-xs">Polls close at 11:59 PM local time on the selected date.</p>
							{pollOptionsDraft.map((option, index) => (
								<div key={`poll-edit-${index}`} className="flex items-center gap-2">
									<input
										type="text"
										value={option}
										onChange={(e) =>
											setPollOptionsDraft((prev) =>
												prev.map((value, i) => (i === index ? e.target.value : value)),
											)
										}
										className="theme-input w-full rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
									/>
									{pollOptionsDraft.length > 2 && (
										<button
											type="button"
											onClick={() =>
												setPollOptionsDraft((prev) => prev.filter((_, i) => i !== index))
											}
											className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
										>
											Remove
										</button>
									)}
								</div>
							))}
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setPollOptionsDraft((prev) => [...prev, ''])}
									disabled={pollOptionsDraft.length >= 6}
									className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
								>
									Add Option
								</button>
								<button
									type="button"
									onClick={savePollUpdate}
									disabled={isSavingPoll}
									className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
								>
									{isSavingPoll ? 'Saving...' : 'Save Poll'}
								</button>
								{(isAdmin || currentUserId === activePoll.createdById) && !thread?.isClosed && (
									<button
										type="button"
										onClick={handlePollDelete}
										disabled={isSavingPoll}
										className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
									>
										Delete Poll
									</button>
								)}
							</div>
						</div>
					)}

					{(() => {
						const totalVotes = activePoll.options.reduce((sum, option) => sum + option.votes.length, 0);
						const isExpired = new Date(activePoll.deadline) <= new Date();
						const canInteract = !isExpired && !thread?.isClosed && currentUserId !== null && !currentUserBanned;

						return (
							<div className="space-y-3">
								{activePoll.options.map((option) => {
									const count = option.votes.length;
									const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
									const isChosen = pollUserVoteOptionId === option.id;
									const isPendingThisOption =
										isSubmittingPollVote && pollSubmittingOptionId === option.id;
									const voteLabel =
										pollUserVoteOptionId === null
											? isPendingThisOption && pollVoteAction === 'cast'
												? 'Submitting...'
												: 'Vote'
											: isChosen
												? 'Your Vote'
												: isPendingThisOption && pollVoteAction === 'change'
													? 'Submitting...'
													: 'Change Vote';
									return (
										<div
											key={option.id}
											className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-3"
										>
											<div className="flex items-center justify-between gap-3 text-sm">
												<p className="font-semibold text-[var(--foreground)]">{option.text}</p>
												<span className="theme-muted text-xs">{count} votes ({percent}%)</span>
											</div>
											<div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--card-soft)]">
												<div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
											</div>
											{canInteract ? (
												<button
													type="button"
													onClick={() =>
														pollUserVoteOptionId === null
															? castPollVote(option.id)
															: isChosen
																? undefined
																: changePollVote(option.id)
													}
													disabled={
														isSubmittingPollVote ||
														(pollUserVoteOptionId !== null && isChosen)
													}
													className="mt-3 rounded-lg border border-[color:var(--line)] bg-[var(--card)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
												>
													{voteLabel}
												</button>
											) : isChosen ? (
												<span className="mt-3 inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] bg-[var(--card)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
													Your Vote
												</span>
											) : null}
										</div>
									);
								})}
								{canInteract && pollUserVoteOptionId !== null && (
									<button
										type="button"
										onClick={removePollVote}
										disabled={isSubmittingPollVote}
										className="rounded-lg border border-[color:var(--line)] bg-[var(--card)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
									>
										{isSubmittingPollVote && pollVoteAction === 'remove' ? 'Removing...' : 'Remove Vote'}
									</button>
								)}
								<p className="theme-muted text-xs">
									Total votes: {totalVotes}
									{isExpired ? ' • Poll has ended' : ''}
									{currentUserId === null ? ' • Sign in to vote' : ''}
									{currentUserBanned ? ' • Banned users cannot vote' : ''}
								</p>
							</div>
						);
					})()}

					{pollError && <p className="theme-danger text-xs">{pollError}</p>}
					{pollSuccess && <p className="text-xs text-emerald-300">{pollSuccess}</p>}
				</section>
			)}

			{mainPost && (
			<>
			{!isPollThread && (
			<section className="theme-card rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 sm:flex-row">
					<div className="shrink-0">
						{mainAuthorId ? (
							<Link
								href={`/profile/${mainAuthorId}`}
								className="block transition hover:opacity-85"
							>
								<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)]">
									{getAuthorAvatar(mainPost) ? (
										<Image
											src={getAuthorAvatar(mainPost) as string}
											alt={getAuthorName(mainPost)}
											width={48}
											height={48}
											className="h-full w-full object-cover"
										/>
									) : (
										<span className="theme-muted text-sm font-semibold">
											{getAuthorInitial(mainPost)}
										</span>
									)}
								</div>
							</Link>
						) : (
							<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)]">
								{getAuthorAvatar(mainPost) ? (
									<Image
										src={getAuthorAvatar(mainPost) as string}
										alt={getAuthorName(mainPost)}
										width={48}
										height={48}
										className="h-full w-full object-cover"
									/>
								) : (
									<span className="theme-muted text-sm font-semibold">
										{getAuthorInitial(mainPost)}
									</span>
								)}
							</div>
						)}
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-baseline gap-2">
							{mainAuthorId ? (
								<Link
									href={`/profile/${mainAuthorId}`}
									className="font-[family:var(--font-heading)] text-lg font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)] transition hover:text-[var(--accent-soft)]"
								>
									{getAuthorName(mainPost)}
								</Link>
							) : (
								<p className="font-[family:var(--font-heading)] text-lg font-semibold uppercase tracking-[-0.02em]">
									{getAuthorName(mainPost)}
								</p>
							)}
							<span className="theme-muted text-xs">
								{new Date(mainPost.createdAt).toLocaleDateString()} at{' '}
								{new Date(mainPost.createdAt).toLocaleTimeString()}
							</span>
						</div>

						{isEditingMainPost ? (
							<form onSubmit={handleMainPostEditSubmit} className="mt-2 space-y-2">
								<textarea
									value={mainPostEditContent}
									onChange={(e) => setMainPostEditContent(e.target.value)}
									rows={5}
									disabled={isSavingMainPostEdit || thread.isClosed}
									className="w-full rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2 text-sm theme-muted outline-none"
								/>
								{mainPostEditError && (
									<p className="theme-danger text-xs">{mainPostEditError}</p>
								)}
								<div className="flex items-center gap-2">
									<button
										type="submit"
										disabled={
											!mainPostEditContent.trim() ||
											isSavingMainPostEdit ||
											thread.isClosed
										}
										className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
									>
										{isSavingMainPostEdit ? 'Saving...' : 'Save'}
									</button>
									<button
										type="button"
										onClick={() => {
											setIsEditingMainPost(false);
											setMainPostEditContent(mainPost.content);
											setMainPostEditError('');
										}}
										className="px-1 py-1 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
									>
										Cancel
									</button>
								</div>
							</form>
						) : (
							<p className="theme-muted mt-2 whitespace-pre-wrap text-sm leading-6">
								{displayedMainContent}
							</p>
						)}

						{mainHistoryError && <p className="theme-danger mt-2 text-xs">{mainHistoryError}</p>}

						{mainPost.isVisible === false && (
							<p className="theme-danger mt-2 text-xs">This post is currently hidden.</p>
						)}

						<div className="mt-3 flex flex-wrap items-center gap-2">
							{!thread.isClosed && canEditMainPost && !isEditingMainPost && (
								<button
									type="button"
									onClick={() => {
										setIsEditingMainPost(true);
										setMainPostEditContent(mainPost.content);
										setMainPostEditError('');
									}}
									className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
								>
									Edit
								</button>
							)}
							<button
								type="button"
								onClick={handleTranslateMainPost}
								disabled={isTranslatingMainPost}
								className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
							>
								{isTranslatingMainPost
									? 'Translating...'
									: showTranslatedMainPost
										? 'Re-translate to English'
										: 'Translate to English'}
							</button>
							{showTranslatedMainPost && (
								<button
									type="button"
									onClick={() => setShowTranslatedMainPost(false)}
									className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
								>
									Show original
								</button>
							)}
							{latestMainVersion > 1 && (
								<button
									type="button"
									onClick={toggleMainHistory}
									className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
								>
									{showMainHistory ? 'Hide History' : 'View History'}
								</button>
							)}
							{isAdmin && (
								<button
									type="button"
									onClick={async () => {
										setReplyError('');
										const result = await handlePostVisibilityToggle(
											mainPost.id,
											!(mainPost.isVisible ?? true),
										);
										if (!result.ok) {
											setReplyError(result.error);
										}
									}}
									className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
								>
									{mainPost.isVisible === false ? 'Set Post Visible' : 'Hide Post'}
								</button>
							)}
							<ReportAction
								target={{ kind: 'post', id: mainPost.id }}
								translationPostId={mainPost.id}
								variant="grouped"
							/>
						</div>
						{mainPostEditError && !isEditingMainPost && (
							<p className="theme-danger mt-2 text-xs">{mainPostEditError}</p>
						)}
						{translationError && <p className="theme-danger mt-2 text-xs">{translationError}</p>}
						{showMainHistory && (
							<div className="mt-3 rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] p-3">
								{isLoadingMainHistory && (
									<p className="theme-muted text-xs">Loading edit history...</p>
								)}
								{mainHistoryError && (
									<p className="theme-danger text-xs">{mainHistoryError}</p>
								)}
								{!isLoadingMainHistory &&
									!mainHistoryError &&
									mainHistoryVersions.length <= 1 && (
										<p className="theme-muted text-xs">No previous edits.</p>
									)}
								{mainHistoryVersions.length > 0 && (
									<ul className="space-y-2">
										{mainHistoryVersions.map((versionItem) => (
											<li
												key={`${mainPost.id}-v-${versionItem.version}`}
												className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] p-2"
											>
												<p className="theme-muted text-xs">
													Version {versionItem.version} •{' '}
													{new Date(versionItem.editedAt).toLocaleString()}
												</p>
												<p className="theme-muted mt-1 whitespace-pre-wrap text-xs leading-5">
													{versionItem.content}
												</p>
											</li>
										))}
									</ul>
								)}
								{mainHistoryHasMore && (
									<button
										type="button"
										onClick={loadMoreMainHistory}
										disabled={isLoadingMainHistory}
										className="mt-3 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
									>
										{isLoadingMainHistory ? 'Loading...' : 'See more history'}
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			</section>
			)}

			<section className="theme-card rounded-[2rem] p-5 sm:p-8">
				<div className="mb-6">
					<p className="text-xs uppercase tracking-[0.18em] theme-muted">Contribute</p>
					<h2 className="mt-2 font-[family:var(--font-heading)] text-2xl uppercase tracking-[-0.02em]">
						{isPollThread ? 'Comment on Poll' : 'Reply to Thread'}
					</h2>
				</div>

				{replyError && !currentUserBanned && (
					<div className="theme-danger-panel mb-4 rounded-2xl px-4 py-3 text-sm">
						{replyError}
					</div>
				)}

				{currentUserBanned ? (
					<div className="theme-danger-panel rounded-2xl px-4 py-4 text-sm">
						<p className="font-semibold">You are banned from contributing.</p>
						<p className="mt-2 opacity-80">
							Submit an appeal to request a review of your ban before posting again.
						</p>
						<Link
							href="/appeal"
							className="theme-danger-panel mt-3 inline-block rounded-lg px-3 py-1 text-xs font-semibold transition hover:opacity-90"
						>
							Go to Appeal
						</Link>
					</div>
				) : (
					<form onSubmit={handleReplySubmit} className="space-y-4">
						<textarea
							value={replyContent}
							onChange={(e) => setReplyContent(e.target.value)}
							placeholder={isPollThread ? 'Share your thoughts on this poll...' : 'Share your thoughts on this thread...'}
							className="w-full rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-3 text-sm theme-muted placeholder-[var(--foreground)]/40 outline-none resize-none"
							rows={5}
							disabled={isSubmittingReply || Boolean(thread.isClosed)}
						/>
						{thread.isClosed && (
							<p className="text-xs text-[var(--badge-neutral-text)]">This thread is closed. New replies are disabled.</p>
						)}
						<button
							type="submit"
							disabled={!replyContent.trim() || isSubmittingReply || Boolean(thread.isClosed)}
							className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmittingReply ? 'Posting...' : isPollThread ? 'Post Comment' : 'Post Reply'}
						</button>
					</form>
				)}
			</section>

			{(mainPost.replyCount || 0) > 0 && (
				<section className="theme-card rounded-[2rem] p-5 sm:p-8">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.18em] theme-muted">{isPollThread ? 'Comments' : 'Replies'}</p>
							<h2 className="mt-2 font-[family:var(--font-heading)] text-2xl uppercase tracking-[-0.02em]">
								{mainPost.replyCount} {mainPost.replyCount === 1 ? (isPollThread ? 'Comment' : 'Reply') : (isPollThread ? 'Comments' : 'Replies')}
							</h2>
						</div>
						<button
							type="button"
							onClick={handleToggleMainReplies}
							className="rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
						>
							{showMainReplies ? 'Hide replies' : 'View replies'}
						</button>
					</div>

					{showMainReplies && (
						<>
							{elevatedBranch && (
								<div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
									<div className="flex items-center justify-between gap-3">
										<p className="theme-muted text-xs">
											Continued thread from {elevatedBranch.rootAuthor}
										</p>
										<button
											type="button"
											onClick={() => setElevatedBranch(null)}
											className="rounded-lg border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card)]"
										>
											Back to main layer
										</button>
									</div>
									<div className="mt-4 space-y-4">
										{elevatedBranch.replies.map((reply) => (
											<ReplyItem
												key={`elevated-${reply.id}`}
												reply={reply}
												depth={0}
												currentUserId={currentUserId}
												onReplySubmit={handleNestedReplySubmit}
												onReplyEdit={handleReplyEdit}
												onLoadReplies={loadNestedReplies}
												normalizeVersion={normalizeVersion}
												onPromoteBranch={setElevatedBranch}
												currentUserRole={currentUserRole}
												isThreadClosed={Boolean(thread.isClosed)}
												onReplyDelete={handleReplyDelete}
												onPostVisibilityToggle={handlePostVisibilityToggle}
											/>
										))}
									</div>
								</div>
							)}

							{!elevatedBranch && isLoadingInitialMainReplies ? (
								<p className="theme-muted mt-5 text-sm">Loading replies...</p>
							) : !elevatedBranch ? (
								<div className="mt-5 space-y-4">
									{replies.map((reply) => (
										<ReplyItem
											key={reply.id}
											reply={reply}
											depth={0}
											currentUserId={currentUserId}
											onReplySubmit={handleNestedReplySubmit}
											onReplyEdit={handleReplyEdit}
											onLoadReplies={loadNestedReplies}
											normalizeVersion={normalizeVersion}
											onPromoteBranch={setElevatedBranch}
											currentUserRole={currentUserRole}
											isThreadClosed={Boolean(thread.isClosed)}
											onReplyDelete={handleReplyDelete}
											onPostVisibilityToggle={handlePostVisibilityToggle}
										/>
									))}
								</div>
							) : null}

							{mainRepliesHasMore && (
								<div className="mt-5">
									<button
										type="button"
										onClick={loadMoreMainReplies}
										disabled={isLoadingMoreMainReplies}
										className="rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
									>
										{isLoadingMoreMainReplies ? 'Loading...' : 'See more replies'}
									</button>
								</div>
							)}
						</>
					)}
				</section>
			)}

			{(mainPost.replyCount || 0) === 0 && (
				<section className="theme-card rounded-[2rem] p-5 sm:p-8">
					<div className="rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-12 text-center">
						<p className="font-[family:var(--font-heading)] text-xl uppercase text-[var(--foreground)]">
							{isPollThread ? 'No Comments Yet' : 'No Replies Yet'}
						</p>
						<p className="theme-muted mt-3 text-sm">{isPollThread ? 'Be the first to comment on this poll.' : 'Be the first to reply to this thread.'}</p>
					</div>
				</section>
			)}
			</>
			)}
		</div>
	);
}

function ReportAction({
	target,
	translationPostId = null,
	variant = 'plain',
}: {
	target: ReportTarget;
	translationPostId?: number | null;
	variant?: 'plain' | 'grouped';
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [reason, setReason] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const endpoint =
		target.kind === 'thread'
			? `/api/threads/${target.id}/report`
			: target.kind === 'poll'
				? `/api/poll/${target.id}/report`
				: `/api/post/${target.id}/report`;

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!reason.trim()) {
			setError('Please provide a reason.');
			return;
		}

		setIsSubmitting(true);
		setError('');
		setSuccess('');
		try {
			let translatedContent: string | null = null;
			if (translationPostId) {
				try {
					const translateResponse = await fetch(`/api/post/${translationPostId}/translate`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
					});
					const translateData = await translateResponse.json().catch(() => null);
					if (
						translateResponse.ok &&
						typeof translateData?.translatedText === 'string' &&
						translateData.translatedText.trim()
					) {
						translatedContent = translateData.translatedText.trim();
					}
				} catch {
					translatedContent = null;
				}
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: reason.trim(), translatedContent }),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setError(data?.error || 'Failed to submit report.');
				return;
			}

			setReason('');
			setIsOpen(false);
			setSuccess('Reported. Thank you.');
		} catch {
			setError('Failed to submit report.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-2">
			<button
				type="button"
				onClick={() => {
					setIsOpen((prev) => !prev);
					setError('');
					if (isOpen) {
						setSuccess('');
					}
				}}
				className={`text-xs transition ${
					variant === 'grouped'
						? 'rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 font-semibold text-[var(--accent)] hover:bg-[var(--card-soft)]'
						: ''
				} ${success ? 'text-emerald-300' : 'text-[var(--accent)] hover:text-[var(--accent-soft)]'}`}
			>
				{success
					? 'Reported'
						: isOpen
							? 'Cancel Report'
							: target.kind === 'thread'
								? 'Report Thread'
								: target.kind === 'poll'
									? 'Report Poll'
									: 'Report Post'}
			</button>

			{isOpen && (
				<form onSubmit={handleSubmit} className="space-y-2">
					<textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						rows={2}
						placeholder="Why are you reporting this?"
						disabled={isSubmitting}
						className="w-full rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2 text-xs theme-muted outline-none"
					/>
					<button
						type="submit"
						disabled={!reason.trim() || isSubmitting}
						className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
					>
						{isSubmitting ? 'Reporting...' : 'Submit Report'}
					</button>
				</form>
			)}

			{error && <p className="theme-danger text-xs">{error}</p>}
			{success && <p className="text-xs theme-muted">Thank you for the report.</p>}
		</div>
	);
}

function ReplyItem({
	reply,
	depth,
	currentUserId,
	currentUserRole,
	isThreadClosed,
	onReplySubmit,
	onReplyEdit,
	onReplyDelete,
	onPostVisibilityToggle,
	onLoadReplies,
	normalizeVersion,
	onPromoteBranch,
}: {
	reply: Post;
	depth: number;
	currentUserId: number | null;
	currentUserRole: 'USER' | 'ADMIN' | null;
	isThreadClosed: boolean;
	onReplySubmit: (parentId: number, content: string) => Promise<{ ok: boolean; error: string }>;
	onReplyEdit: (postId: number, content: string) => Promise<{ ok: boolean; error: string }>;
	onReplyDelete: (postId: number) => Promise<{ ok: boolean; error: string }>;
	onPostVisibilityToggle: (
		postId: number,
		nextVisible: boolean,
	) => Promise<{ ok: boolean; error: string }>;
	onLoadReplies: (
		parentId: number,
		cursor: number | null,
	) => Promise<{ ok: boolean; error: string; nextCursor: number | null; hasMore: boolean }>;
	normalizeVersion: (version: unknown, fallback?: number) => number;
	onPromoteBranch: (branch: ElevatedBranch) => void;
}) {
	const [showReplies, setShowReplies] = useState(depth === 0);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [childReplyContent, setChildReplyContent] = useState('');
	const [isSubmittingChildReply, setIsSubmittingChildReply] = useState(false);
	const [childReplyError, setChildReplyError] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(reply.content);
	const [isSavingEdit, setIsSavingEdit] = useState(false);
	const [editError, setEditError] = useState('');
	const [showHistory, setShowHistory] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [historyError, setHistoryError] = useState('');
	const [historyVersions, setHistoryVersions] = useState<PostVersion[]>([]);
	const [historyNextCursor, setHistoryNextCursor] = useState<number | null>(
		normalizeVersion(reply.version),
	);
	const [historyHasMore, setHistoryHasMore] = useState(
		normalizeVersion(reply.version) > 1,
	);
	const [childRepliesNextCursor, setChildRepliesNextCursor] = useState<number | null>(null);
	const [childRepliesHasMore, setChildRepliesHasMore] = useState(
		(reply.replyCount || 0) > (reply.replies?.length || 0),
	);
	const [isLoadingChildReplies, setIsLoadingChildReplies] = useState(false);
	const [isDeletingReply, setIsDeletingReply] = useState(false);
	const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
	const [translatedReplyContent, setTranslatedReplyContent] = useState<string | null>(null);
	const [showTranslatedReply, setShowTranslatedReply] = useState(false);
	const [isTranslatingReply, setIsTranslatingReply] = useState(false);

	const displayName = reply.author?.username?.trim() || 'Unknown User';
	const displayAvatar = reply.author?.avatar || null;
	const displayAuthorId = reply.author?.id ?? reply.authorId ?? null;
	const displayInitial = displayName.charAt(0).toUpperCase();
	const canEdit = currentUserId !== null && reply.author?.id === currentUserId;
	const canDelete =
		currentUserId !== null &&
		(reply.author?.id === currentUserId || currentUserRole === 'ADMIN');
	const isAdmin = currentUserRole === 'ADMIN';
	const currentVersion = normalizeVersion(reply.version);
	const isDepthCapped = depth >= MAX_REPLY_DEPTH;

	useEffect(() => {
		setEditContent(reply.content);
	}, [reply.content]);

	useEffect(() => {
		setTranslatedReplyContent(null);
		setShowTranslatedReply(false);
		setChildReplyError('');
	}, [reply.content, reply.version]);

	useEffect(() => {
		setHistoryNextCursor(currentVersion);
		setHistoryHasMore(currentVersion > 1);
	}, [currentVersion]);

	useEffect(() => {
		setChildRepliesHasMore((reply.replyCount || 0) > (reply.replies?.length || 0));
	}, [reply.replyCount, reply.replies]);

	const loadHistory = async () => {
		if (!historyHasMore || isLoadingHistory) {
			return;
		}

		setIsLoadingHistory(true);
		setHistoryError('');
		try {
			const qs = new URLSearchParams({
				includeHistory: 'true',
				limit: String(5),
			});
			if (historyNextCursor !== null) {
				qs.set('cursor', String(historyNextCursor));
			}

			const response = await fetch(`/api/post/${reply.id}?${qs.toString()}`, {
				cache: 'no-store',
			});
			const data = await response.json().catch(() => null);
			if (!response.ok || !Array.isArray(data?.versions)) {
				setHistoryError(data?.error || 'Unable to load edit history.');
				return;
			}

			setHistoryVersions((prev) => {
				const merged = [...prev, ...data.versions];
				const byVersion = new Map<number, PostVersion>();
				for (const item of merged) {
					const v = normalizeVersion(item.version);
					if (!byVersion.has(v)) {
						byVersion.set(v, {
							version: v,
							content: item.content,
							editedAt: item.editedAt,
						});
					}
				}
				return Array.from(byVersion.values()).sort((a, b) => b.version - a.version);
			});

			setHistoryNextCursor(typeof data?.nextCursor === 'number' ? data.nextCursor : null);
			setHistoryHasMore(Boolean(data?.hasMore));
		} catch {
			setHistoryError('Unable to load edit history.');
		} finally {
			setIsLoadingHistory(false);
		}
	};

	const toggleHistory = async () => {
		const next = !showHistory;
		setShowHistory(next);
		if (next && historyVersions.length === 0 && historyHasMore) {
			await loadHistory();
		}
	};

	const loadMoreChildReplies = async () => {
		if (!childRepliesHasMore || isLoadingChildReplies) {
			return;
		}

		setIsLoadingChildReplies(true);
		setChildReplyError('');
		const result = await onLoadReplies(reply.id, childRepliesNextCursor);
		setIsLoadingChildReplies(false);

		if (!result.ok) {
			setChildReplyError(result.error);
			return;
		}

		setChildRepliesNextCursor(result.nextCursor);
		setChildRepliesHasMore(result.hasMore);
	};

	const toggleReplies = async () => {
		const next = !showReplies;
		setShowReplies(next);

		if (
			next &&
			(reply.replies?.length || 0) === 0 &&
			(reply.replyCount || 0) > 0 &&
			!isLoadingChildReplies
		) {
			await loadMoreChildReplies();
		}
	};

	const handleChildReplySubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (isThreadClosed) {
			setChildReplyError('Thread is closed.');
			return;
		}
		if (!childReplyContent.trim()) return;

		setIsSubmittingChildReply(true);
		setChildReplyError('');
		const result = await onReplySubmit(reply.id, childReplyContent);
		setIsSubmittingChildReply(false);

		if (!result.ok) {
			setChildReplyError(result.error);
			return;
		}

		setChildReplyContent('');
		setShowReplyForm(false);
		setShowReplies(true);
	};

	const handleEditSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (isThreadClosed) {
			setEditError('Thread is closed.');
			return;
		}
		if (!editContent.trim()) return;

		setIsSavingEdit(true);
		setEditError('');
		const result = await onReplyEdit(reply.id, editContent);
		setIsSavingEdit(false);

		if (!result.ok) {
			setEditError(result.error);
			return;
		}

		setIsEditing(false);
		setHistoryVersions([]);
		setHistoryNextCursor(currentVersion + 1);
		setHistoryHasMore(currentVersion > 1);
	};

	const handleDeleteReply = async () => {
		setIsDeletingReply(true);
		setChildReplyError('');
		const result = await onReplyDelete(reply.id);
		setIsDeletingReply(false);
		if (!result.ok) {
			setChildReplyError(result.error);
		}
	};

	const handleVisibilityToggle = async () => {
		setIsTogglingVisibility(true);
		setChildReplyError('');
		const result = await onPostVisibilityToggle(reply.id, !(reply.isVisible ?? true));
		setIsTogglingVisibility(false);
		if (!result.ok) {
			setChildReplyError(result.error);
		}
	};

	const handleTranslateReply = async () => {
		if (translatedReplyContent && !showTranslatedReply) {
			setShowTranslatedReply(true);
			return;
		}

		setIsTranslatingReply(true);
		setChildReplyError('');
		try {
			const response = await fetch(`/api/post/${reply.id}/translate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setChildReplyError(data?.error || 'Failed to translate reply.');
				return;
			}
			setTranslatedReplyContent(
				typeof data?.translatedText === 'string' ? data.translatedText : null,
			);
			setShowTranslatedReply(true);
		} catch {
			setChildReplyError('Unable to translate reply right now.');
		} finally {
			setIsTranslatingReply(false);
		}
	};

	return (
		<div className="space-y-3">
			<div className="flex gap-3 py-2">
					<div className="shrink-0">
						{displayAuthorId ? (
							<Link
								href={`/profile/${displayAuthorId}`}
								className="block transition hover:opacity-85"
							>
								<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)]">
									{displayAvatar ? (
										<Image
											src={displayAvatar}
											alt={displayName}
											width={40}
											height={40}
											className="h-full w-full object-cover"
										/>
									) : (
										<span className="theme-muted text-xs font-semibold">{displayInitial}</span>
									)}
								</div>
							</Link>
						) : (
							<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)]">
								{displayAvatar ? (
									<Image
										src={displayAvatar}
										alt={displayName}
										width={40}
										height={40}
										className="h-full w-full object-cover"
									/>
								) : (
									<span className="theme-muted text-xs font-semibold">{displayInitial}</span>
								)}
							</div>
						)}
					</div>

					<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-2">
						{displayAuthorId ? (
							<Link
								href={`/profile/${displayAuthorId}`}
								className="font-[family:var(--font-heading)] font-semibold uppercase tracking-[-0.01em] text-sm text-[var(--foreground)] transition hover:text-[var(--accent-soft)]"
							>
								{displayName}
							</Link>
						) : (
							<p className="font-[family:var(--font-heading)] font-semibold uppercase tracking-[-0.01em] text-sm">
								{displayName}
							</p>
						)}
						<span className="theme-muted text-xs">{new Date(reply.createdAt).toLocaleDateString()}</span>
						<span className="theme-muted text-xs">v{currentVersion}</span>
						{reply.isVisible === false && (
							<span className="theme-danger text-xs">Hidden</span>
						)}
					</div>

					{isEditing ? (
						<form onSubmit={handleEditSubmit} className="mt-2 space-y-2">
							<textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								rows={3}
								disabled={isSavingEdit || isThreadClosed}
								className="w-full rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2 text-sm theme-muted outline-none"
							/>
							{editError && <p className="theme-danger text-xs">{editError}</p>}
							<div className="flex items-center gap-2">
								<button
									type="submit"
									disabled={!editContent.trim() || isSavingEdit || isThreadClosed}
									className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
								>
									{isSavingEdit ? 'Saving...' : 'Save'}
								</button>
								<button
									type="button"
									onClick={() => {
										setIsEditing(false);
										setEditContent(reply.content);
										setEditError('');
									}}
									className="px-1 py-1 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
								>
									Cancel
								</button>
							</div>
						</form>
					) : (
						<p className="theme-muted mt-1 whitespace-pre-wrap text-sm leading-5">
							{showTranslatedReply && translatedReplyContent
								? translatedReplyContent
								: reply.content}
						</p>
					)}

					<div className="mt-2 flex flex-wrap items-center gap-3">
						{!isThreadClosed && (
							<button
								type="button"
								onClick={() => setShowReplyForm((prev) => !prev)}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
							>
								{showReplyForm ? 'Cancel Reply' : 'Reply'}
							</button>
						)}
						{!isThreadClosed && canEdit && !isEditing && (
							<button
								type="button"
								onClick={() => {
									setIsEditing(true);
									setEditContent(reply.content);
									setEditError('');
								}}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
							>
								Edit
							</button>
						)}
						{!isThreadClosed && canDelete && (
							<button
								type="button"
								onClick={handleDeleteReply}
								disabled={isDeletingReply}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
							>
								{isDeletingReply ? 'Deleting...' : 'Delete'}
							</button>
						)}
						{isAdmin && (
							<button
								type="button"
								onClick={handleVisibilityToggle}
								disabled={isTogglingVisibility}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
							>
								{isTogglingVisibility
									? 'Saving...'
									: reply.isVisible === false
										? 'Set Visible'
										: 'Hide Post'}
							</button>
						)}
						<button
							type="button"
							onClick={handleTranslateReply}
							disabled={isTranslatingReply}
							className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
						>
							{isTranslatingReply
								? 'Translating...'
								: showTranslatedReply
									? 'Re-translate'
									: 'Translate'}
						</button>
						{showTranslatedReply && (
							<button
								type="button"
								onClick={() => setShowTranslatedReply(false)}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
							>
								Show original
							</button>
						)}
						{currentVersion > 1 && (
							<button
								type="button"
								onClick={toggleHistory}
								className="text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
							>
								{showHistory ? 'Hide History' : 'View History'}
							</button>
						)}
					</div>

					{showHistory && (
						<div className="mt-3 rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] p-3">
							{isLoadingHistory && <p className="theme-muted text-xs">Loading edit history...</p>}
							{historyError && <p className="theme-danger text-xs">{historyError}</p>}
							{!isLoadingHistory && !historyError && historyVersions.length === 0 && (
								<p className="theme-muted text-xs">No previous edits.</p>
							)}
							{historyVersions.length > 0 && (
								<ul className="space-y-2">
									{historyVersions.map((versionItem) => (
										<li
											key={`${reply.id}-v-${versionItem.version}`}
											className="rounded-lg border border-[color:var(--line)] bg-[var(--card-inset)] p-2"
										>
											<p className="theme-muted text-xs">
												Version {versionItem.version} • {new Date(versionItem.editedAt).toLocaleString()}
											</p>
											<p className="theme-muted mt-1 whitespace-pre-wrap text-xs leading-5">
												{versionItem.content}
											</p>
										</li>
									))}
								</ul>
							)}
							{historyHasMore && (
								<button
									type="button"
									onClick={loadHistory}
									disabled={isLoadingHistory}
									className="mt-3 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
								>
									{isLoadingHistory ? 'Loading...' : 'See more history'}
								</button>
							)}
						</div>
					)}

					{showReplyForm && (
						<form onSubmit={handleChildReplySubmit} className="mt-3 space-y-2">
							<textarea
								value={childReplyContent}
								onChange={(e) => setChildReplyContent(e.target.value)}
								placeholder="Reply to this comment..."
								rows={3}
								disabled={isSubmittingChildReply || isThreadClosed}
								className="w-full rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2 text-sm theme-muted outline-none"
							/>
							{childReplyError && <p className="theme-danger text-xs">{childReplyError}</p>}
							<button
								type="submit"
								disabled={!childReplyContent.trim() || isSubmittingChildReply || isThreadClosed}
								className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
							>
								{isSubmittingChildReply ? 'Posting...' : 'Post Reply'}
							</button>
						</form>
					)}

					{(reply.replyCount || 0) > 0 && (
						<button
							type="button"
							className="mt-2 text-xs text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
							onClick={toggleReplies}
						>
							{showReplies ? '▼' : '▶'} {reply.replyCount}{' '}
							{reply.replyCount === 1 ? 'reply' : 'replies'}
						</button>
					)}

					<div className="mt-3 border-t border-[color:var(--line)] pt-3">
						<ReportAction target={{ kind: 'post', id: reply.id }} translationPostId={reply.id} />
					</div>
					</div>
				</div>

			{showReplies && !isDepthCapped && ((reply.replies?.length || 0) > 0 || childRepliesHasMore) && (
				<div className="relative ml-3 pl-3 sm:ml-6 sm:pl-5">
					<div className="absolute bottom-0 left-0 top-0 w-[2px] bg-[color:var(--line)]" />
					<div className="space-y-3">
						{reply.replies?.map((nestedReply) => (
							<div key={nestedReply.id} className="relative">
								<div className="absolute -left-5 top-5 h-[2px] w-5 bg-[color:var(--line)]" />
								<ReplyItem
									reply={nestedReply}
									depth={depth + 1}
									currentUserId={currentUserId}
									currentUserRole={currentUserRole}
									isThreadClosed={isThreadClosed}
									onReplySubmit={onReplySubmit}
									onReplyEdit={onReplyEdit}
									onReplyDelete={onReplyDelete}
									onPostVisibilityToggle={onPostVisibilityToggle}
									onLoadReplies={onLoadReplies}
									normalizeVersion={normalizeVersion}
									onPromoteBranch={onPromoteBranch}
								/>
							</div>
						))}

						{childRepliesHasMore && (
							<div className="relative py-1">
								<div className="absolute -left-5 top-3 h-[2px] w-5 bg-[color:var(--line)]" />
								<button
									type="button"
									onClick={loadMoreChildReplies}
									disabled={isLoadingChildReplies}
									className="text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:opacity-50"
								>
									{isLoadingChildReplies ? 'Loading...' : 'See more replies'}
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{showReplies && isDepthCapped && (reply.replyCount || 0) > 0 && (
				<div className="ml-0 rounded-xl sm:ml-[2.75rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-3">
					<p className="theme-muted text-xs">
						Maximum nesting depth reached. Continue this thread in an elevated view.
					</p>
					{(reply.replies?.length || 0) === 0 && childRepliesHasMore && (
						<p className="mt-2 text-xs text-[var(--badge-neutral-text)]">
							Load this level first with &quot;See more replies&quot; before continuing the thread.
						</p>
					)}
					<button
						type="button"
						onClick={() =>
							onPromoteBranch({
								rootPostId: reply.id,
								rootAuthor: displayName,
								replies: reply.replies || [],
							})
						}
						disabled={(reply.replies?.length || 0) === 0 && childRepliesHasMore}
						className="mt-2 text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Continue thread
					</button>
				</div>
			)}

		</div>
);
}
