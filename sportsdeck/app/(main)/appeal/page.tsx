'use client';

import { useEffect, useMemo, useState } from 'react';

type AppealRecord = {
	id: number;
	reason: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	createdAt: string;
	reviewedAt: string | null;
};

type CurrentUser = {
	id: number;
	isBanned: boolean;
	appeals: AppealRecord[];
};

export default function AppealPage() {
	const [user, setUser] = useState<CurrentUser | null>(null);
	const [reason, setReason] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [pageError, setPageError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');

	useEffect(() => {
		let isMounted = true;

		async function loadUser() {
			try {
				const response = await fetch('/api/user/profile', {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);
				const currentUser = data?.user ?? data;

				if (!isMounted) {
					return;
				}

				if (!currentUser?.id) {
					setPageError('You need to be logged in to submit an appeal.');
					return;
				}

				setUser({
					id: currentUser.id,
					isBanned: Boolean(currentUser.isBanned),
					appeals: Array.isArray(currentUser.appeals) ? currentUser.appeals : [],
				});
			} catch {
				if (isMounted) {
					setPageError('Unable to load your appeal status right now.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		void loadUser();

		return () => {
			isMounted = false;
		};
	}, []);

	const pendingAppeal = useMemo(
		() => user?.appeals.find((appeal) => appeal.status === 'PENDING') ?? null,
		[user],
	);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmedReason = reason.trim();
		if (!trimmedReason) {
			setSuccessMessage('');
			setPageError('Please explain why your ban should be reconsidered.');
			return;
		}

		setIsSubmitting(true);
		setPageError('');
		setSuccessMessage('');

		try {
			const response = await fetch('/api/user/appeal', {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ reason: trimmedReason }),
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setPageError(data?.error || 'Unable to submit your appeal right now.');
				return;
			}

			setUser((current) =>
				current
					? {
							...current,
							appeals: [data, ...current.appeals],
					  }
					: current,
			);
			setReason('');
			setSuccessMessage('Appeal submitted successfully.');
		} catch {
			setPageError('Unable to submit your appeal right now.');
		} finally {
			setIsSubmitting(false);
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

	if (!user) {
		return (
			<section className="theme-danger-panel rounded-[2rem] p-8">
				<h1 className="font-[family:var(--font-heading)] text-3xl uppercase">
					Appeal Unavailable
				</h1>
				<p className="mt-3 text-base opacity-90">
					{pageError || 'We could not load the appeal page.'}
				</p>
			</section>
		);
	}

	if (!user.isBanned) {
		return (
			<section className="theme-card rounded-[2rem] p-8">
				<h1 className="font-[family:var(--font-heading)] text-3xl uppercase">
					No Active Ban
				</h1>
				<p className="theme-muted mt-3 text-base">
					This page is only available for accounts that are currently banned.
				</p>
			</section>
		);
	}

	return (
		<div className="grid gap-6">
			<section className="theme-card rounded-[2rem] p-8">
				<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Account</p>
				<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl uppercase tracking-[-0.02em]">
					Submit Appeal
				</h1>
				<p className="theme-muted mt-4 max-w-2xl text-sm leading-7">
					If you believe your ban was made in error, explain the situation clearly and our
					admin team can review it.
				</p>
			</section>

			<section className="theme-card rounded-[2rem] p-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Appeal Form
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Request Review
						</h2>
					</div>
					{pendingAppeal ? (
						<span className="theme-warning-panel rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
							Pending Appeal
						</span>
					) : null}
				</div>

				<form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
					<textarea
						value={reason}
						onChange={(event) => {
							setReason(event.target.value);
							setPageError('');
							setSuccessMessage('');
						}}
						disabled={Boolean(pendingAppeal) || isSubmitting}
						placeholder="Explain why your ban should be reviewed. Include any context that may help the admin team."
						rows={6}
						className="theme-input resize-none rounded-[1.5rem] px-4 py-4 outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
					/>

					{pageError ? (
						<p className="theme-danger-panel rounded-2xl px-4 py-3 text-sm">
							{pageError}
						</p>
					) : null}

					{successMessage ? (
						<p className="theme-positive-panel rounded-2xl px-4 py-3 text-sm">
							{successMessage}
						</p>
					) : null}

					<button
						type="submit"
						disabled={Boolean(pendingAppeal) || isSubmitting}
						className="w-fit cursor-pointer rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSubmitting ? 'Submitting...' : pendingAppeal ? 'Appeal Pending' : 'Submit Appeal'}
					</button>
				</form>
			</section>

			<section className="theme-card rounded-[2rem] p-8">
				<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">History</p>
				<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
					Appeal Status
				</h2>

				<div className="mt-8 grid gap-4">
					{user.appeals.length === 0 ? (
						<div className="rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-12 text-center">
							<p className="font-[family:var(--font-heading)] text-2xl uppercase text-[var(--foreground)]">
								No Appeals Yet
							</p>
							<p className="theme-muted mt-3">
								Submitted appeals will appear here once you send one.
							</p>
						</div>
					) : (
						user.appeals.map((appeal) => (
							<article
								key={appeal.id}
								className="rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-5"
							>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-3">
											<AppealStatus status={appeal.status} />
										</div>
										<div className="mt-4 max-h-36 overflow-y-auto rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-4">
											<p className="text-sm leading-7 text-[var(--foreground)]">
												{appeal.reason}
											</p>
										</div>
										<div className="mt-4 flex flex-wrap gap-3">
											<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
												Appeal sent {formatDate(appeal.createdAt)}
											</span>
											{appeal.reviewedAt ? (
												<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
													Appeal resolved {formatDate(appeal.reviewedAt)}
												</span>
											) : appeal.status !== 'PENDING' ? (
												<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
													Appeal resolved date unavailable
												</span>
											) : null}
										</div>
									</div>
								</div>
							</article>
						))
					)}
				</div>
			</section>
		</div>
	);
}

function AppealStatus({
	status,
}: {
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
}) {
	const styles =
		status === 'APPROVED'
			? 'theme-positive-panel'
			: status === 'REJECTED'
				? 'theme-danger-panel'
				: 'theme-warning-panel';

	return (
		<span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles}`}>
			{status}
		</span>
	);
}

function formatDate(value: string) {
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}
