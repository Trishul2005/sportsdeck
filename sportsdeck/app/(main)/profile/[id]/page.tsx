'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Team = {
	id: number;
	name: string;
	logoUrl: string | null;
};

type ActivityPost = {
	id: number;
	content: string;
	createdAt: string;
	updatedAt?: string;
	threadId: number | null;
};

type ActivityThread = {
	id: number;
	title: string;
	createdAt: string;
	updatedAt?: string;
	teamId: number | null;
};

type ActivityPoll = {
	id: number;
	question: string;
	createdAt: string;
	deadline: string;
	threadId?: number | null;
};

type PublicProfile = {
	user: {
		id: number;
		username: string;
		avatar: string | null;
		role: 'USER' | 'ADMIN';
		isBanned: boolean;
		createdAt: string;
		favoriteTeam: Team | null;
		posts: ActivityPost[];
		threads: ActivityThread[];
		polls: ActivityPoll[];
	};
	viewer: {
		isAuthenticated: boolean;
		isOwnProfile: boolean;
		isFollowing: boolean;
	};
	counts: {
		followers: number;
		following: number;
		threads: number;
		posts: number;
	};
};

type TabKey = 'posts' | 'threads' | 'polls';
const ACTIVITY_PAGE_SIZE = 10;

const tabs: Array<{ key: TabKey; label: string }> = [
	{ key: 'posts', label: 'Posts' },
	{ key: 'threads', label: 'Threads' },
	{ key: 'polls', label: 'Polls' },
];

