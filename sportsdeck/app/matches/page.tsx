'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatVenueWithArena } from '@/app/utils/teamVenues';

type MatchCardData = {
	id: number;
	tipOff: string | null;
	status: string;
	venue: string | null;
	score: {
		home: number | null;
		away: number | null;
	};
	homeTeamLogoUrl: string | null;
	awayTeamLogoUrl: string | null;
	homeTeam: string | null;
	awayTeam: string | null;
	sentiment?: {
		overall: number | null;
		numPosts: number;
	} | null;
	thread?: {
		id: number;
		isClosed: boolean;
	} | null;
};

type MatchesResponse = {
	matches?: MatchCardData[];
	error?: string;
};

export default function MatchesPage() {
	const [matches, setMatches] = useState<MatchCardData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [teamFilter, setTeamFilter] = useState('all');
	const [statusFilter, setStatusFilter] = useState('upcoming');
	const [dateFilter, setDateFilter] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(3);
	const [pageInput, setPageInput] = useState('1');
	const [currentTime, setCurrentTime] = useState(() => Date.now());

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setCurrentTime(Date.now());
		}, 60 * 1000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		async function loadMatches() {
			try {
				setLoading(true);
				setError(null);

				const today = new Date();
				const pastWindowStart = addDays(today, -13);
				const futureWindowEnd = addDays(today, 13);
				const yesterday = addDays(today, -1);
				const [recentResponse, currentResponse] = await Promise.all([
					fetch(
						`/api/matches?fromDate=${formatIsoDate(pastWindowStart)}&toDate=${formatIsoDate(yesterday)}&limit=100`,
						{ credentials: 'include' },
					),
					fetch(
						`/api/matches?fromDate=${formatIsoDate(today)}&toDate=${formatIsoDate(futureWindowEnd)}&limit=100`,
						{ credentials: 'include' },
					),
				]);
				const recentPayload: MatchesResponse = await recentResponse.json();
				const currentPayload: MatchesResponse = await currentResponse.json();

				if (!recentResponse.ok) {
					throw new Error(recentPayload.error || 'Failed to load recent matches.');
				}

				if (!currentResponse.ok) {
					throw new Error(currentPayload.error || 'Failed to load upcoming matches.');
				}

				if (!cancelled) {
					setMatches(
						mergeMatches(
							Array.isArray(currentPayload.matches) ? currentPayload.matches : [],
							Array.isArray(recentPayload.matches) ? recentPayload.matches : [],
						),
					);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Failed to load matches.');
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadMatches();

		return () => {
			cancelled = true;
		};
	}, []);

	const filteredMatches = useMemo(
		() =>
			matches.filter((match) => {
				const bucket = getDisplayBucket(match, currentTime);
				const matchesTeam =
					teamFilter === 'all' ||
					match.homeTeam === teamFilter ||
					match.awayTeam === teamFilter;
				const matchesStatus = bucket === statusFilter;
				const matchesDate =
					!dateFilter || getLocalDateInputValue(match.tipOff) === dateFilter;
				return matchesTeam && matchesStatus && matchesDate;
			}),
		[currentTime, dateFilter, matches, statusFilter, teamFilter],
	);

	useEffect(() => {
		setPage(1);
	}, [dateFilter, statusFilter, teamFilter]);

	useEffect(() => {
		setPageInput(String(page));
	}, [page]);

	const liveMatches = useMemo(
		() =>
			filteredMatches
				.filter((match) => getDisplayBucket(match, currentTime) === 'live')
				.sort((a, b) => compareMatchTimes(a.tipOff, b.tipOff)),
		[currentTime, filteredMatches],
	);
	const upcomingMatches = useMemo(
		() =>
			filteredMatches
				.filter((match) => getDisplayBucket(match, currentTime) === 'upcoming')
				.sort((a, b) => compareMatchTimes(a.tipOff, b.tipOff)),
		[currentTime, filteredMatches],
	);
	const completedMatches = useMemo(
		() =>
			filteredMatches
				.filter((match) => getDisplayBucket(match, currentTime) === 'finished')
				.sort((a, b) => compareMatchTimes(b.tipOff, a.tipOff)),
		[currentTime, filteredMatches],
	);
	const paginatedLiveMatches = useMemo(() => {
		const startIndex = (page - 1) * pageSize;
		return liveMatches.slice(startIndex, startIndex + pageSize);
	}, [liveMatches, page, pageSize]);
	const paginatedUpcomingMatches = useMemo(() => {
		const startIndex = (page - 1) * pageSize;
		return upcomingMatches.slice(startIndex, startIndex + pageSize);
	}, [page, pageSize, upcomingMatches]);
	const paginatedCompletedMatches = useMemo(() => {
		const startIndex = (page - 1) * pageSize;
		return completedMatches.slice(startIndex, startIndex + pageSize);
	}, [completedMatches, page, pageSize]);
	const pageCount = useMemo(() => {
		if (statusFilter === 'live') {
			return Math.max(1, Math.ceil(liveMatches.length / pageSize));
		}

		if (statusFilter === 'upcoming') {
			return Math.max(1, Math.ceil(upcomingMatches.length / pageSize));
		}

		if (statusFilter === 'finished') {
			return Math.max(1, Math.ceil(completedMatches.length / pageSize));
		}

		return Math.max(1, Math.ceil(upcomingMatches.length / pageSize));
	}, [completedMatches.length, liveMatches.length, pageSize, statusFilter, upcomingMatches.length]);

	useEffect(() => {
		setPage((currentPage) => Math.min(currentPage, pageCount));
	}, [pageCount]);
	const featuredMatch = liveMatches[0] || upcomingMatches[0] || completedMatches[0] || null;
	const featuredVenue = formatVenueWithArena(featuredMatch?.venue, featuredMatch?.homeTeam);
	const visibleColumns = useMemo(() => {
		if (statusFilter === 'live') {
			return [
				{
					key: 'live',
					title: 'Live',
					accent: 'Live right now',
					matches: paginatedLiveMatches,
					emptyMessage: 'No live games at the moment.',
				},
			];
		}

		if (statusFilter === 'upcoming') {
			return [
				{
					key: 'upcoming',
					title: 'Upcoming',
					accent: 'Coming up next',
					matches: paginatedUpcomingMatches,
					emptyMessage: 'No upcoming games are currently stored.',
				},
			];
		}

		if (statusFilter === 'finished') {
			return [
				{
					key: 'finished',
					title: 'Recently Finished',
					accent: 'Latest results',
					matches: paginatedCompletedMatches,
					emptyMessage: 'No completed games are available yet.',
				},
			];
		}

		return [
			{
				key: 'upcoming',
				title: 'Upcoming',
				accent: 'Coming up next',
				matches: paginatedUpcomingMatches,
				emptyMessage: 'No upcoming games are currently stored.',
			},
		];
	}, [
		paginatedCompletedMatches,
		paginatedLiveMatches,
		paginatedUpcomingMatches,
		statusFilter,
	]);
	const teamOptions = useMemo(() => {
		const options = [...new Set(
			matches.flatMap((match) => [match.homeTeam, match.awayTeam]).filter(Boolean),
		)];
		return options.sort((a, b) => String(a).localeCompare(String(b)));
	}, [matches]);

	const commitPageInput = () => {
		const parsed = parseInt(pageInput, 10);
		if (Number.isNaN(parsed)) {
			setPageInput(String(page));
			return;
		}

		const cappedPage = Math.min(Math.max(1, parsed), Math.max(1, pageCount));
		setPage(cappedPage);
		setPageInput(String(cappedPage));
	};

	return (
		<section className="space-y-6">
			<header className="theme-card rounded-[2rem] p-8 sm:p-10">
					<p className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
						Game Center
					</p>
					<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em] sm:text-5xl">
						Matches
					</h1>
					<p className="theme-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">
						Track live action, upcoming tip-offs, and recently finished games in one place. Open any matchup
						for a bigger view with scores, fan conversation, and the teams involved.
					</p>

					<div className="mt-8 grid gap-4 md:grid-cols-4">
						<SummaryCard label="Live Now" value={String(liveMatches.length)} helper="Games currently in progress" />
						<SummaryCard label="Up Next" value={String(upcomingMatches.length)} helper="Scheduled matchups ahead" />
						<SummaryCard label="Finished" value={String(completedMatches.length)} helper="Games that have wrapped up" />
						<SummaryCard label="Tracked" value={String(filteredMatches.length)} helper="Games in the current filtered view" />
					</div>

					<div className="mt-8 rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 sm:p-5">
						<div className="flex flex-col items-start gap-4 md:flex-row md:flex-wrap md:items-end">
							<FilterSelect
								label="Team"
								value={teamFilter}
								onChange={setTeamFilter}
								options={[
									{ label: 'All teams', value: 'all' },
									...teamOptions.map((option) => ({ label: String(option), value: String(option) })),
								]}
							/>
							<FilterSelect
								label="Status"
								value={statusFilter}
								onChange={setStatusFilter}
								options={[
									{ label: 'Live', value: 'live' },
									{ label: 'Upcoming', value: 'upcoming' },
									{ label: 'Finished', value: 'finished' },
								]}
							/>
							<DateFilterInput
								label="Date"
								value={dateFilter}
								onChange={(value) => {
									setDateFilter(value);
									setPage(1);
								}}
							/>
							<FilterSelect
								label="Cards per page"
								value={String(pageSize)}
								onChange={(value) => {
									setPageSize(Number(value));
									setPage(1);
								}}
								options={[
									{ label: '3 games', value: '3' },
									{ label: '4 games', value: '4' },
									{ label: '5 games', value: '5' },
								]}
							/>
							<div className="w-full space-y-2 md:w-auto">
								<span className="theme-muted block text-xs font-semibold uppercase tracking-[0.18em] opacity-0">
									Actions
								</span>
								<button
									type="button"
									onClick={() => {
										setTeamFilter('all');
										setStatusFilter('upcoming');
										setDateFilter('');
										setPage(1);
									}}
									className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.16em] theme-muted transition hover:bg-[var(--card-soft)]"
								>
									Reset filters
								</button>
							</div>
						</div>
					</div>
			</header>

			{loading ? <EmptyState message="Loading the latest matchups from SportsDeck." /> : null}
			{!loading && error ? <EmptyState message={error} tone="error" /> : null}

			{!loading && !error ? (
				<>
					{featuredMatch ? (
						<Link
							href={`/matches/${featuredMatch.id}`}
							className="theme-card block rounded-[2rem] p-6 transition hover:border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] sm:p-8"
						>
							<div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
								<div>
									<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Featured Match</p>
									<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">
										{featuredMatch.awayTeam} at {featuredMatch.homeTeam}
									</h2>
									<p className="theme-muted mt-3 text-sm">
										{formatDateTime(featuredMatch.tipOff)} | {featuredVenue || 'Venue TBD'}
									</p>
								</div>

								<div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
									<TeamSide name={featuredMatch.awayTeam} logoUrl={featuredMatch.awayTeamLogoUrl} score={featuredMatch.score.away} align="right" />
									<div className="rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-xs uppercase tracking-[0.18em] theme-muted">
										{formatMatchStatus(featuredMatch, currentTime)}
									</div>
									<TeamSide name={featuredMatch.homeTeam} logoUrl={featuredMatch.homeTeamLogoUrl} score={featuredMatch.score.home} align="left" />
								</div>
							</div>
						</Link>
					) : null}

					{filteredMatches.length > 0 ? (
						<div
							className={`grid gap-6 ${
								visibleColumns.length >= 3
									? 'xl:grid-cols-3'
									: visibleColumns.length === 2
										? 'xl:grid-cols-2'
										: 'grid-cols-1'
							}`}
						>
							{visibleColumns.map((column) => (
								<MatchColumn
									key={column.key}
									title={column.title}
									accent={column.accent}
									matches={column.matches}
									emptyMessage={column.emptyMessage}
									currentTime={currentTime}
								/>
							))}
						</div>
					) : (
						<EmptyState message="No matches fit the current filters right now. Try another team or game state." />
					)}

					{filteredMatches.length > 0 ? (
						<PaginationControls
							page={page}
							pageCount={pageCount}
							pageInput={pageInput}
							onPageInputChange={setPageInput}
							onPageInputCommit={commitPageInput}
							onPrevious={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
							onNext={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
						/>
					) : null}
				</>
			) : null}
		</section>
	);
}

