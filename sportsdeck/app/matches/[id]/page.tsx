'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatVenueWithArena } from '@/app/utils/teamVenues';

type TeamSummary = {
	id: number;
	name: string;
	logoUrl: string | null;
	wins: number;
	losses: number;
	conference: string;
};

type MatchPayload = {
	match?: {
		id: number;
		date: string | null;
		venue: string | null;
		status: string;
		homeScore: number | null;
		awayScore: number | null;
		homeTeam: TeamSummary;
		awayTeam: TeamSummary;
		thread: {
			id: number;
			title: string;
			isClosed: boolean;
			createdAt: string;
			_count: {
				posts: number;
			};
		} | null;
		sentiment: {
			overall: number | null;
			numPosts: number;
		} | null;
	};
	error?: string;
};

export default function MatchDetailPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id;
	const [match, setMatch] = useState<MatchPayload['match'] | null>(null);
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

		async function loadMatch() {
			try {
				setLoading(true);
				setError(null);
				setMissing(false);

				const response = await fetch(`/api/matches/${id}`, { credentials: 'include' });
				const payload: MatchPayload = await response.json();

				if (response.status === 404) {
					if (!cancelled) setMissing(true);
					return;
				}

				if (!response.ok) {
					throw new Error(payload.error || 'Failed to load match.');
				}

				if (!cancelled) {
					setMatch(payload.match || null);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Failed to load match.');
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadMatch();

		return () => {
			cancelled = true;
		};
	}, [id]);

	if (missing) {
		return <StatePanel title="Match not found" description="This matchup is not available right now." tone="error" />;
	}

	if (loading) {
		return <StatePanel title="Loading match" description="Pulling the latest game view from SportsDeck." />;
	}

	if (error || !match) {
		return <StatePanel title="Match unavailable" description={error || 'This matchup could not be loaded.'} tone="error" />;
	}

	const venueLabel = formatVenueWithArena(match.venue, match.homeTeam.name);

	return (
		<section className="space-y-6 text-[var(--foreground)]">
			<div className="theme-card rounded-[2rem] p-8 sm:p-10">
				<Link
					href="/matches"
					className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-xs uppercase tracking-[0.2em] theme-muted transition hover:border-[color:color-mix(in_srgb,var(--accent)_28%,var(--line))] hover:bg-[var(--card-soft)] hover:text-[var(--foreground)]"
				>
					Back to Matches
				</Link>

				<div className="mt-8 grid gap-8 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
					<HeroTeamCard team={match.awayTeam} score={match.awayScore} align="right" />
					<div className="text-center">
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Game Status</p>
						<p className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">
							{formatMatchStatus(match.status)}
						</p>
						<p className="theme-muted mt-3 text-sm">{formatDateTime(match.date)}</p>
						<p className="theme-muted mt-1 text-sm">{venueLabel || 'Venue TBD'}</p>
					</div>
					<HeroTeamCard team={match.homeTeam} score={match.homeScore} align="left" />
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<DetailCard label="Matchup" value={`${match.awayTeam.name} at ${match.homeTeam.name}`} description="The full head-to-head for this game." />
				<DetailCard label="Score" value={`${formatScore(match.awayScore)} - ${formatScore(match.homeScore)}`} description="The latest scoreboard for both teams." />
				<DetailCard
					label="Fan Pulse"
					value={match.sentiment ? formatFanPulse(match.sentiment.overall) : 'Waiting'}
					description={match.sentiment ? `${match.sentiment.numPosts} posts shaped this read.` : 'This will update as fans react to the game.'}
				/>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
				<section className="theme-card rounded-[2rem] p-6 sm:p-8">
					<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Teams</p>
					<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">Game Breakdown</h2>
					<div className="mt-8 grid gap-4">
						<TeamBreakdown team={match.awayTeam} score={match.awayScore} side="Away" />
						<TeamBreakdown team={match.homeTeam} score={match.homeScore} side="Home" />
					</div>
				</section>

				<section className="theme-card rounded-[2rem] p-6 sm:p-8">
					<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Conversation</p>
					<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">Discussion Thread</h2>
					<div className="mt-8">
						{match.thread ? (
							<Link href={`/forums/${match.thread.id}`} className="block rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[var(--card-soft)]">
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className="font-semibold text-[var(--foreground)]">{match.thread.title}</p>
										<p className="theme-muted mt-2 text-sm">
											{match.thread._count.posts} posts | {formatDate(match.thread.createdAt)}
										</p>
										<p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
											Open thread
										</p>
									</div>
									<span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${match.thread.isClosed ? 'border border-[color:var(--line)] bg-[var(--card-soft)] theme-muted' : 'border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'}`}>
										{match.thread.isClosed ? 'Closed' : 'Open'}
									</span>
								</div>
							</Link>
						) : (
							<EmptyState message="A match thread has not been created for this game yet." />
						)}
					</div>
				</section>
			</div>
		</section>
	);
}

function HeroTeamCard({ team, score, align }: { team: TeamSummary; score: number | null; align: 'left' | 'right' }) {
	return (
		<Link href={`/teams/${team.id}`} className={`rounded-[1.8rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] hover:bg-[var(--card-soft)] ${align === 'right' ? 'xl:text-right' : ''}`}>
			<div className={`flex items-center gap-4 ${align === 'right' ? 'xl:flex-row-reverse' : ''}`}>
				<TeamLogo team={team} hero />
				<div>
					<p className="font-semibold text-[var(--foreground)]">{team.name}</p>
					<p className="theme-muted mt-1 text-sm">{team.wins}-{team.losses} | {team.conference.replace(' Conference', '')}</p>
					<p className="mt-3 font-[family:var(--font-heading)] text-5xl text-[var(--foreground)]">{formatScore(score)}</p>
				</div>
			</div>
		</Link>
	);
}

function TeamBreakdown({ team, score, side }: { team: TeamSummary; score: number | null; side: 'Home' | 'Away' }) {
	return (
		<Link href={`/teams/${team.id}`} className="block rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] hover:bg-[var(--card-soft)]">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<TeamLogo team={team} />
					<div>
						<p className="theme-muted text-xs uppercase tracking-[0.16em]">{side}</p>
						<p className="mt-1 font-semibold text-[var(--foreground)]">{team.name}</p>
						<p className="theme-muted mt-1 text-sm">{team.wins}-{team.losses} | {team.conference.replace(' Conference', '')}</p>
					</div>
				</div>
				<div className="text-right">
					<p className="font-[family:var(--font-heading)] text-3xl text-[var(--foreground)]">{formatScore(score)}</p>
					<p className="theme-muted text-xs uppercase tracking-[0.16em]">View team</p>
				</div>
			</div>
		</Link>
	);
}

function TeamLogo({ team, hero = false }: { team: { name: string; logoUrl: string | null }; hero?: boolean }) {
	const size = hero ? 72 : 48;
	const classes = hero ? 'h-[4.5rem] w-[4.5rem] rounded-[1.5rem] p-2.5' : 'h-12 w-12 rounded-[1rem] p-1.5';

	if (team.logoUrl) {
		return (
			<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-soft)] ${classes}`}>
				<Image src={team.logoUrl} alt={`${team.name} logo`} width={size} height={size} className="h-full w-full object-contain" />
			</div>
		);
	}

	return (
		<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-inset)] ${classes}`}>
			<span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">{team.name.split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2)}</span>
		</div>
	);
}

function DetailCard({ label, value, description }: { label: string; value: string; description: string }) {
	return (
		<div className="theme-card rounded-[1.6rem] p-5">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">{value}</p>
			<p className="theme-muted mt-2 text-sm">{description}</p>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return <div className="theme-muted rounded-[1.6rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-8 text-center text-sm">{message}</div>;
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

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string | null) {
	if (!value) return 'Time TBD';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Time TBD';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatMatchStatus(status: string) {
	return status.replace(/^\w/, (char) => char.toUpperCase());
}

function formatScore(score: number | null) {
	return typeof score === 'number' ? String(score) : '--';
}

function formatFanPulse(value: number | null) {
	if (typeof value !== 'number') return 'Waiting';
	if (value >= 0.35) return 'Strongly Positive';
	if (value >= 0.1) return 'Positive';
	if (value <= -0.35) return 'Strongly Negative';
	if (value <= -0.1) return 'Negative';
	return 'Mixed';
}
