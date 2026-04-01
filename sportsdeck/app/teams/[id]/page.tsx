'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFullTeamName } from '@/app/utils/teamNames';
import { resolveTeamDivision } from '@/app/utils/teamDivision';
import { formatVenueWithArena, getTeamVenue } from '@/app/utils/teamVenues';

type TeamThread = {
	id: number;
	title: string;
	isClosed: boolean;
	createdAt: string | null;
	_count: {
		posts: number;
		reports: number;
	};
};

type TeamMatchCard = {
	id: number;
	date: string | null;
	status: string;
	venue: string | null;
	isHome: boolean;
	opponent: {
		id: number;
		name: string;
		logoUrl: string | null;
	};
	teamScore: number | null;
	opponentScore: number | null;
};

type TeamPayload = {
	team?: {
		id: number;
		name: string;
		logoUrl: string | null;
		wins: number;
		losses: number;
		conference: string;
		division: string;
		counts: {
			fans: number;
			threads: number;
			matches: number;
		};
		threads: TeamThread[];
		matches: TeamMatchCard[];
	};
	error?: string;
};

export default function TeamDetailPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id;
	const [team, setTeam] = useState<TeamPayload['team'] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		if (!id) {
			setMissing(true);
			setLoading(false);
			return;
		}

		let cancelled = false;

		async function loadTeam() {
			try {
				setLoading(true);
				setError(null);
				setMissing(false);

				const response = await fetch(`/api/teams/${id}`, { credentials: 'include' });
				const payload: TeamPayload = await response.json();

				if (response.status === 404) {
					if (!cancelled) setMissing(true);
					return;
				}

				if (!response.ok) {
					throw new Error(payload.error || 'Failed to load team.');
				}

				if (!cancelled) {
					setTeam(payload.team || null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Failed to load team.');
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadTeam();

		return () => {
			cancelled = true;
		};
	}, [id]);

	if (missing) {
		return <StatePanel title="Team not found" description="This team page is not available right now." tone="error" />;
	}

	if (loading) {
		return <StatePanel title="Loading team" description="Pulling this team page from SportsDeck." />;
	}

	if (error || !team) {
		return <StatePanel title="Team unavailable" description={error || 'This team page could not be loaded.'} tone="error" />;
	}

	const totalGames = team.wins + team.losses;
	const winPct = totalGames > 0 ? (team.wins / totalGames).toFixed(3) : '.000';
	const resolvedDivision = resolveTeamDivision(team.name, team.division);
	const teamIdentity = getTeamIdentity(team.conference, resolvedDivision);
	const teamVenue = getTeamVenue(team.name);
	const followerLabel = `${team.counts.fans} fan${team.counts.fans === 1 ? '' : 's'}`;
	const teamDisplayName = getFullTeamName(team.name);

	return (
		<section className="space-y-6 text-[var(--foreground)]">
			<div className="theme-card rounded-[2rem] p-8 sm:p-10">
				<Link
					href="/standings"
					className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-xs uppercase tracking-[0.2em] theme-muted transition hover:border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] hover:bg-[var(--card-soft)] hover:text-[var(--foreground)]"
				>
					Back to Standings
				</Link>

				<div className="mt-6 flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] xl:items-end">
					<div className="flex min-w-0 items-start gap-5">
						<TeamLogo team={team} size="hero" />
						<div className="min-w-0 flex-1">
							<p
								className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em]"
								style={{ color: 'var(--accent)' }}
							>
								Team Profile
							</p>
							<h1 className="mt-3 max-w-[14ch] text-balance font-[family:var(--font-heading)] text-4xl font-semibold uppercase leading-[0.92] tracking-[-0.03em] text-[var(--foreground)] sm:max-w-[16ch] sm:text-5xl">{teamDisplayName}</h1>
							<p className="theme-muted mt-3 text-base">{teamVenue ? `${teamIdentity} | ${teamVenue}` : teamIdentity}</p>
						</div>
					</div>

					<div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:max-w-[28rem] xl:grid-cols-2 xl:justify-self-end 2xl:grid-cols-4">
						<StatCard label="Record" value={`${team.wins}-${team.losses}`} />
						<StatCard label="Win %" value={winPct} />
						<StatCard label="Fans" value={String(team.counts.fans)} />
						<StatCard label="Threads" value={String(team.counts.threads)} />
					</div>
				</div>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<section className="theme-card rounded-[2rem] p-6 sm:p-8">
					<div>
						<p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Overview</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">Season Snapshot</h2>
					</div>

					<div className="mt-8 grid gap-4 sm:grid-cols-2">
						<DetailTile label="Conference" value={team.conference} description="A quick read on which side of the league this team plays in." />
						<DetailTile
							label={resolvedDivision !== 'Unknown' ? 'Division' : 'Team Focus'}
							value={resolvedDivision !== 'Unknown' ? resolvedDivision : `${team.conference.replace(' Conference', '')} contender`}
							description="A quick identity card for where this team fits in the season picture."
						/>
						<DetailTile label="Home Arena" value={teamVenue || 'Venue TBD'} description="Current home venue for this franchise." />
						<DetailTile label="Games Logged" value={String(team.counts.matches)} description="Recent matchups available to explore for this team." />
						<DetailTile label="Fan Base" value={followerLabel} description="People across SportsDeck who picked this team as their favorite." />
					</div>
				</section>

				<section className="theme-card rounded-[2rem] p-6 sm:p-8">
					<p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Community</p>
					<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">Recent Threads</h2>
					<div className="mt-8 space-y-3">
						{team.threads.length > 0 ? (
							team.threads.map((thread) => (
								<Link
									key={thread.id}
									href={`/forums/${thread.id}`}
									className="block rounded-[1.4rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 transition hover:border-[color:color-mix(in_srgb,var(--accent)_24%,var(--line))] hover:bg-[var(--card-soft)]"
								>
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="font-semibold text-[var(--foreground)]">{thread.title}</p>
											<p className="theme-muted mt-2 text-sm">{formatDate(thread.createdAt)} | {thread._count.posts} posts</p>
											<p className="mt-3 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--accent)' }}>
												Open thread
											</p>
										</div>
										<span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${thread.isClosed ? 'border border-[color:var(--line)] bg-[var(--card-soft)] theme-muted' : 'border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'}`}>
											{thread.isClosed ? 'Closed' : 'Open'}
										</span>
									</div>
								</Link>
							))
						) : (
							<EmptyState message="No team-specific threads have been created yet." />
						)}
					</div>
				</section>
			</div>

			<section className="theme-card rounded-[2rem] p-6 sm:p-8">
				<p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Schedule</p>
				<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">Tracked Matchups</h2>
				<div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
					{team.matches.length > 0 ? (
						team.matches.map((match) => {
							const venueLabel = formatVenueWithArena(match.venue, match.isHome ? team.name : match.opponent.name);

							return (
								<Link
									key={match.id}
									href={`/matches/${match.id}`}
									className="block rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_24%,var(--line))] hover:bg-[var(--card-soft)]"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="theme-muted text-xs uppercase tracking-[0.16em]">{match.isHome ? 'Home' : 'Away'}</span>
										<span className="theme-muted text-xs uppercase tracking-[0.16em]">{formatMatchStatus(match.status)}</span>
									</div>
									<div className="mt-4 flex items-center gap-3">
										<TeamLogo team={team} size="card" />
										<div className="theme-muted text-sm">vs</div>
										<TeamLogo team={match.opponent} size="card" />
									</div>
									<p className="mt-4 text-lg font-semibold leading-7 text-[var(--foreground)]">
										<span className="block">{teamDisplayName}</span>
										<span className="theme-muted mt-1 block text-sm uppercase tracking-[0.16em]">{'vs'}</span>
										<span className="mt-1 block">{getFullTeamName(match.opponent.name)}</span>
									</p>
									<p className="theme-muted mt-2 text-sm">{formatDateTime(match.date)}</p>
									<p className="theme-muted mt-1 text-sm">{venueLabel || 'Venue TBD'}</p>
									<div className="mt-5 flex items-center justify-between rounded-[1.2rem] border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-3">
										<span className="theme-muted text-sm">Scoreline</span>
										<span className="font-[family:var(--font-heading)] text-xl text-[var(--foreground)]">{formatScore(match.teamScore)} - {formatScore(match.opponentScore)}</span>
									</div>
								</Link>
							);
						})
					) : (
						<EmptyState message="No recent matchups are available for this team yet." />
					)}
				</div>
			</section>
		</section>
	);
}

function TeamLogo({ team, size }: { team: { name: string; logoUrl?: string | null }; size: 'hero' | 'card' }) {
	const sizeClasses = size === 'hero' ? 'h-24 w-24 rounded-[1.8rem] p-3' : 'h-12 w-12 rounded-[1rem] p-1.5';

	if (team.logoUrl) {
		const dimension = size === 'hero' ? 96 : 48;
		return (
			<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-soft)] ${sizeClasses}`}>
				<Image src={team.logoUrl} alt={`${team.name} logo`} width={dimension} height={dimension} className="h-full w-full object-contain" />
			</div>
		);
	}

	return (
		<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-inset)] ${sizeClasses}`}>
			<span className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--accent)]">{team.name.split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2)}</span>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-[1.4rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 text-center">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-3 whitespace-nowrap font-[family:var(--font-heading)] text-[clamp(1.5rem,2vw,2rem)] font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">{value}</p>
		</div>
	);
}

function DetailTile({ label, value, description }: { label: string; value: string; description: string }) {
	return (
		<div className="rounded-[1.4rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-3 text-xl font-semibold text-[var(--foreground)]">{value}</p>
			<p className="theme-muted mt-2 text-sm leading-6">{description}</p>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return <div className="theme-muted rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-10 text-center text-sm">{message}</div>;
}

function StatePanel({ title, description, tone = 'default' }: { title: string; description: string; tone?: 'default' | 'error' }) {
	const toneClassName =
		tone === 'error'
			? 'theme-danger-panel'
			: 'theme-card';

	return (
		<div className={`rounded-[2rem] border p-8 shadow-[var(--shadow)] ${toneClassName}`}>
			<h2 className="font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">{title}</h2>
			<p className="theme-muted mt-3 max-w-2xl text-sm leading-7">{description}</p>
		</div>
	);
}

function formatDate(value: string | null) {
	if (!value) return 'Recently';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string | null) {
	if (!value) return 'Time TBD';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatMatchStatus(status: string) {
	return status.replace(/^\w/, (char) => char.toUpperCase());
}

function formatScore(score: number | null) {
	return typeof score === 'number' ? String(score) : '--';
}

function getTeamIdentity(conference: string, division: string) {
	if (division && division !== 'Unknown') {
		return `${conference} | ${division}`;
	}

	return conference;
}
