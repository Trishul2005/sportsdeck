'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getFullTeamName } from '@/app/utils/teamNames';
import { resolveTeamDivision } from '@/app/utils/teamDivision';

type Standing = {
	id?: number;
	teamId?: string | null;
	name: string;
	logoUrl?: string | null;
	abbreviation?: string | null;
	wins: number;
	losses: number;
	rank?: number | null;
	winPct?: number | null;
	gamesBack?: number | null;
	streak?: string | null;
	homeRecord?: string | null;
	awayRecord?: string | null;
	lastTenRecord?: string | null;
	pointsFor?: number | null;
	pointsAgainst?: number | null;
	conference?: string | null;
	division?: string | null;
};

type StandingsResponse = {
	leagueName?: string | null;
	abbreviation?: string | null;
	seasonType?: string | null;
	year?: string | null;
	count?: number;
	pagination?: {
		fetchedPages?: number;
		pageSize?: number;
		total?: number;
		count?: number;
	} | null;
	standings?: Standing[];
	error?: string;
};

const conferenceOrder = ['Eastern Conference', 'Western Conference'];
const conferenceRequestMap: Record<string, string | null> = {
	'Eastern Conference': 'EAST',
	'Western Conference': 'WEST',
};

type ColumnKey = 'lastTenRecord' | 'streak' | 'homeRecord' | 'awayRecord';