function FilterSelect({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { label: string; value: string }[];
}) {
	return (
		<label className="w-full space-y-2 md:w-[11rem]">
			<span className="theme-muted block text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
			<div className="relative">
				<select
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="theme-input theme-select w-full rounded-2xl px-4 py-2.5 pr-10 text-sm font-medium text-[var(--foreground)] outline-none transition"
				>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<div className="theme-muted pointer-events-none absolute inset-y-0 right-4 flex items-center">
					<ChevronDownIcon />
				</div>
			</div>
		</label>
	);
}

function DateFilterInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="w-full space-y-2 md:w-[11rem]">
			<span className="theme-muted block text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
			<input
				type="date"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="theme-input w-full rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none transition"
			/>
		</label>
	);
}

function ChevronDownIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function MatchColumn({
	title,
	accent,
	matches,
	emptyMessage,
	currentTime,
}: {
	title: string;
	accent: string;
	matches: MatchCardData[];
	emptyMessage: string;
	currentTime: number;
}) {
	return (
		<section className="theme-card rounded-[2rem] p-6">
			<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">{accent}</p>
			<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em] text-[var(--foreground)]">{title}</h2>
			<div className="mt-6 space-y-4">
				{matches.length > 0 ? matches.map((match) => <MatchCard key={getMatchKey(match)} match={match} currentTime={currentTime} />) : <EmptyState message={emptyMessage} compact />}
			</div>
		</section>
	);
}

