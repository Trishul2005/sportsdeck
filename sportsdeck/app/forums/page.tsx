'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Thread = {
	id: number;
	title: string;
	teamId: number | null;
	matchId: number | null;
	isClosed?: boolean;
	team?: {
		id: number;
		name: string;
		logoUrl: string | null;
	} | null;
	tags?: Array<{ tag: { name: string } }> | null;
	match?: {
		id: number;
		date: string | null;
		sentiment?: {
			overall: number | null;
			homeTeam: number | null;
			awayTeam: number | null;
		} | null;
		homeTeam: { id: number; name: string; logoUrl: string | null };
		awayTeam: { id: number; name: string; logoUrl: string | null };
	} | null;
	createdAt?: string;
	mainPost?: {
		id: number;
		content: string;
	};
};

type ThreadsResponse = {
	items: Thread[];
	page: number;
	pageSize: number;
	total?: number;
	pageCount?: number;
	hasNext?: boolean;
	hasPrev?: boolean;
};

type ThreadSort =
	| 'created_desc'
	| 'created_asc'
	| 'alpha_asc'
	| 'alpha_desc'
	| 'interacted_desc';

export default function ForumsPage() {
	return (
		<Suspense fallback={<ForumsPageSkeleton />}>
			<ForumsPageContent />
		</Suspense>
	);
}

