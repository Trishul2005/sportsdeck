'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type MeUser = {
id: number;
username: string;
avatar: string | null;
favoriteTeam?: {
id: number;
name: string;
logoUrl: string | null;
} | null;
};

type ReplyItem = {
id: number;
content: string;
createdAt: string;
author?: {
id: number;
username: string;
avatar: string | null;
} | null;
};

type GroupedComment = {
post: {
id: number;
content: string;
createdAt: string;
threadId: number | null;
};
count: number;
latestAt: string;
previewReplies: ReplyItem[];
};

type GroupedFollowingActivity = {
authorId: number;
authorName: string;
authorAvatar: string | null;
count: number;
latestAt: string;
threadCount: number;
previewPosts: Array<{
id: number;
content: string;
createdAt: string;
threadId: number | null;
}>;
};

type TeamThread = {
id: number;
title: string;
createdAt?: string;
mainPost?: { content: string };
};

type TeamMatch = {
id: number;
date: string | null;
homeTeam: { id: number; name: string; logoUrl: string | null };
awayTeam: { id: number; name: string; logoUrl: string | null };
homeScore: number | null;
awayScore: number | null;
status: string;
};

type FeedMeta = {
page: number;
pageSize: number;
totalItems: number;
totalPages: number;
sort: string;
};

type FeedResponse = {
me: MeUser | null;
summary: {
replies: number;
following: number;
team: number;
};
replies: {
items: GroupedComment[];
meta: FeedMeta;
};
following: {
items: GroupedFollowingActivity[];
meta: FeedMeta;
};
team: {
threads: TeamThread[];
matches: TeamMatch[];
};
};

const DEFAULT_META: FeedMeta = {
page: 1,
pageSize: 6,
totalItems: 0,
totalPages: 1,
sort: 'recent',
};

function toDateLabel(value: string | null | undefined) {
if (!value) return 'Unknown time';
const date = new Date(value);
if (Number.isNaN(date.getTime())) return 'Unknown time';
return new Intl.DateTimeFormat('en-US', {
month: 'short',
day: 'numeric',
hour: 'numeric',
minute: '2-digit',
}).format(date);
}

function getRelativeLabel(value: string | null | undefined) {
if (!value) return 'recently';
const date = new Date(value);
if (Number.isNaN(date.getTime())) return 'recently';
const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
if (minutes < 60) return `${minutes}m ago`;
const hours = Math.floor(minutes / 60);
if (hours < 24) return `${hours}h ago`;
const days = Math.floor(hours / 24);
return `${days}d ago`;
}

function ChevronDownIcon() {
return (
<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
<path d="m6 9 6 6 6-6" />
</svg>
);
}

