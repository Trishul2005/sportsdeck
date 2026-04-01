'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type DigestCard = {
	id: number;
	title: string;
	summary: string;
	href: string;
};

type DiscussionCard = {
	id: number;
	title: string;
	excerpt: string;
	postCount: number;
	href: string;
};

type StandingsImpact = {
	id: number;
	teamId: number;
	title: string;
	summary: string;
	record: string;
};

type DigestResponse = {
	date?: string;
	message?: string;
	digest?: string;
	aiDraft?: string | null;
	headline?: string;
	takeaways?: string[];
	discussionCards?: DiscussionCard[];
	matchCards?: DigestCard[];
	standingsImpact?: StandingsImpact[];
	sourceCounts?: {
		discussions: number;
		recordedMatches: number;
		standingsTeams: number;
	};
	error?: string;
};

function getTodayIsoDate() {
	return new Date().toISOString().slice(0, 10);
}

export default function DigestPage() {
	const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
	const [digest, setDigest] = useState<DigestResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;

		async function loadDigest() {
			try {
				setIsLoading(true);
				setError('');

				const response = await fetch(`/api/digest/daily?date=${selectedDate}`, {
					credentials: 'include',
					cache: 'no-store',
				});
				const data: DigestResponse = await response.json().catch(() => ({}));

				if (!response.ok) {
					throw new Error(data.error || 'Unable to generate the AI digest right now.');
				}

				if (!cancelled) {
					setDigest(data);
				}
			} catch (err) {
				if (!cancelled) {
					setDigest(null);
					setError(err instanceof Error ? err.message : 'Unable to generate the AI digest right now.');
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		loadDigest();

		return () => {
			cancelled = true;
		};
	}, [selectedDate]);

	const digestSummary = digest?.aiDraft || digest?.digest || 'No digest is available for this date.';
	const summarySentences = useMemo(() => getSummarySentences(digestSummary, 2), [digestSummary]);
	const headline = digest?.headline || `Daily digest for ${selectedDate}`;
	const takeaways = digest?.takeaways?.slice(0, 3) || [];
	const discussionCards = digest?.discussionCards?.slice(0, 3) || [];
	const matchCards = digest?.matchCards?.slice(0, 3) || [];
	const standingsImpact = digest?.standingsImpact?.slice(0, 3) || [];

	return (
		<div className="space-y-6">
			<section className="theme-card rounded-[2rem] p-8 sm:p-10">
				<p className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
					SportsDeck
				</p>
				<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em] sm:text-5xl">
					AI Digest
				</h1>
				<p className="theme-muted mt-5 max-w-3xl text-lg leading-8">
					Catch up on the biggest NBA storylines with daily summaries, fan sentiment, and quick takes built for fast browsing.
				</p>

				<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="grid gap-2">
						<label htmlFor="digest-date" className="text-xs font-semibold uppercase tracking-[0.18em] theme-muted">
							Digest Date
						</label>
						<input
							id="digest-date"
							type="date"
							value={selectedDate}
							onChange={(event) => setSelectedDate(event.target.value)}
							className="theme-input rounded-[1rem] px-4 py-3 text-sm outline-none transition"
						/>
					</div>

					<div className="theme-muted text-sm">
						{digest?.message || 'Daily summary built from threads, recorded matches, and standings.'}
					</div>
				</div>
			</section>

			{error ? (
				<div className="theme-danger-panel rounded-[1.5rem] px-5 py-4 text-sm">
					{error}
				</div>
			) : null}

			<section className="rounded-[2rem] border border-[color:color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[var(--card)] p-6 sm:p-8">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">Today&apos;s Summary</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl font-bold uppercase tracking-[-0.02em] sm:text-4xl">
							{headline}
						</h2>
					</div>
					<div className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-2 text-xs uppercase tracking-[0.18em] theme-muted">
						{formatDateLabel(digest?.date || selectedDate)}
					</div>
				</div>

				{isLoading ? (
					<div className="mt-8 space-y-3">
						<div className="h-5 animate-pulse rounded bg-[var(--card-soft)]" />
						<div className="h-5 animate-pulse rounded bg-[var(--card-soft)]" />
						<div className="h-5 animate-pulse rounded bg-[var(--card-soft)]" />
					</div>
				) : (
					<>
						<div className="mt-8 max-w-4xl space-y-4">
							{summarySentences.map((sentence, index) => (
								<p key={index} className="text-lg leading-8 text-[var(--foreground)] sm:text-xl sm:leading-9">
									{sentence}
								</p>
							))}
						</div>

						<div className="mt-8 grid gap-4 lg:grid-cols-3">
							{takeaways.map((takeaway, index) => (
								<div
									key={index}
									className="rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-5"
								>
									<p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Takeaway {index + 1}</p>
									<p className="theme-muted mt-3 text-sm leading-7">{takeaway}</p>
								</div>
							))}
						</div>
					</>
				)}
			</section>

			<section className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
				<EditorialLinkSection
					eyebrow="Community"
					title="Key Discussion Threads"
					description="Open the conversations that shaped the day on SportsDeck."
					linkHref="/forums"
					linkLabel="Browse all forums"
					isLoading={isLoading}
					emptyMessage="No discussion threads stood out for this date."
				>
					{discussionCards.map((thread) => (
						<Link
							key={thread.id}
							href={thread.href}
							className="block rounded-[1.35rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[var(--card-soft)]"
						>
							<div className="flex items-start justify-between gap-3">
								<h3 className="font-medium text-[var(--foreground)]">{thread.title}</h3>
								<span className="shrink-0 rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] theme-muted">
									{thread.postCount} posts
								</span>
							</div>
							<p className="theme-muted mt-3 text-sm leading-7">{thread.excerpt}</p>
							<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
								Open full thread
							</p>
						</Link>
					))}
				</EditorialLinkSection>

				<EditorialLinkSection
					eyebrow="Games"
					title="Important Finished Games"
					description="The completed matchups that mattered most in the digest."
					linkHref="/matches"
					linkLabel="View all matches"
					isLoading={isLoading}
					emptyMessage="No finished games were available for this date."
				>
					{matchCards.map((match) => (
						<Link
							key={match.id}
							href={match.href}
							className="block rounded-[1.35rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[var(--card-soft)]"
						>
							<p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Final</p>
							<h3 className="mt-3 font-medium text-[var(--foreground)]">{match.title}</h3>
							<p className="theme-muted mt-3 text-sm leading-7">{match.summary}</p>
							<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
								View match
							</p>
						</Link>
					))}
				</EditorialLinkSection>

				<EditorialLinkSection
					eyebrow="Standings"
					title="Standings Impact"
					description="The teams shaping the current table snapshot."
					linkHref="/standings"
					linkLabel="Open standings"
					isLoading={isLoading}
					emptyMessage="No standings snapshot was available for this date."
					compact
				>
					{standingsImpact.map((team) => (
						<Link
							key={team.id}
							href={`/teams/${team.teamId}`}
							className="block rounded-[1.35rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-[var(--card-soft)]"
						>
							<div className="flex items-center justify-between gap-3">
								<h3 className="font-medium text-[var(--foreground)]">{team.title}</h3>
								<span className="text-sm font-semibold text-[var(--foreground)]">{team.record}</span>
							</div>
							<p className="theme-muted mt-3 text-sm leading-7">{team.summary}</p>
							<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
								View team
							</p>
						</Link>
					))}
				</EditorialLinkSection>
			</section>
		</div>
	);
}

