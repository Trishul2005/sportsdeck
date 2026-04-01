'use client';

import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';
import { useTheme } from '@/components/providers/ThemeProvider';

type ThreadResult = { id: number; title: string; mainPost?: { content?: string } };
type PollResult = { id: number; question: string; threadId?: number | null; post?: { threadId?: number | null } | null };
type UserResult = { id: number; username: string; avatar?: string | null };
type MatchResult = { id: number; homeTeam: string; awayTeam: string; date?: string };
type TeamResult = { id: number; name: string; logoUrl?: string | null };
type TagResult = { id: number; name: string };
type SidebarTeam = { id: number; name: string; logoUrl: string | null; wins: number; losses: number };

type SearchResults = {
	threads?: ThreadResult[];
	polls?: PollResult[];
	users?: UserResult[];
	matches?: MatchResult[];
	teams?: TeamResult[];
	tags?: TagResult[];
};

const SEARCH_GROUPS: {
	key: keyof SearchResults;
	label: string;
	href: (item: unknown) => string;
}[] = [
	{ key: 'threads', label: 'Threads', href: (item) => `/forums/${(item as ThreadResult).id}` },
	{
		key: 'polls',
		label: 'Polls',
		href: (item: unknown) => {
			const poll = item as PollResult;
			const threadId = poll.threadId ?? poll.post?.threadId;
			return threadId ? `/forums/${threadId}` : `/poll/${poll.id}`;
		},
	},
	{ key: 'users', label: 'Users', href: (item) => `/profile/${(item as UserResult).id}` },
	{ key: 'matches', label: 'Matches', href: (item) => `/matches/${(item as MatchResult).id}` },
	{ key: 'teams', label: 'Teams', href: (item) => `/teams/${(item as TeamResult).id}` },
	{ key: 'tags', label: 'Tags', href: (item) => `/forums?tags=${encodeURIComponent((item as TagResult).name)}` },
];

const mainNavigation: Array<{ name: string; href: string }> = [
	{ name: 'Feed', href: '/feed' },
	{ name: 'Matches', href: '/matches' },
	{ name: 'Standings', href: '/standings' },
	{ name: 'Forums', href: '/forums' },
];

const secondaryNavigation = [
	{ name: 'AI Digest', href: '/digest' },
	{ name: 'Following', href: '/following' },
];

const adminNavigation = [
	{ name: 'Reports', href: '/reports' },
	{ name: 'Appeals', href: '/appeals' },
];

const bannedNavigation = [
	{ name: 'Appeal', href: '/appeal' },
];

function MenuIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
			<path d="M4 7h16M4 12h16M4 17h16" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
			<path d="M6 6l12 12M18 6 6 18" />
		</svg>
	);
}

function SearchIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
			<circle cx="11" cy="11" r="6" />
			<path d="m20 20-3.5-3.5" />
		</svg>
	);
}

function SunIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
			<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
		</svg>
	);
}

function LogOutIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
			<path d="M16 17l5-5-5-5M21 12H9" />
		</svg>
	);
}

function ProfileAvatar({
	username,
	avatar,
}: {
	username: string;
	avatar: string | null;
}) {
	if (avatar) {
		return (
			<img
				src={avatar}
				alt={`${username} avatar`}
				className="h-7 w-7 rounded-full border border-[color:var(--line)] object-cover"
			/>
		);
	}

	return (
		<div className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--card-inset)] text-[var(--muted)]">
			<DefaultAvatarIcon />
		</div>
	);
}

function DefaultAvatarIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<circle cx="12" cy="8" r="3.5" />
			<path d="M5 19c1.7-3 4.3-4.5 7-4.5s5.3 1.5 7 4.5" />
		</svg>
	);
}

type NavbarProps = {
	isAuthenticated?: boolean;
};