export default function FeedPage() {
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState('');
const [me, setMe] = useState<MeUser | null>(null);
const [summary, setSummary] = useState({ replies: 0, following: 0, team: 0 });
const [commentsToMyPosts, setCommentsToMyPosts] = useState<GroupedComment[]>([]);
const [followingActivity, setFollowingActivity] = useState<GroupedFollowingActivity[]>([]);
const [favoriteTeamThreads, setFavoriteTeamThreads] = useState<TeamThread[]>([]);
const [favoriteTeamMatches, setFavoriteTeamMatches] = useState<TeamMatch[]>([]);
const [replyMeta, setReplyMeta] = useState<FeedMeta>(DEFAULT_META);
const [followingMeta, setFollowingMeta] = useState<FeedMeta>(DEFAULT_META);

const [replySort, setReplySort] = useState<'recent' | 'oldest' | 'thread'>('recent');
const [followingSort, setFollowingSort] = useState<'recent' | 'posts' | 'threads'>('recent');
const [replyPage, setReplyPage] = useState(1);
const [followingPage, setFollowingPage] = useState(1);

const [isRepliesLoading, setIsRepliesLoading] = useState(false);
const [isFollowingLoading, setIsFollowingLoading] = useState(false);

const hasInitialLoad = useRef(false);

const favoriteTeamName = me?.favoriteTeam?.name ?? null;
const favoriteTeamId = me?.favoriteTeam?.id ?? null;

async function fetchFeed(): Promise<FeedResponse | null> {
const qs = new URLSearchParams({
replyPage: String(replyPage),
replyPageSize: '6',
replySort,
followingPage: String(followingPage),
followingPageSize: '6',
followingSort,
});
const response = await fetch(`/api/feed?${qs.toString()}`, {
cache: 'no-store',
credentials: 'include',
});
if (!response.ok) return null;
return response.json().catch(() => null);
}

useEffect(() => {
let isMounted = true;

async function loadInitial() {
setIsLoading(true);
setError('');
try {
const data = await fetchFeed();
if (!isMounted) return;
if (!data) {
setError('Unable to load your feed right now.');
setMe(null);
return;
}
setMe(data.me);
setSummary(data.summary || { replies: 0, following: 0, team: 0 });
setCommentsToMyPosts(Array.isArray(data.replies?.items) ? data.replies.items : []);
setFollowingActivity(Array.isArray(data.following?.items) ? data.following.items : []);
setFavoriteTeamThreads(Array.isArray(data.team?.threads) ? data.team.threads : []);
setFavoriteTeamMatches(Array.isArray(data.team?.matches) ? data.team.matches : []);
setReplyMeta(data.replies?.meta || DEFAULT_META);
setFollowingMeta(data.following?.meta || DEFAULT_META);
hasInitialLoad.current = true;
} catch {
if (!isMounted) return;
setError('Unable to load your feed right now.');
} finally {
if (isMounted) setIsLoading(false);
}
}

void loadInitial();
return () => {
isMounted = false;
};
// Initial fetch only; section updates are handled separately.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
if (!hasInitialLoad.current) return;
let isMounted = true;

async function refreshRepliesOnly() {
setIsRepliesLoading(true);
try {
const data = await fetchFeed();
if (!isMounted || !data) return;
setCommentsToMyPosts(Array.isArray(data.replies?.items) ? data.replies.items : []);
setReplyMeta(data.replies?.meta || DEFAULT_META);
setSummary((prev) => ({ ...prev, replies: data.summary?.replies ?? prev.replies }));
} finally {
if (isMounted) setIsRepliesLoading(false);
}
}

void refreshRepliesOnly();
return () => {
isMounted = false;
};
}, [replyPage, replySort]);

useEffect(() => {
if (!hasInitialLoad.current) return;
let isMounted = true;

async function refreshFollowingOnly() {
setIsFollowingLoading(true);
try {
const data = await fetchFeed();
if (!isMounted || !data) return;
setFollowingActivity(Array.isArray(data.following?.items) ? data.following.items : []);
setFollowingMeta(data.following?.meta || DEFAULT_META);
setSummary((prev) => ({ ...prev, following: data.summary?.following ?? prev.following }));
} finally {
if (isMounted) setIsFollowingLoading(false);
}
}

void refreshFollowingOnly();
return () => {
isMounted = false;
};
}, [followingPage, followingSort]);

if (isLoading) {
return (
<div className="space-y-6">
<div className="h-36 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
<div className="h-64 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
<div className="h-64 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
</div>
);
}

if (!me) {
return (
<section className="theme-card rounded-[2rem] p-8">
<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Your Feed</p>
<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl uppercase tracking-[-0.03em]">
Sign in to personalize your dashboard
</h1>
<p className="theme-muted mt-4 max-w-2xl text-base leading-7">
Once you sign in, this feed will group activity from your posts, people you follow, and your favorite team.
</p>
<div className="mt-6 flex gap-3">
<Link href="/login" className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90">Log in</Link>
<Link href="/signup" className="rounded-2xl border border-[color:var(--line)] px-5 py-3 text-sm font-semibold theme-muted transition hover:bg-[var(--card-soft)]">Create account</Link>
</div>
</section>
);
}

return (
<div className="space-y-6">
<section className="theme-card overflow-hidden rounded-[2rem] border border-[color:color-mix(in_srgb,var(--accent)_18%,var(--line))] p-8 sm:p-10">
<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Personalized Feed</p>
<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl uppercase tracking-[-0.03em] sm:text-5xl">
Welcome back, {me.username}
</h1>
<p className="theme-muted mt-4 max-w-3xl text-base leading-7">
Grouped updates keep your feed readable: clustered conversation activity, followed-user highlights, and {favoriteTeamName ? `${favoriteTeamName} updates` : 'team updates'} in one place.
</p>
<div className="mt-6 grid gap-3 sm:grid-cols-3">
<SummaryCard label="Replies on your posts" value={summary.replies} />
<SummaryCard label="Posts from people you follow" value={summary.following} />
<SummaryCard label="Team updates" value={summary.team} />
</div>
</section>

{error ? (
<p className="rounded-2xl border border-[color:var(--badge-negative-border)] bg-[var(--badge-negative-bg)] px-4 py-3 text-sm text-[var(--badge-negative-text)]">
{error}
</p>
) : null}

<section className={`theme-card rounded-[2rem] p-8 transition-opacity duration-200 ${isRepliesLoading ? 'opacity-65' : 'opacity-100'}`}>
<div className="flex flex-wrap items-end justify-between gap-3">
<div>
<p className="text-xs uppercase tracking-[0.18em] theme-muted">Grouped Conversations</p>
<h2 className="mt-2 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">Replies to Your Posts</h2>
</div>
<div className="flex items-center gap-2">
{isRepliesLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" /> : null}
<div className="relative">
<select
value={replySort}
disabled={isRepliesLoading}
onChange={(event) => {
const nextSort = event.target.value as 'recent' | 'oldest' | 'thread';
setReplySort(nextSort);
setReplyPage(1);
}}
	className="theme-input theme-select rounded-lg px-3 py-1 pr-8 text-xs text-[var(--foreground)]"
>
<option value="recent">Most recent</option>
<option value="oldest">Oldest first</option>
<option value="thread">By thread</option>
</select>
<div className="theme-muted pointer-events-none absolute inset-y-0 right-3 flex items-center">
<ChevronDownIcon />
</div>
</div>
<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs theme-muted">Page {replyMeta.page} / {replyMeta.totalPages}</span>
</div>
</div>

{commentsToMyPosts.length === 0 ? (
<EmptyFeedState message="No new replies from other users on your posts yet." />
) : (
<div className="mt-5 space-y-3">
{commentsToMyPosts.map((group) => (
<div key={group.post.id} className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
<div className="flex items-start justify-between gap-3">
<div>
<p className="text-sm font-semibold text-[var(--foreground)]">{group.count} new comment{group.count === 1 ? '' : 's'} on your post</p>
<p className="theme-muted mt-1 text-xs">Updated {getRelativeLabel(group.latestAt)}</p>
</div>
{group.post.threadId ? (
<Link href={`/forums/${group.post.threadId}`} className="rounded-lg border border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-[var(--accent-soft)]">Open Thread</Link>
) : null}
</div>
<p className="theme-muted mt-3 line-clamp-2 text-sm">{group.post.content}</p>
<ul className="mt-3 space-y-2">
{group.previewReplies.map((reply) => (
<li key={reply.id} className="rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2">
<p className="text-xs font-semibold text-[var(--foreground)]">{reply.author?.username || 'User'} · {toDateLabel(reply.createdAt)}</p>
<p className="theme-muted mt-1 line-clamp-2 text-xs">{reply.content}</p>
</li>
))}
</ul>
</div>
))}
</div>
)}
<PaginationControls
page={replyMeta.page}
totalPages={replyMeta.totalPages}
onPrev={() => setReplyPage((current) => Math.max(1, current - 1))}
onNext={() => setReplyPage((current) => Math.min(replyMeta.totalPages, current + 1))}
isLoading={isRepliesLoading}
/>
</section>

<section className={`theme-card rounded-[2rem] p-8 transition-opacity duration-200 ${isFollowingLoading ? 'opacity-65' : 'opacity-100'}`}>
<div className="flex flex-wrap items-end justify-between gap-3">
<div>
<p className="text-xs uppercase tracking-[0.18em] theme-muted">People You Follow</p>
<h2 className="mt-2 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">Posts From People You Follow</h2>
</div>
<div className="flex items-center gap-2">
{isFollowingLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" /> : null}
<div className="relative">
<select
value={followingSort}
disabled={isFollowingLoading}
onChange={(event) => {
const nextSort = event.target.value as 'recent' | 'posts' | 'threads';
setFollowingSort(nextSort);
setFollowingPage(1);
}}
	className="theme-input theme-select rounded-lg px-3 py-1 pr-8 text-xs text-[var(--foreground)]"
>
<option value="recent">Most recent</option>
<option value="posts">Most posts</option>
<option value="threads">Most thread activity</option>
</select>
<div className="theme-muted pointer-events-none absolute inset-y-0 right-3 flex items-center">
<ChevronDownIcon />
</div>
</div>
<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs theme-muted">Page {followingMeta.page} / {followingMeta.totalPages}</span>
</div>
</div>

{followingActivity.length === 0 ? (
<EmptyFeedState message="No recent posts from followed users yet." />
) : (
<div className="mt-5 grid gap-3 md:grid-cols-2">
{followingActivity.map((group) => (
<div key={group.authorId} className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
<div className="flex items-center justify-between gap-3">
<Link href={`/profile/${group.authorId}`} className="flex items-center gap-2 transition hover:opacity-85">
{group.authorAvatar ? (
<img src={group.authorAvatar} alt={group.authorName} className="h-8 w-8 rounded-full border border-[color:var(--line)] object-cover" />
) : (
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--accent)_14%,var(--card-soft))] text-xs font-bold text-[var(--accent)]">{group.authorName.charAt(0).toUpperCase()}</div>
)}
<p className="text-sm font-semibold text-[var(--foreground)]">{group.authorName}</p>
</Link>
<span className="text-xs theme-muted">{group.count} item{group.count === 1 ? '' : 's'}</span>
</div>
<ul className="mt-3 space-y-2">
{group.previewPosts.map((post) => (
<li key={post.id} className="rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2">
<p className="theme-muted line-clamp-2 text-xs">{post.content}</p>
<div className="mt-2 flex items-center justify-between">
<span className="text-[11px] theme-muted">{toDateLabel(post.createdAt)}</span>
					{post.threadId ? <Link href={`/forums/${post.threadId}`} className="text-[11px] font-semibold text-[var(--accent)] transition hover:text-[var(--accent-soft)]">Thread</Link> : null}
</div>
</li>
))}
</ul>
{followingSort === 'threads' ? (
<p className="theme-muted mt-3 text-[11px]">{group.threadCount} active thread{group.threadCount === 1 ? '' : 's'}</p>
) : null}
</div>
))}
</div>
)}
<PaginationControls
page={followingMeta.page}
totalPages={followingMeta.totalPages}
onPrev={() => setFollowingPage((current) => Math.max(1, current - 1))}
onNext={() => setFollowingPage((current) => Math.min(followingMeta.totalPages, current + 1))}
isLoading={isFollowingLoading}
/>
</section>

<section className="theme-card rounded-[2rem] border border-[color:color-mix(in_srgb,var(--accent)_18%,var(--line))] p-8">
<div className="flex items-end justify-between gap-3">
<div>
<p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Favorite Team Pulse</p>
<h2 className="mt-2 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">{favoriteTeamName ? `${favoriteTeamName} Updates` : 'Team Updates'}</h2>
</div>
</div>

{!favoriteTeamId ? (
<EmptyFeedState message="Set a favorite team in your profile to see match and forum updates here." />
) : (
<div className="mt-5 space-y-4">
<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_18%,var(--line))] bg-[var(--card-inset)] p-4">
<p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Start a Thread</p>
<div className="mt-3 flex items-center justify-between gap-3">
<p className="theme-muted text-sm">
Create a new discussion for your team or a specific match.
</p>
<Link
href={favoriteTeamId ? `/forums/create?teamId=${favoriteTeamId}` : '/forums/create'}
className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90"
>
Create Thread
</Link>
</div>
</div>

<div className="grid gap-4 lg:grid-cols-2">
<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
<p className="text-xs uppercase tracking-[0.16em] theme-muted">Recent Match Scores</p>
{favoriteTeamMatches.length === 0 ? (
<p className="theme-muted mt-3 text-sm">No recent match updates in this time window.</p>
) : (
<ul className="mt-3 space-y-2">
{favoriteTeamMatches.map((match) => (
<li key={match.id} className="rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2">
<Link href={`/matches/${match.id}`} className="block">
<p className="text-sm font-semibold text-[var(--foreground)]">
{match.awayTeam.name} {typeof match.awayScore === 'number' ? match.awayScore : '--'} - {typeof match.homeScore === 'number' ? match.homeScore : '--'} {match.homeTeam.name}
</p>
<p className="theme-muted mt-1 text-xs">{toDateLabel(match.date)} · {match.status}</p>
</Link>
</li>
))}
</ul>
)}
</div>

<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
<p className="text-xs uppercase tracking-[0.16em] theme-muted">New Team Threads</p>
{favoriteTeamThreads.length === 0 ? (
<p className="theme-muted mt-3 text-sm">No new forum threads for your team yet.</p>
) : (
<ul className="mt-3 space-y-2">
{favoriteTeamThreads.map((thread) => (
<li key={thread.id} className="rounded-xl border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-2">
<Link href={`/forums/${thread.id}`} className="block">
<p className="text-sm font-semibold text-[var(--foreground)]">{thread.title}</p>
<p className="theme-muted mt-1 line-clamp-2 text-xs">{thread.mainPost?.content || 'Open thread to read more.'}</p>
<p className="theme-muted mt-1 text-[11px]">{toDateLabel(thread.createdAt)}</p>
</Link>
</li>
))}
</ul>
)}
</div>
</div>
</div>
)}
</section>
</div>
);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
return (
<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_14%,var(--line))] bg-[color:color-mix(in_srgb,var(--accent)_7%,var(--card-soft))] px-4 py-3">
<p className="text-xs uppercase tracking-[0.16em] theme-muted">{label}</p>
<p className="mt-2 font-[family:var(--font-heading)] text-3xl leading-none text-[var(--foreground)]">{value}</p>
</div>
);
}

function EmptyFeedState({ message }: { message: string }) {
return (
<div className="mt-5 rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-8 text-center">
<p className="theme-muted text-sm">{message}</p>
</div>
);
}

function PaginationControls({
page,
totalPages,
onPrev,
onNext,
isLoading,
}: {
page: number;
totalPages: number;
onPrev: () => void;
onNext: () => void;
isLoading: boolean;
}) {
if (totalPages <= 1) return null;

return (
<div className="mt-5 flex items-center justify-end gap-2">
<button
type="button"
onClick={onPrev}
disabled={isLoading || page <= 1}
className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-xs font-semibold theme-muted transition enabled:hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-40"
>
Previous
</button>
<button
type="button"
onClick={onNext}
disabled={isLoading || page >= totalPages}
className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-xs font-semibold theme-muted transition enabled:hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-40"
>
Next
</button>
</div>
);
}
