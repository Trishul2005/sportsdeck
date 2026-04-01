'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { resolveTeamDivision } from '@/app/utils/teamDivision';

type SocialUser = {
	id: number;
	username: string;
	avatar: string | null;
	followedAt: string;
};

type FavoriteTeam = {
	id: number;
	name: string;
	logoUrl: string | null;
	conference: string;
	division: string;
	wins: number;
	losses: number;
} | null;

type MeResponse = {
	id?: number;
	user?: {
		id: number;
		username: string;
		favoriteTeamId?: number | null;
		favoriteTeam: FavoriteTeam;
	};
	username?: string;
	favoriteTeamId?: number | null;
	favoriteTeam?: FavoriteTeam;
};

export default function FollowingPage() {
	const [following, setFollowing] = useState<SocialUser[]>([]);
	const [followers, setFollowers] = useState<SocialUser[]>([]);
	const [favoriteTeam, setFavoriteTeam] = useState<FavoriteTeam>(null);
	const [query, setQuery] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [activeActionUserId, setActiveActionUserId] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function loadFollowingPage() {
			try {
				setIsLoading(true);
				setError('');

				const meResponse = await fetch('/api/user/me', {
					credentials: 'include',
					cache: 'no-store',
				});
				const meData: MeResponse = await meResponse.json().catch(() => ({}));

				if (!meResponse.ok || !((meData?.id ?? meData?.user?.id))) {
					throw new Error('You need to be logged in to view your following page.');
				}

				const [followingResponse, followersResponse] = await Promise.all([
					fetch('/api/user/following', { credentials: 'include', cache: 'no-store' }),
					fetch('/api/user/followers', { credentials: 'include', cache: 'no-store' }),
				]);
				const followingData = await followingResponse.json().catch(() => null);
				const followersData = await followersResponse.json().catch(() => null);

				if (!followingResponse.ok) {
					throw new Error(followingData?.error || 'Unable to load the accounts you follow.');
				}
				if (!followersResponse.ok) {
					throw new Error(followersData?.error || 'Unable to load your followers.');
				}

				const favoriteTeamId = meData.favoriteTeamId ?? meData.user?.favoriteTeamId ?? meData.favoriteTeam?.id ?? meData.user?.favoriteTeam?.id ?? null;
				let resolvedFavoriteTeam = meData.favoriteTeam ?? meData.user?.favoriteTeam ?? null;

				if (favoriteTeamId) {
					const favoriteTeamResponse = await fetch(`/api/teams/${favoriteTeamId}`, {
						credentials: 'include',
						cache: 'no-store',
					});
					const favoriteTeamData = await favoriteTeamResponse.json().catch(() => null);

					if (favoriteTeamResponse.ok && favoriteTeamData?.team) {
						resolvedFavoriteTeam = favoriteTeamData.team;
					}
				}

				if (!cancelled) {
					setFavoriteTeam(
						resolvedFavoriteTeam
							? {
									...resolvedFavoriteTeam,
									division: resolveTeamDivision(
										resolvedFavoriteTeam.name,
										resolvedFavoriteTeam.division,
									),
							  }
							: null,
					);
					setFollowing(Array.isArray(followingData?.following) ? followingData.following : []);
					setFollowers(Array.isArray(followersData?.followers) ? followersData.followers : []);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Unable to load your following page.');
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		loadFollowingPage();

		return () => {
			cancelled = true;
		};
	}, []);

	const filteredFollowing = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return following;
		}

		return following.filter((user) => user.username.toLowerCase().includes(normalizedQuery));
	}, [following, query]);

	async function handleUnfollow(userId: number) {
		setActiveActionUserId(userId);
		setError('');

		try {
			const response = await fetch(`/api/user/${userId}/follow`, {
				method: 'DELETE',
				credentials: 'include',
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				throw new Error(data?.error || 'Unable to unfollow this user right now.');
			}

			setFollowing((current) => current.filter((user) => user.id !== userId));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to unfollow this user right now.');
		} finally {
			setActiveActionUserId(null);
		}
	}

	if (isLoading) {
		return (
			<div className="grid gap-6">
				<div className="h-48 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<div className="h-96 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
					<div className="h-72 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<section className="theme-card rounded-[2rem] p-8 sm:p-10">
				<p className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
					SportsDeck
				</p>
				<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em] sm:text-5xl">
					Following
				</h1>
				<p className="theme-muted mt-5 max-w-3xl text-lg leading-8">
					Track the people, teams, and conversations you care about most without losing the pace of the rest of SportsDeck.
				</p>

				<div className="mt-8 grid gap-4 md:grid-cols-3">
					<MetricCard label="Following" value={String(following.length)} helper="Accounts you currently follow" />
					<MetricCard label="Followers" value={String(followers.length)} helper="People keeping up with your profile" />
					<MetricCard
						label="Favorite Team"
						value={favoriteTeam ? favoriteTeam.name : 'Unset'}
						helper={favoriteTeam ? `${favoriteTeam.wins}-${favoriteTeam.losses} record` : 'Pick one from your profile settings'}
					/>
				</div>
			</section>

			{error ? (
				<div className="theme-danger-panel rounded-[1.5rem] px-5 py-4 text-sm">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<section className="theme-card rounded-[2rem] p-6 sm:p-8">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Network</p>
							<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
								Accounts You Follow
							</h2>
						</div>
						<label className="block sm:w-[18rem]">
							<span className="sr-only">Search following</span>
							<input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search usernames..."
								className="theme-input w-full rounded-[1rem] px-4 py-3 text-sm outline-none transition"
							/>
						</label>
					</div>

					<div className="mt-8 space-y-3">
						{filteredFollowing.length > 0 ? (
							filteredFollowing.map((user) => (
								<div
									key={user.id}
									className="flex flex-col gap-4 rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<Link href={`/profile/${user.id}`} className="flex min-w-0 items-center gap-4">
										<Avatar user={user} />
										<div className="min-w-0">
											<p className="truncate font-semibold text-[var(--foreground)]">{user.username}</p>
											<p className="theme-muted mt-1 text-sm">Following since {formatDate(user.followedAt)}</p>
										</div>
									</Link>
									<div className="flex items-center gap-2">
										<Link
											href={`/profile/${user.id}`}
											className="theme-hover inline-flex h-10 items-center rounded-[1rem] border border-[color:var(--line)] bg-[var(--card-soft)] px-4 text-sm font-medium"
										>
											Profile
										</Link>
										<button
											type="button"
											onClick={() => handleUnfollow(user.id)}
											disabled={activeActionUserId === user.id}
											className="theme-danger-panel rounded-[1rem] px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-60"
										>
											{activeActionUserId === user.id ? 'Removing...' : 'Unfollow'}
										</button>
									</div>
								</div>
							))
						) : (
							<EmptyPanel
								title="No followed accounts yet"
								description="Start following people from their profile pages and they'll show up here."
								ctaHref="/forums"
								ctaLabel="Explore forums"
							/>
						)}
					</div>
				</section>

				<div className="space-y-6">
					<section className="theme-card rounded-[2rem] p-6 sm:p-8">
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Team Shortcut</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Favorite Team
						</h2>
						<div className="mt-8">
							{favoriteTeam ? (
								<Link
									href={`/teams/${favoriteTeam.id}`}
									className="block rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)]"
								>
									<div className="flex items-center gap-4">
										<TeamLogo team={favoriteTeam} />
										<div>
											<p className="font-semibold text-[var(--foreground)]">{favoriteTeam.name}</p>
											<p className="theme-muted mt-1 text-sm">
												{favoriteTeam.conference} • {resolveTeamDivision(favoriteTeam.name, favoriteTeam.division)}
											</p>
											<p className="mt-2 text-sm text-[var(--accent)]">{favoriteTeam.wins}-{favoriteTeam.losses} record</p>
										</div>
									</div>
								</Link>
							) : (
								<EmptyPanel
									title="No favorite team set"
									description="Pick a favorite team in your profile to keep a quick shortcut here."
									ctaHref="/profile"
									ctaLabel="Open profile"
								/>
							)}
						</div>
					</section>

					<section className="theme-card rounded-[2rem] p-6 sm:p-8">
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Community</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Recent Followers
						</h2>
						<div className="mt-8 space-y-3">
							{followers.length > 0 ? (
								followers.slice(0, 3).map((user) => (
									<Link
										key={user.id}
										href={`/profile/${user.id}`}
										className="flex items-center gap-4 rounded-[1.4rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)]"
									>
										<Avatar user={user} />
										<div className="min-w-0">
											<p className="truncate font-semibold text-[var(--foreground)]">{user.username}</p>
											<p className="theme-muted mt-1 text-sm">Followed you {formatDate(user.followedAt)}</p>
										</div>
									</Link>
								))
							) : (
								<EmptyPanel
									title="No followers yet"
									description="Once people follow your profile, the latest followers will appear here."
								/>
							)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
	return (
		<div className="theme-card rounded-[1.6rem] p-5">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">
				{value}
			</p>
			<p className="theme-muted mt-2 text-sm">{helper}</p>
		</div>
	);
}

function EmptyPanel({
	title,
	description,
	ctaHref,
	ctaLabel,
}: {
	title: string;
	description: string;
	ctaHref?: string;
	ctaLabel?: string;
}) {
	return (
		<div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-8 text-center">
			<p className="font-semibold text-[var(--foreground)]">{title}</p>
			<p className="theme-muted mt-2 text-sm leading-6">{description}</p>
			{ctaHref && ctaLabel ? (
				<Link href={ctaHref} className="mt-4 inline-flex rounded-[1rem] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">
					{ctaLabel}
				</Link>
			) : null}
		</div>
	);
}

function Avatar({ user }: { user: SocialUser }) {
	if (user.avatar) {
		return (
			<Image
				src={user.avatar}
				alt={`${user.username} avatar`}
				width={48}
				height={48}
				className="h-12 w-12 rounded-[1rem] border border-[color:var(--line)] object-cover"
				unoptimized
			/>
		);
	}

	return (
		<div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[color:var(--line)] bg-[var(--card-soft)] text-sm font-bold text-[var(--accent)]">
			{user.username.slice(0, 2).toUpperCase()}
		</div>
	);
}

function TeamLogo({ team }: { team: NonNullable<FavoriteTeam> }) {
	if (team.logoUrl) {
		return (
			<Image
				src={team.logoUrl}
				alt={`${team.name} logo`}
				width={56}
				height={56}
				className="theme-logo-surface h-14 w-14 rounded-[1rem] object-contain p-1.5"
			/>
		);
	}

	return (
		<div className="flex h-14 w-14 items-center justify-center rounded-[1rem] border border-[color:var(--line)] bg-[var(--card-soft)] text-sm font-bold text-[var(--accent)]">
			{team.name.slice(0, 2).toUpperCase()}
		</div>
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(value));
}