function MatchCard({ match, currentTime }: { match: MatchCardData; currentTime: number }) {
	const venueLabel = formatVenueWithArena(match.venue, match.homeTeam);

	return (
		<Link href={`/matches/${match.id}`} className="block rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_25%,transparent)] hover:bg-[color:var(--card-soft)]">
			<div className="flex items-center justify-between gap-3">
				<span className="theme-muted text-xs uppercase tracking-[0.16em]">{formatMatchStatus(match, currentTime)}</span>
				<span className="theme-muted text-xs uppercase tracking-[0.16em]">{match.thread ? (match.thread.isClosed ? 'Thread Closed' : 'Thread Open') : 'No Thread'}</span>
			</div>
			<div className="mt-5 space-y-4">
				<TeamRow name={match.awayTeam} logoUrl={match.awayTeamLogoUrl} score={match.score.away} />
				<TeamRow name={match.homeTeam} logoUrl={match.homeTeamLogoUrl} score={match.score.home} />
			</div>
			<div className="mt-5 border-t border-[color:var(--line)] pt-4">
				<p className="theme-muted text-sm">{formatDateTime(match.tipOff)}</p>
				<p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--foreground)_50%,transparent)]">{venueLabel || 'Venue TBD'}</p>
			</div>
		</Link>
	);
}

