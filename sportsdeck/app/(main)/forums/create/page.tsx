'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type TeamOption = {
	id: number;
	name: string;
};

type MatchOption = {
	id: number;
	date: string | null;
	homeTeamName: string;
	awayTeamName: string;
	homeTeamId: number | null;
	awayTeamId: number | null;
};

type ThreadMode = 'discussion' | 'poll';

type ApiMatch = {
	id?: number;
	matchId?: string | number;
	date?: string | null;
	tipOff?: string | null;
	homeTeam?: { id?: number; name?: string } | string | null;
	awayTeam?: { id?: number; name?: string } | string | null;
	homeTeamId?: number | null;
	awayTeamId?: number | null;
};

function isoDay(value: Date) {
	return value.toISOString().slice(0, 10);
}

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

function dateTimeLabel(value: string | null | undefined) {
	if (!value) return 'Unknown date';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Unknown date';
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

function CreateThreadPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [threadMode, setThreadMode] = useState<ThreadMode>('discussion');
	const [pollQuestion, setPollQuestion] = useState('');
	const [pollDeadlineDate, setPollDeadlineDate] = useState('');
	const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
	const [teams, setTeams] = useState<TeamOption[]>([]);
	const [matches, setMatches] = useState<MatchOption[]>([]);
	const [selectedTeamId, setSelectedTeamId] = useState('');
	const [selectedMatchId, setSelectedMatchId] = useState('');
	const [matchQuery, setMatchQuery] = useState('');
	const [isMatchDropdownOpen, setIsMatchDropdownOpen] = useState(false);
	const [isLoadingTeams, setIsLoadingTeams] = useState(true);
	const [isLoadingMatches, setIsLoadingMatches] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [metaMessage, setMetaMessage] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');
	const [tagSuggestions, setTagSuggestions] = useState<Array<{ id: number; name: string }>>([]);
	const [liveTagSuggestions, setLiveTagSuggestions] = useState<Array<{ id: number; name: string }>>([]);
	const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
	const [tagLoading, setTagLoading] = useState(false);
	const matchDropdownRef = useRef<HTMLDivElement | null>(null);

	const selectedTeamName = useMemo(() => {
		const id = parseInt(selectedTeamId, 10);
		if (Number.isNaN(id)) return null;
		return teams.find((team) => team.id === id)?.name || null;
	}, [selectedTeamId, teams]);

	const filteredMatches = useMemo(() => {
		const query = matchQuery.trim().toLowerCase();
		if (!query) return matches;
		return matches.filter((match) => {
			const haystack = `${match.awayTeamName} ${match.homeTeamName} ${dateTimeLabel(match.date)}`.toLowerCase();
			return haystack.includes(query);
		});
	}, [matchQuery, matches]);

	const selectedMatch = useMemo(() => {
		if (!selectedMatchId) return null;
		return matches.find((match) => String(match.id) === selectedMatchId) || null;
	}, [matches, selectedMatchId]);

	useEffect(() => {
		if (!isMatchDropdownOpen) return;

		function handleOutsideClick(event: MouseEvent) {
			if (!matchDropdownRef.current) return;
			if (matchDropdownRef.current.contains(event.target as Node)) return;
			setIsMatchDropdownOpen(false);
		}

		document.addEventListener('mousedown', handleOutsideClick);
		return () => {
			document.removeEventListener('mousedown', handleOutsideClick);
		};
	}, [isMatchDropdownOpen]);

	useEffect(() => {
		let isMounted = true;

		async function loadTeams() {
			setIsLoadingTeams(true);
			setMetaMessage('');
			try {
				const res = await fetch('/api/teams?limit=50', { cache: 'no-store' });
				const data = await res.json().catch(() => null);
				if (!isMounted) return;
				const loadedTeams = Array.isArray(data?.teams)
					? data.teams
							.map((team: { id?: number; name?: string }) => ({
								id: team.id,
								name: team.name,
							}))
							.filter((team: TeamOption) => Number.isInteger(team.id) && typeof team.name === 'string')
					: [];

				setTeams(loadedTeams);

				const queryTeamId = parseInt(searchParams.get('teamId') || '', 10);
				if (Number.isInteger(queryTeamId) && loadedTeams.some((team: TeamOption) => team.id === queryTeamId)) {
					setSelectedTeamId(String(queryTeamId));
				}
			} catch {
				if (!isMounted) return;
				setMetaMessage('Unable to load teams right now.');
			} finally {
				if (isMounted) setIsLoadingTeams(false);
			}
		}

		void loadTeams();
		return () => {
			isMounted = false;
		};
	}, [searchParams]);

	useEffect(() => {
		let isMounted = true;

		function normalizeTeamName(value: ApiMatch['homeTeam'] | ApiMatch['awayTeam'], fallback: string) {
			if (typeof value === 'string' && value.trim()) return value.trim();
			if (value && typeof value === 'object' && typeof value.name === 'string' && value.name.trim()) {
				return value.name.trim();
			}
			return fallback;
		}

		async function loadMatchesForTeam() {
			setMatches([]);
			setSelectedMatchId('');
			setMatchQuery('');
			setIsMatchDropdownOpen(false);
			if (!selectedTeamId) return;

			const today = new Date();
			// Keep date window <= 14 days, matching /api/matches validation.
			const fromDate = isoDay(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
			const toDate = isoDay(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));

			setIsLoadingMatches(true);
			try {
				const qs = new URLSearchParams({
					fromDate,
					toDate,
					limit: '100',
				});
				const res = await fetch(`/api/matches?${qs.toString()}`, { cache: 'no-store' });
				const data = await res.json().catch(() => null);
				if (!res.ok) {
					const reason = data?.error ? `: ${data.error}` : '.';
					throw new Error(`Unable to load matches${reason}`);
				}
				if (!isMounted) return;
				const rawMatches = Array.isArray(data?.matches)
					? data.matches
							.map((match: ApiMatch) => {
								const id = Number(match.id ?? match.matchId);
								const date = match.date || match.tipOff || null;
								return {
									id,
									date,
									homeTeamName: normalizeTeamName(match.homeTeam, 'Home Team'),
									awayTeamName: normalizeTeamName(match.awayTeam, 'Away Team'),
									homeTeamId:
										typeof match.homeTeamId === 'number'
											? match.homeTeamId
											: match.homeTeam && typeof match.homeTeam === 'object' && typeof match.homeTeam.id === 'number'
												? match.homeTeam.id
												: null,
									awayTeamId:
										typeof match.awayTeamId === 'number'
											? match.awayTeamId
											: match.awayTeam && typeof match.awayTeam === 'object' && typeof match.awayTeam.id === 'number'
												? match.awayTeam.id
												: null,
								};
							})
							.filter((match: MatchOption) => Number.isInteger(match.id) && match.id > 0)
					: [];

				const selectedTeam = Number(selectedTeamId);
				const selectedName = (selectedTeamName || '').toLowerCase();
				const loadedMatches = rawMatches.filter((match: MatchOption) => {
					if (match.homeTeamId === selectedTeam || match.awayTeamId === selectedTeam) return true;
					if (!selectedName) return false;
					return (
						match.homeTeamName.toLowerCase() === selectedName ||
						match.awayTeamName.toLowerCase() === selectedName
					);
				});

				setMatches(loadedMatches);
				if (loadedMatches.length === 0) {
					setMetaMessage('No recent or upcoming matches found for this team in the selected window.');
				}
			} catch (err) {
				if (!isMounted) return;
				setMetaMessage(err instanceof Error ? err.message : 'Unable to load matches for the selected team.');
			} finally {
				if (isMounted) setIsLoadingMatches(false);
			}
		}

		void loadMatchesForTeam();
		return () => {
			isMounted = false;
		};
	}, [selectedTeamId, selectedTeamName]);

useEffect(() => {
	// load popular tags for suggestions
	let mounted = true;
	(async function loadTags() {
		setTagLoading(true);
		try {
			const res = await fetch('/api/tags?page=1&pageSize=50');
			const data = await res.json().catch(() => null);
			if (!mounted) return;
			setTagSuggestions(Array.isArray(data?.items) ? data.items : []);
		} catch {
			// ignore
		} finally {
			if (mounted) setTagLoading(false);
		}
	})();
	return () => {
		mounted = false;
	};
}, []);

// Debounced live suggestions for tag input
useEffect(() => {
	let mounted = true;
	const value = tagInput.trim();
	if (!value) {
		setLiveTagSuggestions([]);
		setActiveSuggestionIndex(-1);
		return;
	}

	const controller = new AbortController();
	const t = setTimeout(async () => {
		try {
			const qs = new URLSearchParams({ q: value, page: '1', pageSize: '8' });
			const res = await fetch(`/api/tags?${qs.toString()}`, { signal: controller.signal, cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (!mounted) return;
			setLiveTagSuggestions(Array.isArray(data?.items) ? data.items : []);
			setActiveSuggestionIndex(-1);
		} catch {
			if (!mounted) return;
			setLiveTagSuggestions([]);
		}
	}, 220);

	return () => {
		mounted = false;
		controller.abort();
		clearTimeout(t);
	};
}, [tagInput]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			setError('Thread title is required.');
			return;
		}

		const isPollMode = threadMode === 'poll';
		if (!isPollMode && !content.trim()) {
			setError('Main post content is required for discussion threads.');
			return;
		}

		const normalizedPollOptions = pollOptions
			.map((option) => option.trim())
			.filter(Boolean);

		if (isPollMode) {
			if (!pollQuestion.trim()) {
				setError('Poll question is required.');
				return;
			}
			if (normalizedPollOptions.length < 2) {
				setError('Polls need at least two options.');
				return;
			}
			if (!pollDeadlineDate.trim()) {
				setError('Poll deadline is required.');
				return;
			}
			const parsedIso = toEndOfDayIso(pollDeadlineDate);
			if (!parsedIso) {
				setError('Poll deadline must be a valid date.');
				return;
			}
			const parsedDeadline = new Date(parsedIso);
			if (Number.isNaN(parsedDeadline.getTime()) || parsedDeadline <= new Date()) {
				setError('Poll deadline must be a valid future date.');
				return;
			}
		}

		setIsSubmitting(true);
		setError('');

		try {
			let postData = null;
			if (!isPollMode) {
				const postRes = await fetch('/api/post', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content: content.trim() }),
				});
				postData = await postRes.json().catch(() => null);

				if (!postRes.ok || !postData?.id) {
					setError(postData?.error || 'Failed to create main post.');
					return;
				}
			}

			const body: Record<string, unknown> = {
				title: title.trim(),
				teamId: selectedTeamId ? parseInt(selectedTeamId, 10) : undefined,
				matchId: selectedMatchId ? parseInt(selectedMatchId, 10) : undefined,
			};

			if (tags.length > 0) {
				body.tags = tags;
			}

			if (isPollMode) {
				const pollDeadlineIso = toEndOfDayIso(pollDeadlineDate);
				if (!pollDeadlineIso) {
					setError('Poll deadline must be a valid date.');
					return;
				}

				body.poll = {
					question: pollQuestion.trim(),
					options: normalizedPollOptions,
					deadline: pollDeadlineIso,
				};
			} else {
				body.mainPostId = postData.id;
			}

			const threadRes = await fetch('/api/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const threadData = await threadRes.json().catch(() => null);

			if (!threadRes.ok || !threadData?.id) {
				setError(threadData?.error || 'Failed to create thread.');
				return;
			}

			router.push(`/forums/${threadData.id}`);
		} catch {
			setError('Unable to create thread right now.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-10">
				<Link
					href="/forums"
					className="inline-block rounded-full border border-[color:color-mix(in_srgb,var(--accent)_80%,transparent)] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]"
				>
					← Back to Forums
				</Link>
				<h1 className="mt-6 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.03em] sm:text-5xl">
					Create Thread
				</h1>
				<p className="theme-muted mt-4 max-w-3xl text-base">
					Start a discussion thread or a poll thread.
				</p>
			</section>

			<section className="theme-card rounded-[2rem] p-5 sm:p-8">
				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">
							Thread Type
						</label>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setThreadMode('discussion')}
								disabled={isSubmitting}
								className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
									threadMode === 'discussion'
										? 'border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--card))] text-[var(--accent-soft)]'
										: 'border-[color:var(--line)] bg-[var(--card-inset)] theme-muted hover:bg-[var(--card-soft)]'
								}`}
							>
								Discussion
							</button>
							<button
								type="button"
								onClick={() => setThreadMode('poll')}
								disabled={isSubmitting}
								className={`rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
									threadMode === 'poll'
										? 'border-[color:var(--accent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--card))] text-[var(--accent-soft)]'
										: 'border-[color:var(--line)] bg-[var(--card-inset)] theme-muted hover:bg-[var(--card-soft)]'
								}`}
							>
								Poll
							</button>
						</div>


					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">
								Team (Optional)
							</label>
							<div className="relative">
								<select
									value={selectedTeamId}
									onChange={(e) => setSelectedTeamId(e.target.value)}
									disabled={isSubmitting || isLoadingTeams}
									className="theme-input theme-select w-full rounded-2xl px-4 py-3 pr-11 text-sm text-[var(--foreground)]"
								>
									<option value="">General thread</option>
									{teams.map((team) => (
										<option key={team.id} value={team.id}>
											{team.name}
										</option>
									))}
								</select>
								<div className="theme-muted pointer-events-none absolute inset-y-0 right-4 flex items-center">
									<ChevronDownIcon />
								</div>
							</div>
						</div>

						<div>
							<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">
								Match (Optional)
							</label>
							<div ref={matchDropdownRef} className="relative">
								<button
									type="button"
									onClick={() => {
										if (isSubmitting || !selectedTeamId || isLoadingMatches) return;
										setIsMatchDropdownOpen((open) => !open);
									}}
									disabled={isSubmitting || !selectedTeamId || isLoadingMatches}
									className="theme-input theme-hover flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
								>
									<span className={selectedMatch ? 'text-[var(--foreground)]' : 'theme-muted'}>
										{selectedMatch
											? `${selectedMatch.awayTeamName} vs ${selectedMatch.homeTeamName} • ${dateTimeLabel(selectedMatch.date)}`
											: 'No match attached'}
									</span>
									<span className={`theme-muted transition ${isMatchDropdownOpen ? 'rotate-180' : ''}`}>
										<ChevronDownIcon />
									</span>
								</button>
								{isMatchDropdownOpen ? (
									<div className="theme-panel absolute z-20 mt-2 w-full rounded-2xl p-2 shadow-[var(--shadow)]">
										<input
											type="text"
											value={matchQuery}
											onChange={(e) => setMatchQuery(e.target.value)}
											placeholder="Search matches..."
											className="theme-input mb-2 w-full rounded-xl px-3 py-2 text-xs text-[var(--foreground)]"
										/>
										<div className="max-h-56 overflow-auto rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)]">
											<button
												type="button"
												onClick={() => {
													setSelectedMatchId('');
													setIsMatchDropdownOpen(false);
												}}
												className="theme-hover block w-full border-b border-[color:var(--line)] px-3 py-2 text-left text-xs text-[var(--foreground)]"
											>
												No match attached
											</button>
											{filteredMatches.map((match) => (
												<button
													key={match.id}
													type="button"
													onClick={() => {
														setSelectedMatchId(String(match.id));
														setIsMatchDropdownOpen(false);
													}}
													className="theme-hover block w-full border-b border-[color:var(--line)] px-3 py-2 text-left text-xs text-[var(--foreground)] last:border-b-0"
												>
													{match.awayTeamName} vs {match.homeTeamName} • {dateTimeLabel(match.date)}
												</button>
											))}
											{filteredMatches.length === 0 ? (
												<p className="px-3 py-2 text-xs theme-muted">No matches found.</p>
											) : null}
										</div>
									</div>
								) : null}
							</div>
							<p className="mt-1 text-[11px] theme-muted">
								{selectedTeamId ? `${filteredMatches.length} match option${filteredMatches.length === 1 ? '' : 's'}` : 'Select a team to load matches'}
							</p>
						</div>
					</div>

					<p className="theme-muted text-xs">
						{selectedMatchId
							? 'This thread will be match-based and linked to the selected game.'
							: selectedTeamName
								? `This thread will be team-based for ${selectedTeamName}.`
								: 'This thread will be a general forum thread.'}
					</p>

					{/* Tags block - separated from poll/post controls for clarity */}
					<div>
						<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">Tags</label>
						<div className="flex gap-2 relative">
							<input
								type="text"
								value={tagInput}
								onChange={e => {
									setTagInput(e.target.value);
								}}
								placeholder="Add a tag and press Enter"
								className="w-full rounded-xl border border-[var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm"
								onKeyDown={e => {
									if (e.key === 'ArrowDown') {
										e.preventDefault();
										setActiveSuggestionIndex((i) => Math.min((liveTagSuggestions.length ? liveTagSuggestions.length : tagSuggestions.slice(0,8).length) - 1, Math.max(0, i + 1)));
										return;
									}
									if (e.key === 'ArrowUp') {
										e.preventDefault();
										setActiveSuggestionIndex((i) => Math.max(-1, i - 1));
										return;
									}
									if (e.key === 'Enter') {
										e.preventDefault();
										const source = tagInput.trim();
										const suggestions = liveTagSuggestions.length ? liveTagSuggestions : tagSuggestions.slice(0,8);
										if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
											const t = suggestions[activeSuggestionIndex].name;
											if (t && !tags.includes(t) && tags.length < 5) setTags(prev => [...prev, t]);
										} else if (source) {
											if (!tags.includes(source) && tags.length < 5) setTags(prev => [...prev, source]);
										}
										setTagInput('');
										setLiveTagSuggestions([]);
										setActiveSuggestionIndex(-1);
									}
								}}
							/>
							{(liveTagSuggestions.length > 0 || tagInput.trim() && tagSuggestions.length > 0) && (
								<div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-[color:var(--line)] bg-[var(--card)] shadow-[var(--shadow)]">
									<ul className="max-h-48 overflow-auto">
										{(liveTagSuggestions.length ? liveTagSuggestions : tagSuggestions.slice(0,8)).map((s, idx) => (
											<li key={s.id}>
												<button
													type="button"
													onMouseDown={(ev) => ev.preventDefault()}
													onClick={() => {
														if (!tags.includes(s.name) && tags.length < 5) setTags(prev => [...prev, s.name]);
														setTagInput('');
														setLiveTagSuggestions([]);
														setActiveSuggestionIndex(-1);
													}}
													className={`block w-full px-3 py-2 text-left text-sm ${activeSuggestionIndex === idx ? 'bg-[var(--card-soft)]' : ''}`}
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
										const t = tagInput.trim();
										if (t && !tags.includes(t) && tags.length < 5) setTags(prev => [...prev, t]);
										setTagInput('');
									}}
								className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black"
							>
								Add
							</button>
						</div>
						<div className="flex flex-wrap gap-2 mt-2">
							{tags.map(t => (
								<span key={t} className="rounded-full border px-3 py-1 text-sm bg-[var(--card)]">{t}
									<button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="ml-2 text-xs">×</button>
								</span>
							))}
						</div>
						<div className="mt-1 text-xs text-[var(--muted)]">{tags.length} / 5 tags</div>
						<div className="mt-2 text-xs text-[var(--muted)]">
							Popular tags: {tagLoading ? 'Loading...' : tagSuggestions.slice(0,8).map(t => t.name).join(', ')}
						</div>
					</div>

					<div>
						<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">
							Thread Title
						</label>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="What are we discussing?"
							maxLength={150}
							disabled={isSubmitting}
							className="theme-input w-full rounded-2xl px-4 py-3 text-sm text-[var(--foreground)]"
						/>
					</div>

					{threadMode === 'discussion' ? (
						<div>
							<label className="block text-xs uppercase tracking-[0.16em] theme-muted mb-2">
								Main Post
							</label>
							<textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								placeholder="Write the main post content..."
								rows={8}
								disabled={isSubmitting}
								className="theme-input w-full resize-y rounded-2xl px-4 py-3 text-sm text-[var(--foreground)]"
							/>
						</div>
					) : (
						<div className="space-y-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] p-4">
							<label className="block text-xs uppercase tracking-[0.16em] theme-muted">
								Poll Question
							</label>
							<input
								type="text"
								value={pollQuestion}
								onChange={(e) => setPollQuestion(e.target.value)}
								placeholder="What should the community vote on?"
								disabled={isSubmitting}
								className="theme-input w-full rounded-2xl px-4 py-3 text-sm text-[var(--foreground)]"
							/>
							<label className="block text-xs uppercase tracking-[0.16em] theme-muted">
								Deadline Date
							</label>
							<div className="space-y-2">
								<input
									type="date"
									value={pollDeadlineDate}
									onChange={(e) => setPollDeadlineDate(e.target.value)}
									min={toLocalDateInputValue(new Date())}
									disabled={isSubmitting}
									className="theme-input w-full rounded-2xl px-4 py-3 text-sm text-[var(--foreground)]"
								/>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										onClick={() => setPollDeadlineDate(localDatePlusDays(1))}
										disabled={isSubmitting}
										className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
									>
										Tomorrow
									</button>
									<button
										type="button"
										onClick={() => setPollDeadlineDate(localDatePlusDays(3))}
										disabled={isSubmitting}
										className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
									>
										In 3 days
									</button>
									<button
										type="button"
										onClick={() => setPollDeadlineDate(localDatePlusDays(7))}
										disabled={isSubmitting}
										className="rounded-lg border border-[color:var(--line)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)]"
									>
										In 1 week
									</button>
								</div>
								<p className="text-[11px] theme-muted">Polls close at 11:59 PM local time on the selected date.</p>
							</div>
							<div className="space-y-2">
								<label className="block text-xs uppercase tracking-[0.16em] theme-muted">
									Options
								</label>
								{pollOptions.map((option, index) => (
									<div key={`option-${index}`} className="flex items-center gap-2">
										<input
											type="text"
											value={option}
											onChange={(e) =>
												setPollOptions((prev) =>
													prev.map((value, i) => (i === index ? e.target.value : value)),
												)
											}
											placeholder={`Option ${index + 1}`}
											disabled={isSubmitting}
											className="theme-input w-full rounded-xl px-3 py-2 text-sm text-[var(--foreground)]"
										/>
										{pollOptions.length > 2 ? (
											<button
												type="button"
												onClick={() =>
													setPollOptions((prev) => prev.filter((_, i) => i !== index))
												}
												disabled={isSubmitting}
												className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs theme-muted"
											>
												Remove
											</button>
										) : null}
									</div>
								))}
								<button
									type="button"
									onClick={() => setPollOptions((prev) => [...prev, ''])}
									disabled={isSubmitting || pollOptions.length >= 6}
									className="rounded-lg border border-[color:var(--line)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--card-soft)] disabled:opacity-50"
								>
									Add Option
								</button>
							</div>
						</div>
					)}

					{metaMessage && (
						<p className="rounded-2xl border border-[color:var(--badge-neutral-border)] bg-[var(--badge-neutral-bg)] px-4 py-3 text-sm text-[var(--badge-neutral-text)]">
							{metaMessage}
						</p>
					)}

					{error && (
						<p className="rounded-2xl border border-[color:var(--badge-negative-border)] bg-[var(--badge-negative-bg)] px-4 py-3 text-sm text-[var(--badge-negative-text)]">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={isSubmitting || !title.trim()}
						className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSubmitting ? 'Creating...' : 'Create Thread'}
					</button>
				</form>
			</section>
		</div>
	);
}

export default function CreateThreadPage() {
	return (
		<Suspense
			fallback={
				<div className="space-y-6">
					<section className="overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-10">
						<Link
							href="/forums"
							className="inline-block rounded-full border border-[color:color-mix(in_srgb,var(--accent)_80%,transparent)] bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]"
						>
							← Back to Forums
						</Link>
						<h1 className="mt-6 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.03em] sm:text-5xl">
							Create Thread
						</h1>
						<p className="theme-muted mt-4 max-w-3xl text-base">
							Loading composer...
						</p>
					</section>
				</div>
			}
		>
			<CreateThreadPageContent />
		</Suspense>
	);
}

function ChevronDownIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}