export default function StandingsPage() {
	const [data, setData] = useState<StandingsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [conferenceFilter, setConferenceFilter] = useState('Eastern Conference');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(3);
	const [pageInput, setPageInput] = useState('1');

	useEffect(() => {
		const controller = new AbortController();

		async function loadStandings() {
			try {
				setLoading(true);
				setError(null);

				const params = new URLSearchParams();
				const abbreviation = conferenceRequestMap[conferenceFilter];
				if (abbreviation) {
					params.set('abbreviation', abbreviation);
				}

				const response = await fetch(`/api/standings${params.size ? `?${params.toString()}` : ''}`, {
					credentials: 'include',
					signal: controller.signal,
				});
				const payload: StandingsResponse = await response.json();

				if (!response.ok) {
					throw new Error(payload?.error || 'Failed to load standings.');
				}
				setData(payload);
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') {
					return;
				}

				setError(err instanceof Error ? err.message : 'Failed to load standings.');
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		}

		loadStandings();

		return () => {
			controller.abort();
		};
	}, [conferenceFilter]);

	const filteredStandings = useMemo(() => {
		const standings = data?.standings ?? [];
		return standings.filter((standing) => standing.conference === conferenceFilter);
	}, [conferenceFilter, data]);

	useEffect(() => {
		setPage(1);
	}, [conferenceFilter]);

	useEffect(() => {
		setPageInput(String(page));
	}, [page]);

	const pageCount = Math.max(1, Math.ceil(filteredStandings.length / pageSize));

	useEffect(() => {
		setPage((currentPage) => Math.min(currentPage, pageCount));
	}, [pageCount]);

	const paginatedStandings = useMemo(() => {
		const startIndex = (page - 1) * pageSize;
		return filteredStandings.slice(startIndex, startIndex + pageSize);
	}, [filteredStandings, page, pageSize]);
	const pageRangeLabel =
		filteredStandings.length === 0
			? 'No teams in view'
			: `${(page - 1) * pageSize + 1}-${Math.min(filteredStandings.length, page * pageSize)} of ${filteredStandings.length} teams`;

	const groupedStandings = useMemo(() => {
		const grouped = new Map<string, Standing[]>();

		for (const standing of paginatedStandings) {
			const conference = standing.conference || 'League';
			if (!grouped.has(conference)) {
				grouped.set(conference, []);
			}
			grouped.get(conference)?.push(standing);
		}

		return [...grouped.entries()].sort(([a], [b]) => {
			const aIndex = conferenceOrder.indexOf(a);
			const bIndex = conferenceOrder.indexOf(b);
			if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});
	}, [paginatedStandings]);

	const visibleColumns = useMemo(() => {
		const hasValue = (key: ColumnKey) =>
			filteredStandings.some((team) => {
				const value = team[key];
				return value !== null && value !== undefined && value !== '';
			});

		return {
			lastTenRecord: hasValue('lastTenRecord'),
			streak: hasValue('streak'),
			homeRecord: hasValue('homeRecord'),
			awayRecord: hasValue('awayRecord'),
		};
	}, [filteredStandings]);

	const conferenceOptions = useMemo(
		() => conferenceOrder.map((option) => ({ label: option, value: option })),
		[],
	);

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
					Season Snapshot
				</p>
				<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em] sm:text-5xl">
					Standings
				</h1>
				<p className="theme-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">
					Live team records from the backend standings API, organized by conference with quick
					reads on form, home and away splits, and race movement.
				</p>

				<div className="theme-muted mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em]">
					<MetaPill label={data?.year || 'Current season'} />
					<MetaPill label={data?.seasonType || 'Regular Season'} />
					<MetaPill label={`${data?.count ?? data?.standings?.length ?? 0} teams`} />
				</div>

					<div className="mt-8 rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 sm:p-5">
						<div className="flex flex-col items-start gap-4 md:flex-row md:flex-wrap md:items-end">
							<FilterSelect
								label="Conference"
								value={conferenceFilter}
								onChange={setConferenceFilter}
								options={conferenceOptions}
							/>
							<FilterSelect
								label="Rows per page"
								value={String(pageSize)}
								onChange={(value) => {
									setPageSize(Number(value));
								setPage(1);
							}}
							options={[
								{ label: '3 teams', value: '3' },
									{ label: '4 teams', value: '4' },
									{ label: '5 teams', value: '5' },
								]}
							/>
							<div className="w-full space-y-2 md:w-auto">
								<span className="theme-muted block text-xs font-semibold uppercase tracking-[0.18em] opacity-0">
									Actions
								</span>
								<button
									type="button"
									onClick={() => {
										setConferenceFilter('Eastern Conference');
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

			{loading ? (
				<StatusPanel
					title="Loading standings"
					description="Pulling the latest table from the backend API."
				/>
			) : null}

			{!loading && error ? (
				<StatusPanel title="Standings unavailable" description={error} tone="error" />
			) : null}

			{!loading && !error ? (
				<div className="space-y-6">
					<div className="grid gap-4 md:grid-cols-3">
						<SummaryCard
							label="Teams tracked"
							value={String(filteredStandings.length)}
							helper="Conference filtered on the backend"
						/>
						<SummaryCard
							label="Top overall"
							value={data?.standings?.[0]?.name || 'N/A'}
							helper={
								data?.standings?.[0]
									? `${data.standings[0].wins}-${data.standings[0].losses} | ${formatPct(data.standings[0].winPct, data.standings[0].wins, data.standings[0].losses)}`
									: 'No standings available'
							}
						/>
						<SummaryCard
							label="View"
							value={`Page ${page}`}
							helper={pageRangeLabel}
						/>
					</div>

					{groupedStandings.length > 0 ? (
						groupedStandings.map(([conference, standings]) => (
							<section
								key={conference}
								className="theme-card overflow-hidden rounded-[2rem]"
							>
								<div className="border-b border-[color:var(--line)] px-6 py-5 sm:px-8">
									<div className="flex flex-wrap items-end justify-between gap-3">
										<div>
											<p className="theme-muted text-xs uppercase tracking-[0.2em]">Conference</p>
											<h2 className="mt-2 font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em]">
												{conference}
											</h2>
										</div>
										<p className="theme-muted text-sm">
											{standings.length} teams
										</p>
									</div>
								</div>

								<div className="overflow-x-auto">
									<table className="min-w-full text-left">
										<thead className="bg-[var(--card-inset)] text-[11px] uppercase tracking-[0.2em] theme-muted">
											<tr>
												<th className="px-6 py-4 sm:px-8">Rank</th>
												<th className="px-4 py-4">Team</th>
												<th className="px-4 py-4 text-right">W</th>
												<th className="px-4 py-4 text-right">L</th>
												<th className="px-4 py-4 text-right">Win %</th>
												{visibleColumns.lastTenRecord ? (
													<th className="px-4 py-4">Last 10</th>
												) : null}
												{visibleColumns.streak ? (
													<th className="px-4 py-4">Streak</th>
												) : null}
												{visibleColumns.homeRecord ? (
													<th className="px-4 py-4">Home</th>
												) : null}
												{visibleColumns.awayRecord ? (
													<th className="px-6 py-4 sm:px-8">Away</th>
												) : null}
											</tr>
										</thead>
										<tbody>
											{standings.map((team, index) => (
												<tr
													key={`${conference}-${team.teamId || team.name}`}
													className="border-t border-[color:var(--line)] text-sm text-[color:color-mix(in_srgb,var(--foreground)_78%,transparent)] transition hover:bg-[var(--card-inset)]"
												>
													<td className="px-6 py-4 sm:px-8">
														{team.teamId ? (
															<Link
																href={`/teams/${team.teamId}`}
																className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] text-sm font-semibold text-[var(--foreground)] transition hover:border-[color:color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]"
															>
																{team.rank ?? index + 1}
															</Link>
														) : (
															<div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] text-sm font-semibold text-[var(--foreground)]">
																{team.rank ?? index + 1}
															</div>
														)}
													</td>
													<td className="px-4 py-4">
														{team.teamId ? (
															<Link
																href={`/teams/${team.teamId}`}
																className="flex min-w-[220px] items-center gap-3 rounded-[1rem] transition hover:text-[var(--foreground)]"
															>
																<TeamBadge team={team} />
																<div className="min-w-0">
																	<p className="truncate font-semibold text-[var(--foreground)]">{getFullTeamName(team.name)}</p>
																	<p className="theme-muted truncate text-xs uppercase tracking-[0.16em]">
																		{getTeamSubLabel(team)}
																	</p>
																</div>
															</Link>
														) : (
															<div className="flex min-w-[220px] items-center gap-3">
																<TeamBadge team={team} />
																<div className="min-w-0">
																	<p className="truncate font-semibold text-[var(--foreground)]">{getFullTeamName(team.name)}</p>
																	<p className="theme-muted truncate text-xs uppercase tracking-[0.16em]">
																		{getTeamSubLabel(team)}
																	</p>
																</div>
															</div>
														)}
													</td>
													<td className="px-4 py-4 text-right font-semibold text-[var(--stat-win)]">{team.wins}</td>
													<td className="px-4 py-4 text-right text-[var(--stat-loss)]">{team.losses}</td>
													<td className="px-4 py-4 text-right font-semibold text-[var(--stat-pct)]">
														{formatPct(team.winPct, team.wins, team.losses)}
													</td>
													{visibleColumns.lastTenRecord ? (
														<td className="px-4 py-4">
															<span className={getRecordBadgeClassName(team.lastTenRecord)}>
																{team.lastTenRecord || '--'}
															</span>
														</td>
													) : null}
													{visibleColumns.streak ? (
														<td className="px-4 py-4">
															<span className={getStreakBadgeClassName(team.streak)}>
																{team.streak || '--'}
															</span>
														</td>
													) : null}
													{visibleColumns.homeRecord ? (
														<td className="px-4 py-4">{team.homeRecord || '--'}</td>
													) : null}
													{visibleColumns.awayRecord ? (
														<td className="px-6 py-4 sm:px-8">{team.awayRecord || '--'}</td>
													) : null}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
						))
					) : (
						<StatusPanel
							title="No standings found"
							description="The backend API returned an empty standings set for the current filters."
						/>
					)}

					{filteredStandings.length > 0 ? (
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
				</div>
			) : null}
		</section>
	);
}

function TeamBadge({ team }: { team: Standing }) {
	if (team.logoUrl) {
		return (
			<Image
				src={team.logoUrl}
				alt={`${team.name} logo`}
				width={44}
				height={44}
				className="h-11 w-11 rounded-2xl border border-[color:var(--line)] bg-[var(--card)] object-contain p-1"
			/>
		);
	}

	return (
		<div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
			{team.name
				.split(' ')
				.slice(0, 2)
				.map((part) => part[0])
				.join('')
				.slice(0, 2)}
		</div>
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
		<label className="w-full space-y-2 md:w-[14rem]">
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

function ChevronDownIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function SummaryCard({
	label,
	value,
	helper,
}: {
	label: string;
	value: string;
	helper: string;
}) {
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

function StatusPanel({
	title,
	description,
	tone = 'default',
}: {
	title: string;
	description: string;
	tone?: 'default' | 'error';
}) {
	return (
		<div
			className={`rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${
				tone === 'error'
					? 'theme-danger-panel'
					: 'border-[color:var(--line)] bg-[var(--card-soft)]'
			}`}
		>
			<h2 className="font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.02em] text-[var(--foreground)]">
				{title}
			</h2>
			<p className="theme-muted mt-3 max-w-2xl text-sm leading-7">{description}</p>
		</div>
	);
}

function MetaPill({ label }: { label: string }) {
	return (
		<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-2">
			{label}
		</span>
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

function formatPct(winPct: number | null | undefined, wins: number, losses: number) {
	if (typeof winPct === 'number' && Number.isFinite(winPct)) {
		return winPct.toFixed(3);
	}

	const totalGames = wins + losses;
	if (totalGames === 0) {
		return '.000';
	}

	return (wins / totalGames).toFixed(3);
}

function parseRecord(record: string | null | undefined) {
	if (!record) {
		return null;
	}

	const match = record.match(/^(\d+)-(\d+)$/);
	if (!match) {
		return null;
	}

	return {
		wins: Number(match[1]),
		losses: Number(match[2]),
	};
}

function getRecordBadgeClassName(record: string | null | undefined) {
	const parsed = parseRecord(record);
	if (!parsed) {
		return 'theme-muted inline-flex min-w-[3.75rem] justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-2.5 py-1 text-xs font-semibold';
	}

	const delta = parsed.wins - parsed.losses;
	if (delta >= 4) {
		return 'inline-flex min-w-[3.75rem] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold [background:var(--badge-positive-bg)] [border-color:var(--badge-positive-border)] [color:var(--badge-positive-text)]';
	}
	if (delta >= 0) {
		return 'inline-flex min-w-[3.75rem] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold [background:var(--badge-neutral-bg)] [border-color:var(--badge-neutral-border)] [color:var(--badge-neutral-text)]';
	}

	return 'inline-flex min-w-[3.75rem] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold [background:var(--badge-negative-bg)] [border-color:var(--badge-negative-border)] [color:var(--badge-negative-text)]';
}

function getStreakBadgeClassName(streak: string | null | undefined) {
	if (!streak) {
		return 'theme-muted inline-flex min-w-[3.5rem] justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-2.5 py-1 text-xs font-semibold';
	}

	if (streak.startsWith('W')) {
		return 'inline-flex min-w-[3.5rem] justify-center rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-200';
	}

	if (streak.startsWith('L')) {
		return 'inline-flex min-w-[3.5rem] justify-center rounded-full border border-rose-400/25 bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-200';
	}

	return 'inline-flex min-w-[3.5rem] justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]';
}

function getTeamSubLabel(team: Standing) {
	const resolvedDivision = resolveTeamDivision(team.name, team.division);
	if (resolvedDivision !== 'Unknown') {
		return resolvedDivision;
	}

	if (team.abbreviation) {
		return team.abbreviation;
	}

	if (team.conference) {
		return team.conference.replace(' Conference', '');
	}

	return 'NBA';
}