export function Navbar({ isAuthenticated = true }: NavbarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { theme, toggleTheme } = useTheme();
	const { currentUser, setCurrentUser } = useCurrentUser();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
	const [searchLoading, setSearchLoading] = useState<boolean>(false);
	const [searchError, setSearchError] = useState<string>('');
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [mobileTeams, setMobileTeams] = useState<SidebarTeam[]>([]);
	const isAdmin = currentUser?.role === 'ADMIN';
	const isBanned = Boolean(currentUser?.isBanned);
	// Search handler
	useEffect(() => {
		if (!searchOpen) {
			// Defer clearing state to avoid synchronous cascading setState warnings
			setTimeout(() => {
				setSearchQuery('');
				setSearchResults(null);
				setSearchError('');
				setSearchLoading(false);
			}, 0);
			return;
		}
		if (searchOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [searchOpen]);

	useEffect(() => {
		// Always show all groups, even if empty, and always search case-insensitively
		if (!searchQuery || searchQuery.trim().length < 1) {
			// Defer setting these values to avoid synchronous cascading setState warnings
			setTimeout(() => {
				setSearchResults({ threads: [], polls: [], users: [], matches: [], teams: [], tags: [] });
				setSearchError('');
				setSearchLoading(false);
			}, 0);
			return;
		}
		setSearchLoading(true);
		setSearchError('');
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: searchQuery }),
				signal: controller.signal,
			})
				.then((res) => res.json())
				.then((data) => {
					setSearchResults({
						threads: data.threads || [],
						polls: data.polls || [],
						users: data.users || [],
						matches: data.matches || [],
						teams: data.teams || [],
						tags: data.tags || [],
					});
					setSearchLoading(false);
				})
				.catch((err) => {
					if (err.name !== 'AbortError') {
						setSearchError('Search failed.');
						setSearchLoading(false);
					}
				});
		}, 300);
		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	}, [searchQuery]);

	useEffect(() => {
		function handleProfileUpdated(event: Event) {
			const detail =
				event instanceof CustomEvent &&
				event.detail &&
				typeof event.detail === 'object'
					? event.detail as { username?: string; avatar?: string | null }
					: null;

			if (detail) {
				setCurrentUser((current) =>
					current
						? {
								...current,
								username: typeof detail.username === 'string' && detail.username.trim().length > 0
									? detail.username
									: current.username,
								avatar: Object.prototype.hasOwnProperty.call(detail, 'avatar')
							? detail.avatar ?? null
									: current.avatar,
						  }
						: current,
				);
			}
		}

		window.addEventListener('sportsdeck:profile-updated', handleProfileUpdated as EventListener);
		return () => {
			window.removeEventListener('sportsdeck:profile-updated', handleProfileUpdated as EventListener);
		};
	}, [isAuthenticated]);

	useEffect(() => {
		if (!mobileMenuOpen) {
			document.body.style.overflow = '';
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [mobileMenuOpen]);

	useEffect(() => {
		let cancelled = false;

		async function loadTeams() {
			try {
				const response = await fetch('/api/teams?limit=5', {
					credentials: 'include',
					cache: 'no-store',
				});

				if (!response.ok) {
					if (!cancelled) {
						setMobileTeams([]);
					}
					return;
				}

				const data = await response.json().catch(() => null);
				if (!cancelled) {
					setMobileTeams(Array.isArray(data?.teams) ? data.teams : []);
				}
			} catch {
				if (!cancelled) {
					setMobileTeams([]);
				}
			}
		}

		loadTeams();

		return () => {
			cancelled = true;
		};
	}, []);

	async function handleLogout() {
		try {
			await fetch('/api/user/logout', {
				method: 'POST',
				credentials: 'include',
			});
		} catch {
			// Ignore network errors and still move user to login.
		}

		try {
			await signOut({ redirect: false });
		} catch {
			// Ignore OAuth sign-out issues and continue local cleanup.
		}

		setCurrentUser(null);
		window.dispatchEvent(new Event('sportsdeck:auth-changed'));
		router.push('/login');
		router.refresh();
	}

	return (
		<header className="sticky top-0 z-[80] w-full bg-transparent text-[var(--foreground)] backdrop-blur-xl">
			<nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-8">
				<div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-8">
					<Link href="/landing" className="flex shrink-0 items-center gap-2">
						<span className="shrink-0 whitespace-nowrap font-[family:var(--font-heading)] text-base font-bold tracking-tight text-[var(--foreground)] sm:text-xl">
							SportsDeck
						</span>
					</Link>

				</div>

				<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
					<div className={`hidden items-center transition-all md:flex ${searchOpen ? 'w-96' : 'w-auto'}`}>
						{searchOpen ? (
							<div className="relative w-full">
								<input
									ref={searchInputRef}
									value={searchQuery}
									onChange={e => setSearchQuery(e.target.value)}
									placeholder="Search anything..."
									className="theme-input w-full rounded-xl py-2 pl-10 pr-9 text-sm outline-none border border-[var(--line)] focus:border-[var(--accent)] shadow"
									onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
								/>
								<button
									onClick={() => setSearchOpen(false)}
									className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer theme-muted hover:text-[var(--foreground)]"
								>
									<CloseIcon />
								</button>
								<div className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted">
									<SearchIcon />
								</div>
								{/* Results Dropdown */}
								{searchOpen && (searchLoading || searchResults || searchError) && (
									<div className="absolute left-0 top-12 z-50 w-full rounded-xl bg-[var(--card)] shadow-lg border border-[var(--line)] max-h-96 overflow-y-auto">
										{searchLoading && (
											<div className="p-4 text-center text-sm text-[var(--muted)]">Searching...</div>
										)}
										{searchError && (
											<div className="p-4 text-center text-sm text-red-500">{searchError}</div>
										)}
										{searchResults && (
											<div>
												{SEARCH_GROUPS.filter(group => (searchResults[group.key] || []).length > 0).map(group => (
													<div key={group.key}>
														<div className="px-4 pt-3 pb-1 text-xs font-semibold text-[var(--muted)] uppercase">{group.label}</div>
														<ul>
															{(searchResults[group.key] || []).slice(0, 5).map(item => (
																<li key={item.id}>
																	<Link
																		href={group.href(item)}
																		className="block px-4 py-2 text-sm truncate transition transform-gpu hover:translate-x-1 hover:scale-[1.01] hover:bg-[var(--card-soft)]"
																		onClick={() => setSearchOpen(false)}
																	>
																				{(() => {
																					// Normalize various result shapes to safe display strings
																					const obj = item as any;
																					if (group.key === 'threads') return String(obj.title ?? '');
																					if (group.key === 'polls') return String(obj.question ?? '');
																					if (group.key === 'users') {
																						return (
																							<span className="flex items-center gap-2">
																								{obj.avatar && (
																									<Image src={String(obj.avatar)} alt={String(obj.username)} width={20} height={20} className="rounded-full object-cover" />
																								)}
																								{String(obj.username ?? '')}
																							</span>
																						);
																					}
																					if (group.key === 'matches') {
																						const homeName = typeof obj.homeTeam === 'string' ? obj.homeTeam : obj.homeTeam?.name ?? '';
																						const awayName = typeof obj.awayTeam === 'string' ? obj.awayTeam : obj.awayTeam?.name ?? '';
																						return `${homeName} vs ${awayName}`;
																					}
																					if (group.key === 'teams') {
																						return (
																							<span className="flex items-center gap-2">
																								{obj.logoUrl && (
																									<Image src={String(obj.logoUrl)} alt={String(obj.name)} width={20} height={20} className="rounded-full object-cover" />
																								)}
																								{String(obj.name ?? '')}
																							</span>
																						);
																					}
																					if (group.key === 'tags') {
																						return String(obj.name ?? '');
																					}
																					return '';
																				})()}
																	</Link>
																</li>
															))}
														</ul>
														{(searchResults[group.key] || []).length > 5 && (
															<div className="px-4 pb-2">
																<Link
																	href={`/search?q=${encodeURIComponent(searchQuery)}`}
																	className="block text-xs text-[var(--accent)] hover:underline"
																	onClick={() => setSearchOpen(false)}
																>
																	(See more...)
																</Link>
															</div>
														)}
													</div>
												))}
												{/* No results */}
												{SEARCH_GROUPS.every(group => (searchResults[group.key] || []).length === 0) && (
													<div className="p-4 text-center text-sm text-[var(--muted)]">No results found.</div>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<button
								onClick={() => setSearchOpen(true)}
								className="theme-muted theme-hover flex h-10 w-10 items-center justify-center rounded-xl"
								aria-label="Open search"
							>
								<SearchIcon />
							</button>
						)}
					</div>

					<button
						onClick={() => setSearchOpen((current) => !current)}
						className="theme-muted theme-hover flex h-10 w-10 items-center justify-center rounded-xl md:hidden"
						aria-label={searchOpen ? 'Close search' : 'Open search'}
					>
						{searchOpen ? <CloseIcon /> : <SearchIcon />}
					</button>

					<button
						onClick={toggleTheme}
						className="theme-muted theme-hover relative flex h-10 w-10 items-center justify-center rounded-xl"
						aria-label="Toggle theme"
					>
						{theme === 'DARK' ? <SunIcon /> : <MoonIcon />}
					</button>

					{currentUser ? (
						<div className="hidden items-center gap-2 sm:flex">
							<Link href="/profile" className="flex items-center gap-2 rounded-xl px-1 py-1 transition hover:bg-[var(--card-soft)]">
								<ProfileAvatar username={currentUser.username} avatar={currentUser.avatar} />
								<span className="max-w-[10rem] truncate text-sm font-medium text-[var(--foreground)]">
									{currentUser.username}
								</span>
							</Link>
							<button
								type="button"
								onClick={handleLogout}
								className="theme-danger-panel flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:opacity-90"
							>
								<LogOutIcon />
								<span>Log out</span>
							</button>
						</div>
					) : (
						<div className="hidden items-center gap-2 sm:flex">
							<Link href="/login" className="theme-hover rounded-xl px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
								Log in
							</Link>
							<Link href="/signup" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">
								Sign up
							</Link>
						</div>
					)}

					<button
						className="theme-muted theme-hover flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
						onClick={() => setMobileMenuOpen((current) => !current)}
						aria-label={mobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
					>
						{mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
					</button>
				</div>
			</nav>

			{searchOpen ? (
				<div className="fixed inset-x-0 top-16 z-[95] border-t border-[var(--line)] bg-[var(--background)] px-3 py-3 shadow-[var(--shadow)] md:hidden">
					<div className="mx-auto max-w-7xl">
						<div className="relative">
							<div className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted">
								<SearchIcon />
							</div>
							<input
								ref={searchInputRef}
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Search threads, teams..."
								className="theme-input w-full rounded-2xl py-3 pl-10 pr-10 text-sm outline-none"
							/>
							<button
								onClick={() => setSearchOpen(false)}
								className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1 theme-muted"
								aria-label="Close search"
							>
								<CloseIcon />
							</button>
						</div>

						{(searchLoading || searchError || (searchQuery.trim().length > 0 && searchResults)) && (
							<div className="mt-3 max-h-[min(24rem,calc(100dvh-10rem))] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow)]">
								{searchLoading ? <div className="text-sm theme-muted">Searching...</div> : null}
								{searchError ? <div className="text-sm text-red-500">{searchError}</div> : null}
								{searchResults ? (
									<div className="space-y-3">
										{SEARCH_GROUPS.filter((group) => (searchResults[group.key] || []).length > 0).map((group) => (
											<div key={group.key}>
												<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] theme-muted">{group.label}</p>
												<div className="space-y-1">
													{(searchResults[group.key] || []).slice(0, 3).map((item) => {
														const obj = item as any;
														const label =
															group.key === 'threads'
																? String(obj.title ?? '')
																: group.key === 'polls'
																	? String(obj.question ?? '')
																	: group.key === 'users'
																		? String(obj.username ?? '')
																		: group.key === 'matches'
																			? `${String(typeof obj.homeTeam === 'string' ? obj.homeTeam : obj.homeTeam?.name ?? '')} vs ${String(typeof obj.awayTeam === 'string' ? obj.awayTeam : obj.awayTeam?.name ?? '')}`
																			: group.key === 'teams'
																				? String(obj.name ?? '')
																				: String(obj.name ?? '');

														return (
															<Link
																key={obj.id}
																href={group.href(item)}
																onClick={() => {
																	setSearchOpen(false);
																	setMobileMenuOpen(false);
																}}
																className="block rounded-xl px-3 py-2 text-sm theme-hover"
															>
																{label}
															</Link>
														);
													})}
												</div>
											</div>
										))}
										{SEARCH_GROUPS.every((group) => (searchResults[group.key] || []).length === 0) ? (
											<div className="text-sm theme-muted">No results found.</div>
										) : null}
									</div>
								) : null}
							</div>
						)}
					</div>
				</div>
			) : null}

			{mobileMenuOpen ? (
				<div className="fixed inset-x-0 top-16 z-[90] h-[calc(100dvh-4rem)] border-t border-[var(--line)] bg-[var(--background)] lg:hidden">
					<div className="h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain bg-[var(--background)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[var(--shadow)]">
						{currentUser ? (
							<div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] p-4">
								<Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-[var(--card)]">
									<ProfileAvatar username={currentUser.username} avatar={currentUser.avatar} />
									<div className="min-w-0">
										<p className="truncate text-sm font-medium text-[var(--foreground)]">{currentUser.username}</p>
										<p className="mt-0.5 text-xs theme-muted">Profile and account shortcuts</p>
									</div>
								</Link>
								<button type="button" onClick={handleLogout} className="theme-danger-panel cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-red-500">
									Log out
								</button>
							</div>
						) : (
							<div className="mb-4 grid grid-cols-2 gap-2">
								<Link href="/login" onClick={() => setMobileMenuOpen(false)} className="theme-hover rounded-xl px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)]">
									Log in
								</Link>
								<Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-black transition hover:opacity-90">
									Sign up
								</Link>
							</div>
						)}

						<MobileMenuSection title="Menu">
							{mainNavigation.map((item) => (
								<MobileMenuLink
									key={item.name}
									href={item.href}
									label={item.name}
									active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
									onNavigate={() => setMobileMenuOpen(false)}
								/>
							))}
						</MobileMenuSection>

						<MobileMenuSection title="Discover">
							{secondaryNavigation.map((item) => (
								<MobileMenuLink
									key={item.name}
									href={item.href}
									label={item.name}
									active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
									onNavigate={() => setMobileMenuOpen(false)}
								/>
							))}
						</MobileMenuSection>

						<MobileMenuSection title="Teams">
							{mobileTeams.length > 0 ? (
								mobileTeams.map((team) => (
									<MobileMenuLink
										key={team.id}
										href={`/teams/${team.id}`}
										label={`${team.name} (${team.wins}-${team.losses})`}
										active={pathname === `/teams/${team.id}`}
										onNavigate={() => setMobileMenuOpen(false)}
									/>
								))
							) : (
								<p className="px-3 py-2 text-sm theme-muted">No teams available right now.</p>
							)}
							<MobileMenuLink
								href="/standings"
								label="View all teams"
								active={pathname === '/standings'}
								onNavigate={() => setMobileMenuOpen(false)}
							/>
						</MobileMenuSection>

						{isAdmin ? (
							<MobileMenuSection title="Admin">
								{adminNavigation.map((item) => (
									<MobileMenuLink
										key={item.name}
										href={item.href}
										label={item.name}
										active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
										onNavigate={() => setMobileMenuOpen(false)}
									/>
								))}
							</MobileMenuSection>
						) : null}

						{isBanned ? (
							<MobileMenuSection title="Account">
								{bannedNavigation.map((item) => (
									<MobileMenuLink
										key={item.name}
										href={item.href}
										label={item.name}
										active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
										onNavigate={() => setMobileMenuOpen(false)}
									/>
								))}
							</MobileMenuSection>
						) : null}
					</div>
				</div>
			) : null}
		</header>
	);
}

function MobileMenuSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-4 last:mb-0">
			<p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] theme-muted">
				{title}
			</p>
			<div className="space-y-1 rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] p-2">
				{children}
			</div>
		</div>
	);
}

function MobileMenuLink({
	href,
	label,
	active,
	onNavigate,
}: {
	href: string;
	label: string;
	active: boolean;
	onNavigate: () => void;
}) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			className={`block rounded-xl px-3 py-3 text-base font-medium transition-colors ${
				active ? 'bg-[var(--accent)] text-black' : 'text-[var(--foreground)] hover:bg-[var(--card)]'
			}`}
		>
			{label}
		</Link>
	);
}
