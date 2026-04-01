'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Appeal = {
	id: number;
	userId: number;
	reason: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	createdAt: string;
	reviewedAt: string | null;
	user: {
		id: number;
		username: string;
		avatar: string | null;
	};
};

export default function AppealsPage() {
	const [appeals, setAppeals] = useState<Appeal[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pageError, setPageError] = useState('');
	const [actionAppealId, setActionAppealId] = useState<number | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function loadAppeals() {
			try {
				const response = await fetch('/api/admin/appeal', {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);

				if (!isMounted) {
					return;
				}

				if (!response.ok) {
					setPageError(data?.error || 'Unable to load pending appeals.');
					return;
				}

				setAppeals(Array.isArray(data) ? data : []);
			} catch {
				if (isMounted) {
					setPageError('Unable to load pending appeals.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadAppeals();

		return () => {
			isMounted = false;
		};
	}, []);

	async function handleAppealAction(appealId: number, action: 'APPROVE' | 'REJECT') {
		setActionAppealId(appealId);
		setPageError('');

		try {
			const response = await fetch(`/api/admin/appeal/${appealId}`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ action }),
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setPageError(data?.error || 'Unable to update this appeal right now.');
				return;
			}

			setAppeals((current) => current.filter((appeal) => appeal.id !== appealId));
		} catch {
			setPageError('Unable to update this appeal right now.');
		} finally {
			setActionAppealId(null);
		}
	}

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
					Appeals
				</h1>
				<p className="theme-muted mt-4 max-w-2xl text-sm leading-7">
					Track pending ban appeals submitted by users and review the context before
					taking moderation action.
				</p>
			</section>

			{pageError ? (
				<section className="theme-danger-panel rounded-[2rem] p-8">
					<h2 className="font-[family:var(--font-heading)] text-3xl uppercase">
						Appeals Unavailable
					</h2>
					<p className="mt-3 text-base opacity-90">{pageError}</p>
				</section>
			) : appeals.length === 0 ? (
				<section className="theme-card rounded-[2rem] p-8 text-center">
					<h2 className="font-[family:var(--font-heading)] text-3xl uppercase">
						No Pending Appeals
					</h2>
					<p className="theme-muted mt-3">
						There are no open appeals waiting for review.
					</p>
				</section>
			) : (
				<div className="grid gap-4">
					{appeals.map((appeal) => (
						<article key={appeal.id} className="theme-card rounded-[1.75rem] p-6">
							<div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
										<div className="flex min-w-0 items-center gap-4">
											<div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)]">
												{appeal.user.avatar ? (
													<img
														src={appeal.user.avatar}
														alt={`${appeal.user.username} avatar`}
														className="h-full w-full object-cover"
													/>
												) : (
													<DefaultAvatarIcon className="h-7 w-7" />
												)}
											</div>

											<div className="min-w-0">
												<p className="truncate font-[family:var(--font-heading)] text-2xl uppercase tracking-[-0.02em] text-[var(--foreground)]">
													{appeal.user.username}
												</p>
												<div className="mt-2 flex flex-wrap items-center gap-3">
													<span className="theme-warning-panel rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
														{appeal.status}
													</span>
												</div>
											</div>
										</div>

										<Link
											href={`/profile/${appeal.user.id}`}
											className="theme-panel inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
										>
											View Profile
										</Link>
									</div>

									<div className="mt-5 max-h-40 overflow-y-auto rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4">
										<p className="text-base leading-7 text-[var(--foreground)]">
											{appeal.reason}
										</p>
									</div>
								</div>

								<div className="grid min-w-[12rem] gap-3 sm:grid-cols-2 xl:grid-cols-1">
									<MetricCard label="Appeal ID" value={String(appeal.id)} />
									<MetricCard label="Submitted" value={formatDate(appeal.createdAt)} />
								</div>
							</div>

							<div className="mt-5 flex flex-wrap gap-3">
								<button
									type="button"
									onClick={() => handleAppealAction(appeal.id, 'APPROVE')}
									disabled={actionAppealId === appeal.id}
									className="cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{actionAppealId === appeal.id ? 'Saving...' : 'Approve Appeal'}
								</button>
								<button
									type="button"
									onClick={() => handleAppealAction(appeal.id, 'REJECT')}
									disabled={actionAppealId === appeal.id}
									className="theme-danger-panel cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{actionAppealId === appeal.id ? 'Saving...' : 'Dismiss Appeal'}
								</button>
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
			<p className="mt-2 font-medium text-[var(--foreground)]">{value}</p>
		</div>
	);
}

function DefaultAvatarIcon({ className = 'h-7 w-7' }: { className?: string }) {
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

function formatDate(value: string) {
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}