export default function UserProfilePage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [activeTab, setActiveTab] = useState<TabKey>('posts');
	const [isLoading, setIsLoading] = useState(true);
	const [isFollowSubmitting, setIsFollowSubmitting] = useState(false);
	const [pageError, setPageError] = useState('');
	const [activityYear, setActivityYear] = useState(new Date().getFullYear());
	const [activityPage, setActivityPage] = useState(1);

	useEffect(() => {
		let isMounted = true;

		async function loadProfile() {
			try {
				const response = await fetch(`/api/user/${params.id}/profile`, {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);

				if (!isMounted) {
					return;
				}

				if (!response.ok) {
					setPageError(data?.error || 'Unable to load this profile right now.');
					return;
				}

				setProfile(data);
			} catch {
				if (isMounted) {
					setPageError('Unable to load this profile right now.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		if (params.id) {
			void loadProfile();
		}

		return () => {
			isMounted = false;
		};
	}, [params.id]);

	const activityItems = useMemo(() => {
		if (!profile) {
			return [];
		}

		switch (activeTab) {
			case 'posts':
				return profile.user.posts.map((post) => ({
					id: post.id,
					title: post.content,
					meta: formatDate(post.updatedAt || post.createdAt),
					submeta: post.threadId ? `Thread #${post.threadId}` : 'Standalone post',
					href: post.threadId ? `/forums/${post.threadId}` : null,
				}));
			case 'threads':
				return profile.user.threads.map((thread) => ({
					id: thread.id,
					title: thread.title,
					meta: formatDate(thread.updatedAt || thread.createdAt),
					submeta: thread.teamId ? 'Team thread' : 'General thread',
					href: `/forums/${thread.id}`,
				}));
			case 'polls':
				return profile.user.polls.map((poll) => ({
					id: poll.id,
					title: poll.question,
					meta: formatDate(poll.createdAt),
					submeta: `Deadline ${formatDate(poll.deadline)}`,
					href: poll.threadId ? `/forums/${poll.threadId}` : null,
				}));
			default:
				return [];
		}
	}, [activeTab, profile]);

	const availableActivityYears = useMemo(() => {
		return buildAvailableActivityYears(profile?.user.posts ?? []);
	}, [profile?.user.posts]);

	useEffect(() => {
		if (availableActivityYears.length === 0) {
			setActivityYear(new Date().getFullYear());
			return;
		}

		setActivityYear((current) =>
			availableActivityYears.includes(current)
				? current
				: availableActivityYears[availableActivityYears.length - 1],
		);
	}, [availableActivityYears]);

	const postActivity = useMemo(() => {
		return buildPostActivityByYear(profile?.user.posts ?? [], activityYear);
	}, [activityYear, profile?.user.posts]);

	useEffect(() => {
		setActivityPage(1);
	}, [activeTab]);

	const paginatedActivityItems = useMemo(() => {
		const startIndex = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
		return activityItems.slice(startIndex, startIndex + ACTIVITY_PAGE_SIZE);
	}, [activityItems, activityPage]);

	const totalActivityPages = Math.max(
		1,
		Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE),
	);

	useEffect(() => {
		setActivityPage((current) => Math.min(current, totalActivityPages));
	}, [totalActivityPages]);

	async function handleFollowToggle() {
		if (!profile) {
			return;
		}

		if (!profile.viewer.isAuthenticated) {
			router.push('/signup');
			return;
		}

		if (profile.viewer.isOwnProfile) {
			router.push('/profile');
			return;
		}

		setIsFollowSubmitting(true);

		try {
			const nextAction = profile.viewer.isFollowing ? 'DELETE' : 'POST';
			const response = await fetch(`/api/user/${profile.user.id}/follow`, {
				method: nextAction,
				credentials: 'include',
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				const isBannedError =
					response.status === 403 &&
					typeof data?.error === 'string' &&
					data.error.toLowerCase().includes('banned');
				setPageError(
					isBannedError
						? 'You are banned. Unable to follow new users.'
						: data?.error || 'Unable to update follow status right now.',
				);
				return;
			}

			setProfile((current) =>
				current
					? {
							...current,
							viewer: {
								...current.viewer,
								isFollowing: !current.viewer.isFollowing,
							},
							counts: {
								...current.counts,
								followers: current.counts.followers + (current.viewer.isFollowing ? -1 : 1),
							},
					  }
					: current,
			);
			setPageError('');
		} catch {
			setPageError('Unable to update follow status right now.');
		} finally {
			setIsFollowSubmitting(false);
		}
	}

	if (isLoading) {
		return (
			<div className="grid gap-6">
				<div className="h-56 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				<div className="h-80 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
			</div>
		);
	}

	if (!profile) {
		return (
			<section className="theme-danger-panel rounded-[2rem] p-8">
				<h1 className="font-[family:var(--font-heading)] text-3xl uppercase">
					Profile Unavailable
				</h1>
				<p className="mt-3 text-base opacity-80">
					{pageError || 'We could not load this user profile.'}
				</p>
			</section>
		);
	}

	return (
		<div className="grid max-w-full gap-5 overflow-x-hidden sm:gap-6">
			<section className="min-w-0 overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-8 lg:p-10">
				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)] xl:items-start">
					<div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
						<div className="flex shrink-0 flex-col items-center gap-4 sm:items-start">
							<div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-soft)] shadow-[var(--shadow)] sm:h-28 sm:w-28 lg:h-32 lg:w-32">
								{profile.user.avatar ? (
									<img
										src={profile.user.avatar}
										alt={`${profile.user.username} avatar`}
										className="h-full w-full object-cover"
									/>
								) : (
									<DefaultAvatarIcon />
								)}
							</div>
							<button
								type="button"
								onClick={handleFollowToggle}
								disabled={isFollowSubmitting}
								className={`w-full min-w-[7.5rem] cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-semibold transition sm:w-auto ${
									profile.viewer.isOwnProfile
										? 'theme-panel hover:opacity-90'
										: profile.viewer.isFollowing
											? 'theme-danger-panel hover:opacity-90'
											: 'bg-[var(--accent)] text-black hover:opacity-90'
								} disabled:cursor-not-allowed disabled:opacity-60`}
							>
								{isFollowSubmitting
									? 'Saving...'
									: profile.viewer.isOwnProfile
										? 'My Profile'
										: profile.viewer.isFollowing
											? 'Unfollow'
											: 'Follow'}
							</button>
						</div>

						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
								<h1 className="font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.03em] sm:text-4xl lg:text-5xl">
									{profile.user.username}
								</h1>
								<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-sm uppercase tracking-[0.16em] theme-muted">
									{profile.user.role}
								</span>
								{profile.user.isBanned ? (
									<span className="theme-danger-panel rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.14em]">
										Banned
									</span>
								) : null}
							</div>
							

							<div className="mt-5 grid gap-3 sm:grid-cols-2">
								<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-3">
									<p className="theme-muted text-xs uppercase tracking-[0.18em]">
										Favorite Team
									</p>
									<div className="mt-2 flex items-center justify-center sm:justify-start">
										<TeamBadge team={profile.user.favoriteTeam} compact />
									</div>
								</div>

								<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-3">
									<p className="theme-muted text-xs uppercase tracking-[0.18em]">
										Joined
									</p>
									<p className="mt-2 text-sm font-medium text-[var(--foreground)]">
										{formatDate(profile.user.createdAt)}
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
						<StatCard label="Followers" value={profile.counts.followers} accent="text-[var(--accent)]" />
						<StatCard label="Following" value={profile.counts.following} accent="text-[#5ad7ff]" />
						<StatCard label="Posts" value={profile.counts.posts} accent="text-[var(--foreground)]" />
						<StatCard label="Threads" value={profile.counts.threads} accent="text-[#8bff9a]" />
					</div>
				</div>
			</section>

			{pageError ? (
				<p className="theme-danger-panel rounded-2xl px-4 py-3 text-sm">
					{pageError}
				</p>
			) : null}

			<section className="theme-card relative z-0 min-w-0 rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Activity
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Activity Chart
						</h2>
						<p className="theme-muted mt-3 max-w-2xl text-sm leading-6">
							Track how many posts this user made throughout the selected year.
						</p>
					</div>

					<label className="grid gap-2">
						<span className="text-xs uppercase tracking-[0.18em] theme-muted">
							Year
						</span>
						<select
							value={activityYear}
							onChange={(event) => setActivityYear(Number(event.target.value))}
							className="theme-input cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition"
						>
							{availableActivityYears.map((year) => (
								<option key={year} value={year}>
									{year}
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="mt-8 min-w-0 rounded-[1.75rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 sm:p-6">
					<div className="max-w-full overflow-x-auto pb-2">
						<ActivityHeatmap
							months={postActivity.months}
							totalPosts={postActivity.totalPosts}
							year={activityYear}
						/>
					</div>
				</div>
			</section>

			<section className="theme-card relative z-0 min-w-0 rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Activity
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Recent Contributions
						</h2>
					</div>

					<div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
						{tabs.map((tab) => (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className={`rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4 ${
									activeTab === tab.key
										? 'bg-[var(--accent)] text-black'
										: 'border border-[color:var(--line)] bg-[var(--card-soft)] theme-muted hover:opacity-90'
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				<div className="mt-8 grid gap-4">
					{activityItems.length === 0 ? (
						<div className="rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-12 text-center">
							<p className="font-[family:var(--font-heading)] text-2xl uppercase text-[var(--foreground)]">
								No {activeTab} Yet
							</p>
							<p className="theme-muted mt-3">
								This section is ready for activity once the user starts posting and
								participating.
							</p>
						</div>
					) : (
						paginatedActivityItems.map((item) => {
							const content = (
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
											{item.title}
										</h3>
										<p className="theme-muted mt-2 text-sm">{item.submeta}</p>
									</div>
									<span className="theme-muted text-xs sm:text-sm">{item.meta}</span>
								</div>
							);

							if (item.href) {
								return (
									<Link
										key={`${activeTab}-${item.id}`}
										href={item.href}
										className="block rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)] sm:px-5 sm:py-5"
									>
										{content}
									</Link>
								);
							}

							return (
								<article
									key={`${activeTab}-${item.id}`}
									className="rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 sm:px-5 sm:py-5"
								>
									{content}
								</article>
							);
						})
					)}
				</div>

				{activityItems.length > ACTIVITY_PAGE_SIZE ? (
					<div className="mt-6 flex flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
						<p className="theme-muted text-sm">
							Page {activityPage} of {totalActivityPages}
						</p>
						<div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
							<button
								type="button"
								onClick={() => setActivityPage((current) => Math.max(1, current - 1))}
								disabled={activityPage === 1}
								className="cursor-pointer rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() =>
									setActivityPage((current) => Math.min(totalActivityPages, current + 1))
								}
								disabled={activityPage === totalActivityPages}
								className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
							</button>
						</div>
					</div>
				) : null}
			</section>
		</div>
	);
}

function StatCard({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent: string;
}) {
	return (
		<div className="rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-3 sm:rounded-[1.5rem] sm:px-4 sm:py-4">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className={`mt-2 font-[family:var(--font-heading)] text-3xl sm:mt-3 sm:text-4xl ${accent}`}>
				{value}
			</p>
		</div>
	);
}

function DefaultAvatarIcon({ className = 'h-[52px] w-[52px]' }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`theme-muted ${className}`}
		>
			<path d="M18 20a6 6 0 0 0-12 0" />
			<circle cx="12" cy="10" r="4" />
		</svg>
	);
}

function TeamBadge({
	team,
	compact = false,
}: {
	team: Team | null;
	compact?: boolean;
}) {
	if (!team) {
		return (
			<div className={`flex items-center gap-3 ${compact ? '' : 'rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4'}`}>
				<div className="theme-muted flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card-soft)] text-sm font-semibold">
					--
				</div>
				{compact ? null : (
					<div>
						<p className="text-sm font-semibold text-[var(--foreground)]">No Favorite Team</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={`flex items-center gap-3 ${compact ? '' : 'rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4'}`}>
			<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--card-soft)]">
				{team.logoUrl ? (
					<img src={team.logoUrl} alt={`${team.name} logo`} className="h-full w-full object-cover" />
				) : (
					<span className="theme-muted text-sm font-semibold">
						{team.name.slice(0, 2).toUpperCase()}
					</span>
				)}
			</div>
			{compact ? null : (
				<div>
					<p className="text-sm font-semibold text-[var(--foreground)]">{team.name}</p>
				</div>
			)}
		</div>
	);
}

function formatDate(value: string) {
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function ActivityHeatmap({
	months,
	totalPosts,
	year,
}: {
	months: Array<{
		label: string;
		cells: Array<{ date: string; count: number; isPadding: boolean }>;
	}>;
	totalPosts: number;
	year: number;
}) {
	const maxCount = Math.max(
		...months.flatMap((month) =>
			month.cells.filter((cell) => !cell.isPadding).map((cell) => cell.count),
		),
		0,
	);
	const monthGroups = months.map((month) => {
		const weeks: Array<Array<{ date: string; count: number; isPadding: boolean }>> = [];
		for (let index = 0; index < month.cells.length; index += 7) {
			weeks.push(month.cells.slice(index, index + 7));
		}

		return {
			...month,
			weeks,
		};
	});

	return (
		<div className="min-w-max">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-sm font-semibold text-[var(--foreground)]">
						{totalPosts} post{totalPosts === 1 ? '' : 's'} in {year}
					</p>
					<p className="theme-muted mt-1 text-xs">
						Darker squares represent more posts on that day from January through December.
					</p>
				</div>

				<div className="flex items-center gap-2 text-xs theme-muted">
					<span>Less</span>
					<div className="flex items-center gap-1">
						{[0, 1, 2, 3, 4].map((level) => (
							<span
								key={level}
								className="h-3 w-3 rounded-[4px] border border-[color:var(--line)]"
								style={{
									backgroundColor: getActivityCellColor(level, 4, true),
								}}
							/>
						))}
					</div>
					<span>More</span>
				</div>
			</div>

			<div className="flex items-start gap-2">
				{monthGroups.map((month) => (
					<div key={month.label} className="shrink-0">
						<p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] theme-muted">
							{month.label}
						</p>
						<div className="flex gap-0.5">
							{month.weeks.map((week, weekIndex) => (
								<div key={`${month.label}-week-${weekIndex}`} className="flex flex-col gap-0.5">
									{week.map((cell, index) => (
										<div
											key={
												cell.isPadding
													? `${month.label}-pad-${weekIndex}-${index}`
													: cell.date
											}
											title={
												cell.isPadding
													? undefined
													: `${formatDate(cell.date)}: ${cell.count} post${cell.count === 1 ? '' : 's'}`
											}
											className={`h-2.5 w-2.5 rounded-[3px] border border-[color:var(--line)] ${
												cell.isPadding ? 'opacity-0' : 'transition hover:scale-110'
											}`}
											style={{
												backgroundColor: getActivityCellColor(
													cell.count,
													maxCount,
													!cell.isPadding,
												),
											}}
										/>
									))}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function buildAvailableActivityYears(posts: ActivityPost[]) {
	if (posts.length === 0) {
		return [new Date().getFullYear()];
	}

	const years = posts
		.map((post) => new Date(post.createdAt).getFullYear())
		.filter((year) => Number.isFinite(year));
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);

	return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
}

function buildPostActivityByYear(posts: ActivityPost[], year: number) {
	const counts = new Map<string, number>();
	for (const post of posts) {
		const key = startOfDay(new Date(post.createdAt)).toISOString().slice(0, 10);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const months = Array.from({ length: 12 }, (_, monthIndex) => {
		const firstDay = new Date(year, monthIndex, 1);
		const lastDay = new Date(year, monthIndex + 1, 0);
		const cells: Array<{ date: string; count: number; isPadding: boolean }> = [];

		for (let padding = 0; padding < firstDay.getDay(); padding += 1) {
			cells.push({
				date: `${year}-${monthIndex + 1}-pad-${padding}`,
				count: 0,
				isPadding: true,
			});
		}

		for (let day = 1; day <= lastDay.getDate(); day += 1) {
			const current = startOfDay(new Date(year, monthIndex, day));
			const key = current.toISOString().slice(0, 10);
			cells.push({
				date: key,
				count: counts.get(key) ?? 0,
				isPadding: false,
			});
		}

		return {
			label: new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
				month: 'short',
			}),
			cells,
		};
	});

	return {
		months,
		totalPosts: posts.filter((post) => new Date(post.createdAt).getFullYear() === year).length,
	};
}

function startOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

function getActivityCellColor(count: number, maxCount: number, isCurrentRange: boolean) {
	if (!isCurrentRange) {
		return 'color-mix(in srgb, var(--card-soft) 75%, transparent)';
	}

	if (count <= 0) {
		return 'color-mix(in srgb, var(--foreground) 4%, var(--card-soft))';
	}

	const intensity = maxCount <= 1 ? 1 : count / maxCount;

	if (intensity < 0.34) {
		return 'color-mix(in srgb, var(--accent) 30%, var(--card-soft))';
	}

	if (intensity < 0.67) {
		return 'color-mix(in srgb, var(--accent) 55%, var(--card-soft))';
	}

	return 'color-mix(in srgb, var(--accent) 85%, black)';
}
