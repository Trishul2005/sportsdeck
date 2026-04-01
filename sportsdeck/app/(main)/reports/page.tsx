'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type QueueItem = {
	reportId: number;
	contentType: 'POST' | 'THREAD' | 'POLL';
	contentId: number;
	threadId: number | null;
	threadTitle: string | null;
	contentLink: string | null;
	reportCount: number;
	worstAiVerdict: 'SAFE' | 'WARNING' | 'VIOLATION';
	highestToxicity: number;
	contentPreview: string;
	pollOptions?: string[];
	storedModerationExplanation?: string;
	reasons: string[];
	offender: {
		id: number;
		username: string;
		avatar: string | null;
		isBanned: boolean;
	} | null;
	isHidden: boolean;
	isClosed: boolean;
	lastReportedAt: string;
};

export default function ReportsPage() {
	const [queue, setQueue] = useState<QueueItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pageError, setPageError] = useState('');
	const [actionError, setActionError] = useState('');
	const [activeActionKey, setActiveActionKey] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function loadQueue() {
			try {
				const response = await fetch('/api/admin/report/queue', {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);

				if (!isMounted) {
					return;
				}

				if (!response.ok) {
					setPageError(data?.error || 'Unable to load the moderation queue.');
					return;
				}

				setQueue(Array.isArray(data) ? data : []);
			} catch {
				if (isMounted) {
					setPageError('Unable to load the moderation queue.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadQueue();

		return () => {
			isMounted = false;
		};
	}, []);

	const resolveReport = async (
		item: QueueItem,
		action: 'APPROVE' | 'DISMISS' | 'BAN_USER',
	) => {
		setActionError('');
		const actionKey = `${item.contentType}-${item.contentId}-${action}`;
		setActiveActionKey(actionKey);
		try {
			const response = await fetch(`/api/admin/report/${item.reportId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ action }),
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setActionError(data?.error || 'Failed to process moderation action.');
				return;
			}

			setQueue((prev) =>
				prev.filter(
					(q) =>
						!(
							q.contentType === item.contentType &&
							q.contentId === item.contentId
						),
				),
			);
		} catch {
			setActionError('Failed to process moderation action.');
		} finally {
			setActiveActionKey(null);
		}
	};

	if (isLoading) {
		return (
			<div className="grid gap-6">
				<div className="h-24 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				<div className="h-80 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			<section className="theme-card rounded-[2rem] p-8">
				<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Admin</p>
				<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl uppercase tracking-[-0.02em]">
					Reports Queue
				</h1>
				<p className="theme-muted mt-4 max-w-2xl text-sm leading-7">
					Review unresolved reports, inspect the moderation verdict, then dismiss,
					hide the content, or hide the content and ban the account responsible.
				</p>
				<div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em]">
					<span className="theme-positive-panel rounded-full px-3 py-1">Safe: low risk</span>
					<span className="theme-warning-panel rounded-full px-3 py-1">Warning: review</span>
					<span className="theme-danger-panel rounded-full px-3 py-1">Violation: hide or ban</span>
				</div>
				{actionError && <p className="theme-danger-panel mt-3 inline-flex rounded-2xl px-4 py-3 text-sm">{actionError}</p>}
			</section>

			{pageError ? (
				<section className="theme-danger-panel rounded-[2rem] p-8">
					<h2 className="font-[family:var(--font-heading)] text-3xl uppercase">
						Reports Unavailable
					</h2>
					<p className="mt-3 text-base opacity-90">{pageError}</p>
				</section>
			) : queue.length === 0 ? (
				<section className="theme-card rounded-[2rem] p-8 text-center">
					<h2 className="font-[family:var(--font-heading)] text-3xl uppercase">
						Queue Clear
					</h2>
					<p className="theme-muted mt-3">
						There are no unresolved reports at the moment.
					</p>
				</section>
			) : (
				<div className="grid gap-4">
					{queue.map((item) => (
						<article
							key={`${item.contentType}-${item.contentId}`}
							className="theme-card rounded-[1.75rem] p-6"
						>
							<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-3">
										<span className="rounded-full bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
											{item.contentType}
										</span>
										<SeverityBadge verdict={item.worstAiVerdict} />
										{item.isHidden && (
											<span className="theme-warning-panel rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
												Hidden
											</span>
										)}
										{item.isClosed && (
											<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
												Closed
											</span>
										)}
									</div>
									<p className="mt-4 text-base leading-7 text-[var(--foreground)]">
										{item.contentPreview || 'No preview available for this content.'}
									</p>
									{item.contentType === 'POLL' &&
									Array.isArray(item.pollOptions) &&
									item.pollOptions.length > 0 ? (
										<div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] p-3">
											<p className="theme-muted text-[11px] uppercase tracking-[0.18em]">
												Poll Options
											</p>
											<ul className="mt-2 space-y-2">
												{item.pollOptions.map((option, idx) => (
													<li
														key={`${item.contentType}-${item.contentId}-option-${idx}`}
														className="text-sm leading-6 text-[var(--foreground)]"
													>
														{idx + 1}. {option}
													</li>
												))}
											</ul>
										</div>
									) : null}
									{item.storedModerationExplanation ? (
										<div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] p-3">
											<p className="theme-muted text-[11px] uppercase tracking-[0.18em]">
												Moderation Verdict
											</p>
											<p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
												{item.storedModerationExplanation}
											</p>
										</div>
									) : null}
										<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
											{item.offender ? (
												<Link
													href={`/profile/${item.offender.id}`}
													className="inline-flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-2 text-[var(--foreground)] transition hover:opacity-90"
												>
													<span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--line)] bg-[var(--card-soft)]">
														{item.offender.avatar ? (
															<img
																src={item.offender.avatar}
																alt={`${item.offender.username} avatar`}
																referrerPolicy="no-referrer"
																className="h-full w-full object-cover"
															/>
														) : (
															<DefaultAvatarIcon />
														)}
													</span>
													<span className="flex flex-col text-left">
														<span className="text-sm font-semibold text-[var(--foreground)]">
															{item.offender.username}
														</span>
														<span className="theme-muted text-xs uppercase tracking-[0.14em]">
															View profile
														</span>
													</span>
												</Link>
											) : (
												<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-2 text-[var(--foreground)]">
													Account unavailable
												</span>
											)}
											<p className="theme-muted text-sm normal-case tracking-normal">
												Last reported {new Date(item.lastReportedAt).toLocaleString()}
											</p>
										</div>
									{Array.isArray(item.reasons) && item.reasons.length > 0 && (
										<div className="mt-4 rounded-xl border border-[color:var(--line)] bg-[var(--card-inset)] p-3">
											<p className="text-xs uppercase tracking-[0.16em] theme-muted">
												Why It Was Queued
											</p>
											<ul className="mt-2 space-y-2">
												{item.reasons.map((reason, idx) => (
													<li key={`${item.contentType}-${item.contentId}-reason-${idx}`} className="text-sm leading-6 text-[var(--foreground)]">
														{formatReason(reason)}
													</li>
												))}
											</ul>
										</div>
									)}
								</div>

								<div className="grid min-w-[12rem] gap-3 sm:grid-cols-3 lg:grid-cols-1">
									<MetricCard label="Content ID" value={String(item.contentId)} />
									<MetricCard label="Reports" value={String(item.reportCount)} />
									<MetricCard
										label="Toxicity"
										value={item.highestToxicity.toFixed(2)}
									/>
									{item.contentLink ? (
										<Link
											href={item.contentLink}
											className="rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground)] transition hover:opacity-90"
										>
											Open Content
										</Link>
									) : null}
									<button
										type="button"
										onClick={() => resolveReport(item, 'BAN_USER')}
										disabled={activeActionKey !== null}
										className="theme-danger-panel rounded-[1.25rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:opacity-90 disabled:opacity-50"
									>
										{activeActionKey === `${item.contentType}-${item.contentId}-BAN_USER`
											? 'Processing...'
											: 'Hide + Ban'}
									</button>
									<button
										type="button"
										onClick={() => resolveReport(item, 'APPROVE')}
										disabled={activeActionKey !== null}
										className="theme-positive-panel rounded-[1.25rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:opacity-90 disabled:opacity-50"
									>
										{activeActionKey === `${item.contentType}-${item.contentId}-APPROVE`
											? 'Processing...'
											: 'Hide'}
									</button>
									<button
										type="button"
										onClick={() => resolveReport(item, 'DISMISS')}
										disabled={activeActionKey !== null}
										className="theme-warning-panel rounded-[1.25rem] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:opacity-90 disabled:opacity-50"
									>
										{activeActionKey === `${item.contentType}-${item.contentId}-DISMISS`
											? 'Processing...'
											: 'Dismiss'}
									</button>
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</div>
	);
}

function MetricCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-3">
			<p className="theme-muted text-[11px] uppercase tracking-[0.18em]">{label}</p>
			<p className="mt-2 font-[family:var(--font-heading)] text-2xl uppercase">{value}</p>
		</div>
	);
}

function DefaultAvatarIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5 text-[var(--accent)]"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="8" r="3.5" />
			<path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
		</svg>
	);
}

function formatReason(reason: string) {
	if (!reason) {
		return 'No reason provided.';
	}

	const attemptedMatch = reason.match(/Attempted content:\s*(.*?)\.\s*made by user\s+\d+/i);
	const scoreMatch = reason.match(/score\s+([0-9.]+)/i);
	const parsedScore = scoreMatch?.[1] ? Number.parseFloat(scoreMatch[1]) : null;
	const safeScore = typeof parsedScore === 'number' && Number.isFinite(parsedScore) ? parsedScore.toFixed(2) : null;

	if (attemptedMatch?.[1]) {
		const scoreLabel = safeScore ? `score ${safeScore}` : 'high score';
		return `Auto-moderation blocked this submission for toxic content (${scoreLabel}). Attempted text: "${attemptedMatch[1].trim()}".`;
	}

	if (safeScore) {
		return `Reported after moderation flagged it with score ${safeScore}.`;
	}

	return reason;
}

function SeverityBadge({
	verdict,
}: {
	verdict: 'SAFE' | 'WARNING' | 'VIOLATION';
}) {
	const styles =
		verdict === 'VIOLATION'
			? 'theme-danger-panel'
			: verdict === 'WARNING'
				? 'theme-warning-panel'
				: 'theme-positive-panel';

	return (
		<span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles}`}>
			{verdict}
		</span>
	);
}
