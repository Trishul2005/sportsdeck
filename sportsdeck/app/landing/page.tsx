'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/navbar';
import { ThreadCard } from '@/components/thread-card';

type BackendMatch = {
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
	thread?: {
		id: number;
		isClosed: boolean;
	} | null;
};

type MatchesResponse = {
	matches?: BackendMatch[];
	error?: string;
};

type LandingDigestResponse = {
	date?: string;
	digest?: string;
	aiDraft?: string | null;
	headline?: string;
	takeaways?: string[];
	discussionCards?: Array<{
		id: number;
		title: string;
		excerpt: string;
		href: string;
	}>;
	error?: string;
};

type LandingThread = {
	id: number;
	title: string;
	createdAt?: string;
	createdBy?: {
		username?: string;
	};
	_count?: {
		posts?: number;
	};
};

type LandingThreadsResponse = {
	items?: LandingThread[];
};

type LandingThreadCard = {
	id: string;
	code: string;
	title: string;
	author: string;
	date: string;
	count: number;
};

type LandingTeam = {
	id: number;
	name: string;
	logoUrl: string | null;
};

type LandingTeamsResponse = {
	teams?: LandingTeam[];
};

function ArrowRightIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="M5 12h14M13 6l6 6-6 6" />
		</svg>
	);
}

function TrendingUpIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m4 16 6-6 4 4 6-8" />
			<path d="M14 6h6v6" />
		</svg>
	);
}

function SparklesIcon({ className = 'h-4 w-4' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-2`}>
			<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
			<path d="M19 4v3M20.5 5.5h-3M5 16v2M6 17H4" />
		</svg>
	);
}

function UsersIcon({ className = 'h-4 w-4' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-2`}>
			<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
			<circle cx="9.5" cy="7" r="3" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 4.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function ZapIcon({ className = 'h-4 w-4' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-2`}>
			<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
		</svg>
	);
}

function GlobeIcon({ className = 'h-8 w-8' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-2`}>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
		</svg>
	);
}