function TeamRow({ name, logoUrl, score }: { name: string | null; logoUrl: string | null; score: number | null }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-3">
				<TeamLogo name={name} logoUrl={logoUrl} />
				<span className="truncate font-semibold text-[var(--foreground)]">{name || 'Team TBD'}</span>
			</div>
			<span className="font-[family:var(--font-heading)] text-2xl text-[var(--foreground)]">{formatScore(score)}</span>
		</div>
	);
}

function TeamSide({ name, logoUrl, score, align }: { name: string | null; logoUrl: string | null; score: number | null; align: 'left' | 'right' }) {
	return (
		<div className={`flex items-center gap-4 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
			<TeamLogo name={name} logoUrl={logoUrl} hero />
			<div>
				<p className="font-semibold text-[var(--foreground)]">{name || 'Team TBD'}</p>
				<p className="mt-1 font-[family:var(--font-heading)] text-4xl text-[var(--foreground)]">{formatScore(score)}</p>
			</div>
		</div>
	);
}

function TeamLogo({ name, logoUrl, hero = false }: { name: string | null; logoUrl: string | null; hero?: boolean }) {
	const size = hero ? 64 : 44;
	const classes = hero ? 'h-16 w-16 rounded-[1.4rem] p-2.5' : 'h-11 w-11 rounded-[1rem] p-1.5';

	if (logoUrl) {
		return (
			<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card)] ${classes}`}>
				<Image src={logoUrl} alt={`${name || 'Team'} logo`} width={size} height={size} className="h-full w-full object-contain" />
			</div>
		);
	}

	return (
		<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-inset)] ${classes}`}>
			<span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">{getInitials(name)}</span>
		</div>
	);
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
	return (
		<div className="theme-card rounded-[1.6rem] p-5">
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">{value}</p>
			<p className="theme-muted mt-2 text-sm">{helper}</p>
		</div>
	);
}

function EmptyState({ message, compact = false, tone = 'default' }: { message: string; compact?: boolean; tone?: 'default' | 'error' }) {
	return (
		<div className={`rounded-[1.6rem] border text-center ${compact ? 'px-5 py-8 text-sm' : 'px-6 py-12 text-base'} ${tone === 'error' ? 'theme-danger-panel' : 'border-dashed border-[color:var(--line)] bg-[var(--card-inset)] theme-muted'}`}>
			{message}
		</div>
	);
}

function PaginationControls({
	page,
	pageCount,
	pageInput,
	onPageInputChange,
	onPageInputCommit,
	onPrevious,
	onNext,
}: {
	page: number;
	pageCount: number;
	pageInput: string;
	onPageInputChange: (value: string) => void;
	onPageInputCommit: () => void;
	onPrevious: () => void;
	onNext: () => void;
}) {
	return (
		<div className="mt-8 flex items-center justify-between gap-4">
			<button
				type="button"
				disabled={page === 1}
				onClick={onPrevious}
				className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				← Previous
			</button>

			<div className="flex items-center gap-2">
				<span className="theme-muted text-sm">
					Page <span className="font-semibold text-[var(--foreground)]">{page}</span> of{' '}
					<span className="font-semibold text-[var(--foreground)]">{pageCount}</span>
				</span>
				<input
					type="number"
					value={pageInput}
					onChange={(event) => onPageInputChange(event.target.value)}
					onBlur={onPageInputCommit}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							onPageInputCommit();
						}
					}}
					min={1}
					max={pageCount}
					className="w-16 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-2 py-1 text-center text-sm outline-none"
				/>
				<button
					type="button"
					onClick={onPageInputCommit}
					className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-sm font-semibold transition hover:bg-[var(--card-soft)]"
				>
					Go
				</button>
			</div>

			<button
				type="button"
				disabled={page >= pageCount}
				onClick={onNext}
				className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				Next →
			</button>
		</div>
	);
}

function formatDateTime(value: string | null) {
	if (!value) return 'Time TBD';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Time TBD';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function getLocalDateInputValue(value: string | null) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatMatchStatus(match: MatchCardData, currentTime: number) {
	const bucket = getDisplayBucket(match, currentTime);
	if (bucket === 'live') return 'Live';
	if (bucket === 'finished') return 'Finished';
	return 'Scheduled';
}

function formatScore(score: number | null) {
	return typeof score === 'number' ? String(score) : '--';
}

function getInitials(name: string | null) {
	if (!name) return 'TM';
	return name.split(' ').slice(0, 2).map((part) => part[0]).join('').slice(0, 2);
}

function mergeMatches(primary: MatchCardData[], secondary: MatchCardData[]) {
	const seen = new Map<string, MatchCardData>();

	for (const match of [...primary, ...secondary]) {
		const key = getMatchKey(match);
		const existing = seen.get(key);
		seen.set(key, existing ? mergeMatchCardData(existing, match) : match);
	}

	return [...seen.values()];
}

function mergeMatchCardData(existing: MatchCardData, incoming: MatchCardData): MatchCardData {
	const pickDefined = <T,>(current: T, next: T) => (next ?? current);

	return {
		...existing,
		...incoming,
		tipOff: pickDefined(existing.tipOff, incoming.tipOff),
		status: pickDefined(existing.status, incoming.status),
		venue: pickDefined(existing.venue, incoming.venue),
		homeTeamLogoUrl: pickDefined(existing.homeTeamLogoUrl, incoming.homeTeamLogoUrl),
		awayTeamLogoUrl: pickDefined(existing.awayTeamLogoUrl, incoming.awayTeamLogoUrl),
		homeTeam: pickDefined(existing.homeTeam, incoming.homeTeam),
		awayTeam: pickDefined(existing.awayTeam, incoming.awayTeam),
		score: {
			home: pickDefined(existing.score?.home, incoming.score?.home),
			away: pickDefined(existing.score?.away, incoming.score?.away),
		},
		sentiment: incoming.sentiment ?? existing.sentiment ?? null,
		thread: incoming.thread ?? existing.thread ?? null,
	};
}

function getMatchKey(match: MatchCardData) {
	if (typeof match.id === 'number' && Number.isFinite(match.id)) {
		return String(match.id);
	}

	return [match.tipOff, match.awayTeam, match.homeTeam, match.status].filter(Boolean).join('|');
}

function getDisplayBucket(match: MatchCardData, currentTime: number) {
	if (match.status === 'finished') {
		return 'finished';
	}

	const tipOffTime = getTipOffTime(match.tipOff);
	if (!tipOffTime) {
		return match.status === 'live' ? 'live' : 'upcoming';
	}

	const scheduledEnd = tipOffTime + 3 * 60 * 60 * 1000;

	if (currentTime >= scheduledEnd) {
		return 'finished';
	}

	if (match.status === 'live' || (currentTime >= tipOffTime && currentTime < scheduledEnd)) {
		return 'live';
	}

	if (currentTime < tipOffTime) {
		return 'upcoming';
	}

	return 'finished';
}

function getTipOffTime(value: string | null) {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function compareMatchTimes(a: string | null, b: string | null) {
	return (getTipOffTime(a) ?? 0) - (getTipOffTime(b) ?? 0);
}

function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function formatIsoDate(date: Date) {
	return date.toISOString().slice(0, 10);
}