function ForumsPageContent() {
    const searchParams = useSearchParams();
	const [threads, setThreads] = useState<Thread[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(5);
	const [hasNext, setHasNext] = useState(false);
	const [sort, setSort] = useState<ThreadSort>('created_desc');
	const [isSignedIn, setIsSignedIn] = useState(false);
	const [isBannedUser, setIsBannedUser] = useState(false);

	const searchParamsString = searchParams ? searchParams.toString() : '';

	useEffect(() => {
		let isMounted = true;

		async function loadThreads() {
			setIsLoading(true);
			setError('');

			try {
				// Forward URL query params (including tags) to the threads API
				const qp = new URLSearchParams(searchParamsString);
				qp.set('page', String(page));
				qp.set('pageSize', String(pageSize));
				qp.set('includeMeta', 'true');
				qp.set('includeTotal', 'false');
				qp.set('sort', sort);
				const response = await fetch(`/api/threads?${qp.toString()}`, { cache: 'no-store' });
				const data = await response.json().catch(() => null);

				if (!response.ok) {
					if (!isMounted) return;
					setThreads([]);
					setHasNext(false);
					setError(data?.error || 'Unable to load forums right now.');
					return;
				}

				if (!isMounted) return;
				const payload = data as ThreadsResponse | null;
				setThreads(Array.isArray(payload?.items) ? payload.items : []);
				setHasNext(Boolean(payload?.hasNext));
			} catch {
				if (!isMounted) return;
				setThreads([]);
				setHasNext(false);
				setError('Unable to load forums right now.');
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		loadThreads();

		return () => {
			isMounted = false;
		};
	}, [page, pageSize, sort, searchParamsString]);

	useEffect(() => {
		let isMounted = true;

		async function loadCurrentUser() {
			try {
				const response = await fetch('/api/user/me', { cache: 'no-store' });
				const data = await response.json().catch(() => null);
				if (!isMounted) return;
				const normalizedUser = data && typeof data === 'object' && 'user' in data
					? data.user
					: data;
				setIsSignedIn(Boolean(response.ok && normalizedUser !== null));
				setIsBannedUser(Boolean(response.ok && normalizedUser?.isBanned));
			} catch {
				if (!isMounted) return;
				setIsSignedIn(false);
				setIsBannedUser(false);
			}
		}

		loadCurrentUser();

		return () => {
			isMounted = false;
		};
	}, []);


	return (
		<div className="space-y-8">
			<section className="overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-8 shadow-[var(--shadow)] sm:p-10 lg:p-12">
				<p className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
					SportsDeck
				</p>
				<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.03em] sm:text-5xl">
					Forums
				</h1>
				<p className="theme-muted mt-5 max-w-3xl text-lg leading-8">
					Live community threads from across the app. Showing {pageSize} threads per page.
				</p>
				{isSignedIn && !isBannedUser && (
					<Link
						href="/forums/create"
						className="mt-6 inline-block rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
					>
						+ Create Thread
					</Link>
				)}
				{!isSignedIn && (
					<p className="mt-6 text-sm theme-muted">
						Sign in to create and participate in threads.
					</p>
				)}
				{isBannedUser && (
					<p className="theme-danger-panel mt-6 inline-flex rounded-2xl px-4 py-3 text-sm">
						You are banned from contributing. Submit an appeal to create new threads.
					</p>
				)}
			</section>

			<section className="theme-card rounded-[2rem] p-8">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
					<div>
						<p className="text-xs uppercase tracking-[0.18em] theme-muted">Community</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Threads
						</h2>
					</div>
					<div className="flex items-center gap-3">
						<div className="relative w-full sm:w-auto">
							<select
								value={sort}
								onChange={(e) => {
									setSort(e.target.value as ThreadSort);
									setPage(1);
								}}
								className="theme-input theme-select w-full sm:w-auto rounded-2xl px-3 py-1 pr-9 text-sm text-[var(--foreground)]"
							>
								<option value="created_desc">Latest Created</option>
								<option value="created_asc">Earliest Created</option>
								<option value="alpha_asc">Alphabetical A-Z</option>
								<option value="alpha_desc">Alphabetical Z-A</option>
								<option value="interacted_desc">Recently Interacted</option>
							</select>
							<div className="theme-muted pointer-events-none absolute inset-y-0 right-3 flex items-center">
								<ChevronDownIcon />
							</div>
						</div>
						<div className="relative w-full sm:w-auto">
							<select
								value={pageSize}
								onChange={(e) => {
									setPageSize(parseInt(e.target.value));
									setPage(1);
								}}
								className="theme-input theme-select w-full sm:w-auto rounded-2xl px-3 py-1 pr-9 text-sm text-[var(--foreground)]"
							>
								<option value="5">5 per page</option>
								<option value="10">10 per page</option>
								<option value="20">20 per page</option>
							</select>
							<div className="theme-muted pointer-events-none absolute inset-y-0 right-3 flex items-center">
								<ChevronDownIcon />
							</div>
						</div>
					</div>
				</div>

				{isLoading ? (
					<div className="mt-6 space-y-3">
						{Array.from({ length: 5 }).map((_, index) => (
							<div
								key={index}
								className="h-20 animate-pulse rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)]"
							/>
						))}
					</div>
				) : error ? (
					<p className="theme-danger-panel mt-6 rounded-2xl px-4 py-3 text-sm">
						{error}
					</p>
				) : threads.length === 0 ? (
					<div className="mt-6 rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-12 text-center">
						<p className="font-[family:var(--font-heading)] text-2xl uppercase text-[var(--foreground)]">
							No threads yet
						</p>
						<p className="theme-muted mt-3 text-sm">
							Create the first thread to start the discussion.
						</p>
					</div>
				) : (
					<>
						<ul className="mt-6 space-y-3">
							{threads.map((thread) => (
								<li
									key={thread.id}
									className="rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:bg-[var(--card-soft)]"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0">
											<Link href={`/forums/${thread.id}`} className="block">
												<p className="font-[family:var(--font-heading)] text-xl uppercase tracking-[-0.02em] transition hover:text-[var(--accent-soft)]">
													{thread.title}
												</p>
											</Link>
											{thread.mainPost && (
												<p className="theme-muted mt-2 line-clamp-2 text-sm">
													{thread.mainPost.content}
												</p>
											)}
											<div className="theme-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
												<span>Thread #{thread.id}</span>
												{thread.team ? (
													<Link
														href={`/teams/${thread.team.id}`}
														className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-2 py-0.5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_60%,var(--line))] hover:text-[var(--accent-soft)]"
													>
														<TeamLogo name={thread.team.name} logoUrl={thread.team.logoUrl} />
														{thread.team.name}
													</Link>
												) : null}
												{thread.match ? (
													<Link
														href={`/matches/${thread.match.id}`}
														className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-2 py-0.5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_60%,var(--line))] hover:text-[var(--accent-soft)]"
													>
														<TeamLogo name={thread.match.awayTeam.name} logoUrl={thread.match.awayTeam.logoUrl} />
														{thread.match.awayTeam.name}
														<span className="text-[10px] uppercase tracking-[0.12em]">at</span>
														<TeamLogo name={thread.match.homeTeam.name} logoUrl={thread.match.homeTeam.logoUrl} />
														{thread.match.homeTeam.name}
													</Link>
												) : null}
												{Array.isArray(thread.tags) && thread.tags.length > 0 ? (
													<>
														{thread.tags.map((t, idx) => (
															<Link
																	key={`${t.tag.name}-${idx}`}
																	href={`/forums?tags=${encodeURIComponent(t.tag.name)}`}
																	className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-2 py-0.5 transition hover:border-[color:color-mix(in_srgb,var(--accent)_60%,var(--line))] hover:text-[var(--accent-soft)]"
																>
																	<TeamLogo name={t.tag.name} logoUrl={null} />
																	{t.tag.name}
																</Link>
														))}
													</>
												) : null}
											</div>
										</div>
																{thread.isClosed ? (
																	<span className="shrink-0 rounded-full px-3 py-1 text-xs uppercase tracking-[0.12em] theme-warning-panel">
																		Closed
																	</span>
																) : (
																	<span className="shrink-0 rounded-full px-3 py-1 text-xs uppercase tracking-[0.12em] theme-accent-pill">
																		Open
																	</span>
																)}
									</div>
								</li>
							))}
						</ul>

						{/* Pagination */}
						<div className="mt-8 flex flex-col sm:flex-row items-center gap-3 sm:justify-between">
							<button
								disabled={page === 1}
								onClick={() => setPage(Math.max(1, page - 1))}
								className="w-full sm:w-auto rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--card-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								← Previous
							</button>

							<div className="flex items-center gap-2">
								<span className="theme-muted text-sm">
									Page <span className="font-semibold text-[var(--foreground)]">{page}</span>
								</span>
							</div>

							<button
								disabled={!hasNext}
								onClick={() => setPage(page + 1)}
								className="w-full sm:w-auto rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--card-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Next →
							</button>
						</div>
					</>
				)}
			</section>
		</div>
	);
}