function ShieldIcon({ className = 'h-8 w-8' }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-2`}>
			<path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3Z" />
			<path d="m9.5 12 1.7 1.7 3.3-3.7" />
		</svg>
	);
}

const pathwayCards = [
	{
		title: 'For casual fans',
		description: 'Drop in for scores, standings, and key match context without getting overwhelmed.',
		cta: 'Browse matches',
		href: '/matches',
		Icon: GlobeIcon,
	},
	{
		title: 'For die-hard supporters',
		description: 'Follow your team, jump into threads, and track every rivalry across the season.',
		cta: 'Open forums',
		href: '/forums',
		Icon: UsersIcon,
	},
	{
		title: 'For power users',
		description: 'Use AI summaries, trend tracking, and richer community views to stay ahead.',
		cta: 'Read digest',
		href: '/digest',
		Icon: ShieldIcon,
	},
];

const fadeUp = {
	initial: { opacity: 0, y: 28 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, amount: 0.2 },
	transition: { duration: 0.55, ease: 'easeOut' as const },
};

const staggerParent = {
	initial: { opacity: 0 },
	whileInView: {
		opacity: 1,
		transition: { staggerChildren: 0.1 },
	},
	viewport: { once: true, amount: 0.15 },
};

const staggerItem = {
	initial: { opacity: 0, y: 20 },
	whileInView: { opacity: 1, y: 0 },
	transition: { duration: 0.45, ease: 'easeOut' as const },
};

export default function LandingPage() {
	const [matches, setMatches] = useState<BackendMatch[]>([]);
	const [digest, setDigest] = useState<LandingDigestResponse | null>(null);
	const [trendingThreads, setTrendingThreads] = useState<LandingThreadCard[]>([]);
	const [teams, setTeams] = useState<LandingTeam[]>([]);
	const [isLoadingMatches, setIsLoadingMatches] = useState(true);
	const [isLoadingDigest, setIsLoadingDigest] = useState(true);
	const [isLoadingThreads, setIsLoadingThreads] = useState(true);

	useEffect(() => {
		let cancelled = false;

		async function loadMatches() {
			try {
				const today = new Date();
				const start = addDays(today, -1);
				const end = addDays(today, 7);
				const matchesResponse = await fetch(
					`/api/matches?fromDate=${formatIsoDate(start)}&toDate=${formatIsoDate(end)}&limit=12`,
					{ credentials: 'include', cache: 'no-store' },
				);
				const matchesPayload: MatchesResponse = await matchesResponse.json().catch(() => ({}));

				if (!cancelled) {
					setMatches(
						matchesResponse.ok && Array.isArray(matchesPayload.matches)
							? matchesPayload.matches
							: [],
					);
				}
			} catch {
				if (!cancelled) {
					setMatches([]);
				}
			} finally {
				if (!cancelled) {
					setIsLoadingMatches(false);
				}
			}
		}

		async function loadDigest() {
			try {
				const today = new Date();
				const digestResponse = await fetch(`/api/digest/daily?date=${formatIsoDate(today)}`, {
					credentials: 'include',
					cache: 'no-store',
				});
				const digestPayload: LandingDigestResponse = await digestResponse.json().catch(() => ({}));

				if (!cancelled) {
					setDigest(digestResponse.ok ? digestPayload : null);
				}
			} catch {
				if (!cancelled) {
					setDigest(null);
				}
			} finally {
				if (!cancelled) {
					setIsLoadingDigest(false);
				}
			}
		}

		async function loadThreads() {
			try {
				const threadsResponse = await fetch('/api/threads?includeMeta=true&includeTotal=false&page=1&pageSize=12&lite=true', {
					cache: 'no-store',
				});
				const threadsPayload: LandingThreadsResponse = await threadsResponse.json().catch(() => ({}));

				if (!cancelled) {
					setTrendingThreads(mapLandingThreads(threadsPayload.items));
				}
			} catch {
				if (!cancelled) {
					setTrendingThreads([]);
				}
			} finally {
				if (!cancelled) {
					setIsLoadingThreads(false);
				}
			}
		}

		async function loadTeams() {
			try {
				const teamsResponse = await fetch('/api/teams?limit=15', {
					credentials: 'include',
					cache: 'no-store',
				});
				const teamsPayload: LandingTeamsResponse = await teamsResponse.json().catch(() => ({}));

				if (!cancelled) {
					setTeams(
						teamsResponse.ok && Array.isArray(teamsPayload.teams)
							? teamsPayload.teams
							: [],
					);
				}
			} catch {
				if (!cancelled) {
					setTeams([]);
				}
			}
		}

		loadMatches();
		loadDigest();
		loadThreads();
		loadTeams();

		return () => {
			cancelled = true;
		};
	}, []);

	const featuredMatches = useMemo(() => {
		const live = matches.filter((match) => match.status === 'live');
		const upcoming = matches.filter((match) => getMatchBucket(match) === 'upcoming');
		return [...live, ...upcoming].slice(0, 2);
	}, [matches]);

	const upcomingMatches = useMemo(
		() => matches.filter((match) => getMatchBucket(match) === 'upcoming').slice(0, 2),
		[matches],
	);
	const landingDigestSummary = useMemo(
		() => getLandingDigestSummary(digest?.aiDraft || digest?.digest || ''),
		[digest],
	);
	const digestTopics = useMemo(() => {
		const discussionTitles = digest?.discussionCards?.slice(0, 2).map((item) => item.title) || [];
		const takeawayTopics = (digest?.takeaways || []).slice(0, 2).map(compactTakeaway);
		return [...discussionTitles, ...takeawayTopics].filter(Boolean).slice(0, 3);
	}, [digest]);
	const carouselTeams = useMemo(() => [...teams, ...teams], [teams]);

	return (
		<div className="theme-page min-h-screen text-[var(--foreground)]">
			<Navbar isAuthenticated={false} />

			<motion.section
				className="relative -mt-16 overflow-hidden pt-16"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5 }}
			>
				<div className="theme-hero absolute inset-0" />
				<div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-24 lg:px-8 lg:py-28">
					<div className="mx-auto max-w-4xl">
						<motion.div
							className="flex flex-col items-center text-center"
							initial={{ opacity: 0, y: 18 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, ease: 'easeOut' }}
						>
							<motion.div
								className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--card)_76%,transparent)] px-4 py-2 text-xs font-semibold text-[var(--foreground)]"
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.1, duration: 0.45 }}
							>
								<SparklesIcon className="h-3 w-3" />
								<span>NBA fan platform with AI context</span>
							</motion.div>
							<motion.h1
								className="mb-6 max-w-4xl font-[family:var(--font-heading)] text-5xl font-bold uppercase tracking-tight sm:text-6xl lg:text-7xl"
								initial={{ opacity: 0, y: 18 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.18, duration: 0.55 }}
							>
								Your Ultimate Sports Destination
							</motion.h1>
							<motion.p
								className="theme-muted mb-8 max-w-2xl text-lg leading-relaxed"
								initial={{ opacity: 0, y: 18 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.26, duration: 0.55 }}
							>
								Build your game-night routine around live scores, deeper team forums,
								fast AI summaries, and standings that tell the story of the NBA in
								real time.
							</motion.p>
							<motion.div
								className="flex flex-wrap justify-center gap-4"
								initial={{ opacity: 0, y: 18 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.34, duration: 0.55 }}
							>
								<motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
									<Link
										href="/signup"
										className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-black transition hover:opacity-90"
									>
										<span>Try SportsDeck free</span>
										<ArrowRightIcon />
									</Link>
								</motion.div>
								<motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
									<Link
										href="/forums"
										className="theme-panel inline-flex items-center rounded-2xl px-6 py-3.5 text-base font-semibold transition hover:opacity-90"
									>
										Explore forums
									</Link>
								</motion.div>
							</motion.div>
							<motion.div
								className="theme-muted mt-8 flex flex-wrap items-center justify-center gap-8 text-sm"
								initial={{ opacity: 0, y: 18 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.42, duration: 0.55 }}
							>
								<div className="flex items-center gap-2">
									<UsersIcon />
									<span>30 NBA teams covered</span>
								</div>
								<div className="flex items-center gap-2">
									<ZapIcon />
									<span>Real-time fan context</span>
								</div>
							</motion.div>
						</motion.div>
					</div>

					<motion.div
						className="mx-auto mt-16 max-w-6xl"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5, duration: 0.55 }}
					>
						<div className="carousel-fade relative overflow-hidden rounded-[2rem] bg-transparent px-3 py-6 sm:px-4">
							<motion.div
								className="flex w-max items-center gap-12 sm:gap-16"
								animate={{ x: ['0%', '-50%'] }}
								transition={{ duration: 42, ease: 'linear', repeat: Infinity }}
							>
								{carouselTeams.map((team, index) => (
									<Link
										key={`${team.id}-hero-${index}`}
										href={`/teams/${team.id}`}
										className="group shrink-0"
									>
										<div className="flex min-w-[120px] items-center justify-center">
											<div className="theme-subtle-surface flex h-20 w-20 items-center justify-center rounded-[1.6rem] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[color:color-mix(in_srgb,var(--accent)_22%,var(--line))] group-hover:bg-[color:color-mix(in_srgb,var(--accent)_8%,var(--card-soft))] sm:h-24 sm:w-24">
												{team.logoUrl ? (
													<Image
														src={team.logoUrl}
														alt={`${team.name} logo`}
														width={72}
														height={72}
														className="h-full w-full object-contain"
													/>
												) : (
													<span className="font-[family:var(--font-heading)] text-3xl tracking-[-0.04em] text-white/45 sm:text-4xl">
														{getTeamShortName(team.name)}
													</span>
												)}
											</div>
										</div>
									</Link>
								))}
							</motion.div>
						</div>
					</motion.div>

					{featuredMatches.length > 0 ? (
						<motion.div
							className="mx-auto mt-16 grid max-w-5xl gap-5 lg:grid-cols-2"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.58, duration: 0.55 }}
						>
							<div className="lg:col-span-2 text-center">
								<p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">Featured Matches</p>
							</div>
							{featuredMatches.map((match, index) => (
								<motion.div
									key={match.id}
									initial={{ opacity: 0, y: 24 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										delay: 0.66 + index * 0.1,
										duration: 0.5,
										ease: 'easeOut',
									}}
									whileHover={{ y: -4 }}
								>
									<LandingFeaturedMatchCard match={match} />
								</motion.div>
							))}
						</motion.div>
					) : null}
				</div>
			</motion.section>

			<motion.section {...fadeUp}>
				<div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
					<div className="mb-8 max-w-2xl">
						<p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">Choose your route</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl font-bold sm:text-4xl">
							Follow the league your way
						</h2>
					</div>
					<div className="grid gap-6 lg:grid-cols-3">
						{pathwayCards.map(({ title, description, cta, href, Icon }) => (
							<motion.div
								key={title}
								whileHover={{ y: -6 }}
								className="theme-card rounded-[1.9rem] p-7"
							>
								<div className="mb-5 text-[var(--accent)]">
									<Icon className="h-8 w-8" />
								</div>
								<h3 className="font-[family:var(--font-heading)] text-2xl">{title}</h3>
								<p className="theme-muted mt-3 text-sm leading-7">{description}</p>
								<Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
									<span>{cta}</span>
									<ArrowRightIcon />
								</Link>
							</motion.div>
						))}
					</div>
				</div>
			</motion.section>

			<motion.section className="mx-auto max-w-7xl px-4 py-16 lg:px-8" {...fadeUp}>
				<div className="mb-8 max-w-2xl">
					<p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">The features you need</p>
					<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl font-bold sm:text-4xl">
						All in one place
					</h2>
					<p className="theme-muted mt-3">
						Follow the NBA the way you want. SportsDeck keeps the experience fast and readable.
					</p>
				</div>

				<div className="grid gap-8 lg:grid-cols-3">
					<div>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-[family:var(--font-heading)] text-xl font-bold">Upcoming Matches</h2>
							<Link href="/matches" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
								<span>View All</span>
								<ArrowRightIcon />
							</Link>
						</div>
						<motion.div className="space-y-3" {...staggerParent}>
							{isLoadingMatches
								? Array.from({ length: 2 }).map((_, index) => (
										<div
											key={`landing-match-loading-${index}`}
											className="theme-panel rounded-[1.35rem] p-5"
										>
											<div className="h-4 animate-pulse rounded bg-[var(--card-soft)]" />
											<div className="mt-4 h-12 animate-pulse rounded-[1rem] bg-[var(--card-soft)]" />
											<div className="mt-3 h-12 animate-pulse rounded-[1rem] bg-[var(--card-soft)]" />
										</div>
									))
								: upcomingMatches.map((match) => (
										<motion.div key={match.id} variants={staggerItem} whileHover={{ y: -4 }}>
											<LandingCompactMatchCard match={match} />
										</motion.div>
									))}
						</motion.div>
					</div>

					<div>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="flex items-center gap-2 font-[family:var(--font-heading)] text-xl font-bold">
								<SparklesIcon className="h-5 w-5 text-[var(--accent)]" />
								<span>AI Digest</span>
							</h2>
							<Link href="/digest" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
								<span>Read More</span>
								<ArrowRightIcon />
							</Link>
						</div>
						<div className="rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[var(--card)] p-6">
							{isLoadingDigest ? (
								<div>
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0 flex-1">
											<div className="h-4 w-28 animate-pulse rounded bg-[var(--card-soft)]" />
											<div className="mt-4 h-8 w-48 animate-pulse rounded bg-[var(--card-soft)]" />
										</div>
										<div className="h-8 w-24 animate-pulse rounded-full bg-[var(--card-soft)]" />
									</div>
									<div className="mt-5 space-y-3">
										<div className="h-4 animate-pulse rounded bg-[var(--card-soft)]" />
										<div className="h-4 animate-pulse rounded bg-[var(--card-soft)]" />
										<div className="h-4 w-4/5 animate-pulse rounded bg-[var(--card-soft)]" />
									</div>
									<div className="mt-5 flex flex-wrap gap-2">
										<div className="h-7 w-28 animate-pulse rounded-full bg-[var(--card-soft)]" />
										<div className="h-7 w-32 animate-pulse rounded-full bg-[var(--card-soft)]" />
										<div className="h-7 w-24 animate-pulse rounded-full bg-[var(--card-soft)]" />
									</div>
								</div>
							) : (
								<>
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="theme-muted text-sm">Today&apos;s Summary</p>
											<h3 className="mt-3 font-[family:var(--font-heading)] text-2xl font-semibold tracking-[-0.02em]">
												{digest?.headline || 'Daily Digest'}
											</h3>
										</div>
										<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] theme-muted">
											{digest?.date ? formatLandingDigestDate(digest.date) : 'Quick read'}
										</span>
									</div>
									<p className="mt-4 text-base leading-7 text-[var(--foreground)]">
										{landingDigestSummary || 'Open the daily digest to catch up on the biggest NBA storylines.'}
									</p>
									<div className="mt-5 flex flex-wrap gap-2">
										{digestTopics.map((topic) => (
											<span key={topic} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1.5 text-xs text-[var(--foreground)]">
												<TrendingUpIcon />
												<span>{topic}</span>
											</span>
										))}
									</div>
								</>
							)}
						</div>
					</div>

					<div>
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-[family:var(--font-heading)] text-xl font-bold">Trending</h2>
							<Link href="/forums" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]">
								<span>View All</span>
								<ArrowRightIcon />
							</Link>
						</div>
						<motion.div className="space-y-2" {...staggerParent}>
							{isLoadingThreads
								? Array.from({ length: 3 }).map((_, index) => (
										<div
											key={`landing-thread-loading-${index}`}
											className="theme-panel rounded-[1.35rem] p-5"
										>
											<div className="flex items-start gap-4">
												<div className="h-11 w-11 animate-pulse rounded-2xl bg-[var(--card-soft)]" />
												<div className="min-w-0 flex-1">
													<div className="h-5 animate-pulse rounded bg-[var(--card-soft)]" />
													<div className="mt-3 h-4 w-32 animate-pulse rounded bg-[var(--card-soft)]" />
												</div>
											</div>
										</div>
									))
								: trendingThreads.map((thread) => (
										<motion.div key={thread.id} variants={staggerItem} whileHover={{ y: -4 }}>
											<Link href={`/forums/${thread.id}`} className="block">
												<ThreadCard thread={thread} variant="compact" />
											</Link>
										</motion.div>
									))}
						</motion.div>
					</div>
				</div>

			</motion.section>

			<motion.section {...fadeUp}>
				<div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
					<p className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">Join the SportsDeck community</p>
					<h2 className="mt-4 font-[family:var(--font-heading)] text-3xl font-bold sm:text-4xl">
						By fans, for fans
					</h2>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-4">
						<Link href="/forums" className="theme-panel rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90">
							Forums
						</Link>
						<Link href="/feed" className="theme-panel rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90">
							Feed
						</Link>
						<Link href="/matches" className="theme-panel rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90">
							Matches
						</Link>
					</div>
				</div>
			</motion.section>

			<motion.section {...fadeUp}>
				<div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
					<motion.div
						className="rounded-[2rem] border border-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--card)] p-8 text-center md:p-12"
						whileHover={{ scale: 1.01 }}
						transition={{ duration: 0.25 }}
					>
						<h2 className="mb-4 font-[family:var(--font-heading)] text-3xl font-bold">
							Get started
						</h2>
						<p className="theme-muted mx-auto mb-8 max-w-2xl">
							Create your account and build a faster way to follow the NBA with
							matches, forums, digest summaries, and team-first community spaces.
						</p>
						<div className="flex flex-wrap justify-center gap-4">
							<motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
								<Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-black transition hover:opacity-90">
									<span>Try SportsDeck</span>
									<ArrowRightIcon />
								</Link>
							</motion.div>
							<motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
								<Link href="/login" className="theme-panel inline-flex items-center rounded-2xl px-6 py-3.5 text-base font-semibold transition hover:opacity-90">
									Log in
								</Link>
							</motion.div>
						</div>
					</motion.div>
				</div>
			</motion.section>
		</div>
	);
}

function LandingFeaturedMatchCard({ match }: { match: BackendMatch }) {
	return (
		<Link
			href={`/matches/${match.id}`}
			className="block rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--card)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.20)]"
		>
			<div className="theme-muted flex items-center justify-between text-sm">
				<span className="theme-danger-panel rounded-full px-3 py-1 text-xs font-medium tracking-[0.04em]">
					{formatLandingMatchStatus(match)}
				</span>
				<span>{formatLandingMatchDay(match.tipOff)}</span>
			</div>

			<div className="mt-6 space-y-5">
				<LandingMatchTeamRow
					name={match.homeTeam}
					logoUrl={match.homeTeamLogoUrl}
					side="Home"
					score={match.score.home}
				/>
				<div className="theme-muted flex items-center gap-4 text-xs uppercase tracking-[0.3em]">
					<div className="h-px flex-1 bg-[var(--line)]" />
					<span>VS</span>
					<div className="h-px flex-1 bg-[var(--line)]" />
				</div>
				<LandingMatchTeamRow
					name={match.awayTeam}
					logoUrl={match.awayTeamLogoUrl}
					side="Away"
					score={match.score.away}
				/>
			</div>

			<div className="theme-muted mt-6 flex items-center justify-between text-sm">
				<span>{match.venue || 'Venue TBD'}</span>
				<span>{match.thread ? 'Discussion available' : 'No thread yet'}</span>
			</div>
		</Link>
	);
}

function LandingCompactMatchCard({ match }: { match: BackendMatch }) {
	return (
		<Link href={`/matches/${match.id}`} className="theme-panel block rounded-[1.35rem] p-5">
			<p className="text-sm font-semibold text-[var(--accent)]">{formatLandingMatchStatus(match)}</p>
			<div className="mt-4 space-y-3">
				<LandingCompactTeamRow name={match.homeTeam} logoUrl={match.homeTeamLogoUrl} />
				<LandingCompactTeamRow name={match.awayTeam} logoUrl={match.awayTeamLogoUrl} />
			</div>
		</Link>
	);
}

function LandingMatchTeamRow({
	name,
	logoUrl,
	side,
	score,
}: {
	name: string | null;
	logoUrl: string | null;
	side: 'Home' | 'Away';
	score: number | null;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex items-center gap-4">
				<LandingTeamLogo name={name} logoUrl={logoUrl} large />
				<div>
					<p className="text-[1.75rem] font-semibold leading-none text-[var(--foreground)]">
						{name || 'Team TBD'}
					</p>
					<p className="theme-muted mt-1 text-sm">{side}</p>
				</div>
			</div>
			<p className="text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
				{score ?? '--'}
			</p>
		</div>
	);
}

function LandingCompactTeamRow({ name, logoUrl }: { name: string | null; logoUrl: string | null }) {
	return (
		<div className="flex items-center gap-4">
			<LandingTeamLogo name={name} logoUrl={logoUrl} />
			<span className="text-base text-[var(--foreground)]">{name || 'Team TBD'}</span>
		</div>
	);
}

function LandingTeamLogo({
	name,
	logoUrl,
	large = false,
}: {
	name: string | null;
	logoUrl: string | null;
	large?: boolean;
}) {
	const size = large ? 48 : 36;
	const classes = large
		? 'h-12 w-12 rounded-2xl p-2'
		: 'flex h-9 w-9 items-center justify-center rounded-xl p-1.5';

	if (logoUrl) {
		return (
			<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card)] ${classes}`}>
				<Image
					src={logoUrl}
					alt={`${name || 'Team'} logo`}
					width={size}
					height={size}
					className="h-full w-full object-contain"
				/>
			</div>
		);
	}

	return (
		<div className={`flex items-center justify-center border border-[color:var(--line)] bg-[var(--card-inset)] ${classes}`}>
			<span className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--accent)]">
				{getTeamInitials(name)}
			</span>
		</div>
	);
}