function EditorialLinkSection({
	eyebrow,
	title,
	description,
	linkHref,
	linkLabel,
	isLoading,
	emptyMessage,
	compact = false,
	children,
}: {
	eyebrow: string;
	title: string;
	description: string;
	linkHref: string;
	linkLabel: string;
	isLoading: boolean;
	emptyMessage: string;
	compact?: boolean;
	children: ReactNode;
}) {
	const childCount = countChildren(children);

	return (
		<section className="theme-card rounded-[2rem] p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{eyebrow}</p>
					<h2 className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
						{title}
					</h2>
					<p className="theme-muted mt-3 text-sm leading-7">{description}</p>
				</div>
				<Link href={linkHref} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
					{linkLabel}
				</Link>
			</div>

			<div className={compact ? 'mt-6 space-y-4' : 'mt-6 space-y-5'}>
				{isLoading ? (
					<>
						<div className="rounded-[1.35rem] bg-[var(--card-soft)] p-5">
							<div className="h-4 animate-pulse rounded bg-[var(--card-inset)]" />
							<div className="mt-4 h-4 animate-pulse rounded bg-[var(--card-inset)]" />
						</div>
						<div className="rounded-[1.35rem] bg-[var(--card-soft)] p-5">
							<div className="h-4 animate-pulse rounded bg-[var(--card-inset)]" />
							<div className="mt-4 h-4 animate-pulse rounded bg-[var(--card-inset)]" />
						</div>
					</>
				) : childCount > 0 ? (
					children
				) : (
					<div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4">
						<p className="theme-muted text-sm leading-7">{emptyMessage}</p>
					</div>
				)}
			</div>
		</section>
	);
}

function countChildren(children: ReactNode) {
	return Array.isArray(children) ? children.length : children ? 1 : 0;
}

function formatDateLabel(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(`${value}T00:00:00`));
}

function getSummarySentences(summary: string, limit: number) {
	const sentences = summary
		.replace(/\s+/g, ' ')
		.trim()
		.match(/[^.!?]+[.!?]?/g)
		?.map((sentence) => sentence.trim())
		.filter(Boolean);

	if (!sentences || sentences.length === 0) {
		return [summary];
	}

	return sentences.slice(0, limit);
}