function ForumsPageSkeleton() {
	return (
		<div className="space-y-8">
			<section className="overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-8 shadow-[var(--shadow)] sm:p-10 lg:p-12">
				<div className="h-4 w-28 animate-pulse rounded bg-[var(--card-soft)]" />
				<div className="mt-4 h-12 w-48 animate-pulse rounded bg-[var(--card-soft)]" />
				<div className="mt-5 h-6 max-w-3xl animate-pulse rounded bg-[var(--card-soft)]" />
			</section>

			<section className="theme-card rounded-[2rem] p-8">
				<div className="h-10 w-40 animate-pulse rounded bg-[var(--card-soft)]" />
				<div className="mt-6 space-y-3">
					{Array.from({ length: 5 }).map((_, index) => (
						<div
							key={index}
							className="h-20 animate-pulse rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)]"
						/>
					))}
				</div>
			</section>
		</div>
	);
}

function ChevronDownIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
	if (logoUrl) {
		return (
			<Image
				src={logoUrl}
				alt={`${name} logo`}
				width={14}
				height={14}
				className="h-[14px] w-[14px] rounded-full object-cover"
			/>
		);
	}

	return (
		<span className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-full bg-[var(--card-inset)] text-[9px] font-semibold text-[var(--accent)]">
			{name.charAt(0).toUpperCase()}
		</span>
	);
}