function getMatchBucket(match: BackendMatch) {
	if (match.status === 'finished') {
		return 'finished';
	}

	const tipOffTime = match.tipOff ? new Date(match.tipOff).getTime() : NaN;
	if (!Number.isFinite(tipOffTime)) {
		return match.status === 'live' ? 'live' : 'upcoming';
	}

	const now = Date.now();
	const scheduledEnd = tipOffTime + 3 * 60 * 60 * 1000;
	if (match.status === 'live' || (now >= tipOffTime && now < scheduledEnd)) {
		return 'live';
	}
	if (now < tipOffTime) {
		return 'upcoming';
	}
	return 'finished';
}

function formatLandingMatchStatus(match: BackendMatch) {
	const bucket = getMatchBucket(match);
	if (bucket === 'live') {
		return 'LIVE';
	}
	if (bucket === 'finished') {
		return 'FINAL';
	}
	return formatLandingTime(match.tipOff);
}

function formatLandingMatchDay(tipOff: string | null) {
	if (!tipOff) return 'Upcoming';
	const date = new Date(tipOff);
	if (Number.isNaN(date.getTime())) return 'Upcoming';
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatLandingTime(tipOff: string | null) {
	if (!tipOff) return 'TBD';
	const date = new Date(tipOff);
	if (Number.isNaN(date.getTime())) return 'TBD';
	return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function addDays(date: Date, days: number) {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function formatIsoDate(date: Date) {
	return date.toISOString().slice(0, 10);
}

function getTeamInitials(name: string | null) {
	if (!name) return 'TM';
	return name
		.split(' ')
		.slice(0, 2)
		.map((part) => part[0])
		.join('')
		.slice(0, 2);
}

function getLandingDigestSummary(summary: string) {
	if (!summary) {
		return '';
	}

	const sentences =
		summary
			.match(/[^.!?]+[.!?]?/g)
			?.map((sentence) => sentence.trim())
			.filter(Boolean) || [];

	if (sentences.length === 0) {
		return summary;
	}

	return sentences.slice(0, 2).join(' ');
}

function mapLandingThreads(threads: LandingThread[] | undefined) {
	return (threads || [])
		.sort((a, b) => {
			const postDelta = (b._count?.posts ?? 0) - (a._count?.posts ?? 0);
			if (postDelta !== 0) {
				return postDelta;
			}
			return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
		})
		.slice(0, 3)
		.map((thread) => ({
			id: String(thread.id),
			code: getThreadCode(thread.title),
			title: thread.title,
			author: thread.createdBy?.username || 'SportsDeck user',
			date: formatRelativeThreadDate(thread.createdAt),
			count: thread._count?.posts ?? 0,
		}));
}

function getThreadCode(title: string) {
	return (
		title
			.split(' ')
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() || '')
			.join('')
			.slice(0, 2) || 'TH'
	);
}

function formatRelativeThreadDate(value?: string) {
	if (!value) {
		return 'Recently';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Recently';
	}

	const diffMs = Date.now() - date.getTime();
	const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
	if (diffHours < 1) {
		return 'Just now';
	}
	if (diffHours < 24) {
		return `${diffHours}h ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) {
		return `${diffDays}d ago`;
	}

	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function compactTakeaway(value: string) {
	if (!value) {
		return '';
	}

	const words = value.split(' ').slice(0, 4).join(' ');
	return words.length < value.length ? `${words}...` : words;
}

function getTeamShortName(name: string | null | undefined) {
	if (!name) {
		return 'TEAM';
	}

	return (
		name
			.split(' ')
			.map((part) => part[0] || '')
			.join('')
			.slice(0, 3)
			.toUpperCase() || 'TEAM'
	);
}

function formatLandingDigestDate(value: string) {
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
		new Date(`${value}T00:00:00.000Z`),
	);
}
