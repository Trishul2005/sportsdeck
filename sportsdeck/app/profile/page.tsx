'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveTeamDivision } from '@/app/utils/teamDivision';

type Team = {
	id: number;
	name: string;
	logoUrl: string | null;
	conference: string;
	division: string;
	wins: number;
	losses: number;
};

type ActivityPost = {
	id: number;
	content: string;
	createdAt: string;
	updatedAt?: string;
	threadId: number | null;
};

type ActivityThread = {
	id: number;
	title: string;
	createdAt: string;
	updatedAt?: string;
	teamId: number | null;
};

type ActivityPoll = {
	id: number;
	question: string;
	createdAt: string;
	deadline: string;
	threadId?: number | null;
};

type ActivityReport = {
	id: number;
	reason: string;
	isResolved: boolean;
	createdAt: string;
};

type Appeal = {
	id: number;
	reason: string;
	status: string;
	createdAt: string;
};

type FollowRecord = {
	id: number;
};

type SocialUser = {
	id: number;
	username: string;
	avatar: string | null;
	followedAt: string;
};

type UserProfile = {
	id: number;
	email: string;
	username: string;
	avatar: string | null;
	favoriteTeamId: number | null;
	role: 'USER' | 'ADMIN';
	isBanned: boolean;
	themeMode: 'LIGHT' | 'DARK';
	createdAt: string;
	updatedAt: string;
	favoriteTeam: Team | null;
	posts: ActivityPost[];
	threads: ActivityThread[];
	polls: ActivityPoll[];
	reports: ActivityReport[];
	followers: FollowRecord[];
	following: FollowRecord[];
	appeals: Appeal[];
};

type TabKey = 'posts' | 'threads' | 'polls';
type SocialView = 'followers' | 'following' | null;
const ACTIVITY_PAGE_SIZE = 10;
const tabs: Array<{ key: TabKey; label: string }> = [
	{ key: 'posts', label: 'Posts' },
	{ key: 'threads', label: 'Threads' },
	{ key: 'polls', label: 'Polls' },
];

export default function ProfilePage() {
	const [user, setUser] = useState<UserProfile | null>(null);
	const [teams, setTeams] = useState<Team[]>([]);
	const [activeTab, setActiveTab] = useState<TabKey>('posts');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [pageError, setPageError] = useState('');
	const [saveMessage, setSaveMessage] = useState('');
	const [settingsError, setSettingsError] = useState('');
	const [form, setForm] = useState({
		username: '',
		favoriteTeamId: '',
	});
	const [avatarPreview, setAvatarPreview] = useState('');
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarRemoved, setAvatarRemoved] = useState(false);
	const [socialView, setSocialView] = useState<SocialView>(null);
	const [socialUsers, setSocialUsers] = useState<SocialUser[]>([]);
	const [isSocialLoading, setIsSocialLoading] = useState(false);
	const [socialError, setSocialError] = useState('');
	const [socialActionUserId, setSocialActionUserId] = useState<number | null>(null);
	const [teamPickerOpen, setTeamPickerOpen] = useState(false);
	const [activityYear, setActivityYear] = useState(new Date().getFullYear());
	const [activityPage, setActivityPage] = useState(1);
	const teamPickerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let isMounted = true;

		async function loadProfile() {
			try {
				const userResponse = await fetch('/api/user/profile', {
					credentials: 'include',
				});

				const userData = await userResponse.json();

				if (!isMounted) {
					return;
				}

				if (!userData || !userData.id) {
					setPageError('You need to be logged in to view your profile.');
					return;
				}

				setUser(userData);
				setForm({
					username: userData.username ?? '',
					favoriteTeamId: userData.favoriteTeamId ? String(userData.favoriteTeamId) : '',
				});
				setAvatarPreview('');
				setAvatarRemoved(false);
			} catch {
				if (isMounted) {
					setPageError('Failed to load your profile right now.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		loadProfile();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let isMounted = true;

		async function loadTeams() {
			try {
				const response = await fetch('/api/teams?limit=100', {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);

				if (!isMounted || !response.ok) {
					return;
				}

				const rawTeams: Team[] = Array.isArray(data?.teams) ? data.teams : [];
				const uniqueTeams: Team[] = Array.from(
					new Map(
						rawTeams
							.filter(
								(team: Team | null) =>
									team?.id &&
									team?.name &&
									typeof team.conference === 'string' &&
									team.conference.trim().length > 0,
							)
							.map((team: Team) => [team.name.trim().toLowerCase(), team]),
					).values(),
				).sort((a, b) => a.name.localeCompare(b.name));

				setTeams(uniqueTeams);
			} catch {
				if (isMounted) {
					setTeams([]);
				}
			}
		}

		loadTeams();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		return () => {
			if (avatarPreview.startsWith('blob:')) {
				URL.revokeObjectURL(avatarPreview);
			}
		};
	}, [avatarPreview]);

	useEffect(() => {
		if (!socialView) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setSocialView(null);
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [socialView]);

	useEffect(() => {
		if (!teamPickerOpen) {
			return;
		}

		function handlePointerDown(event: MouseEvent) {
			if (!teamPickerRef.current?.contains(event.target as Node)) {
				setTeamPickerOpen(false);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setTeamPickerOpen(false);
			}
		}

		window.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [teamPickerOpen]);

	const activityItems = useMemo(() => {
		if (!user) {
			return [];
		}

		switch (activeTab) {
			case 'posts':
				return user.posts.map((post) => ({
					id: post.id,
					title: post.content,
					meta: formatDate(post.updatedAt || post.createdAt),
					submeta: post.threadId ? `Thread #${post.threadId}` : 'Standalone post',
					href: post.threadId ? `/forums/${post.threadId}` : null,
				}));
			case 'threads':
				return user.threads.map((thread) => ({
					id: thread.id,
					title: thread.title,
					meta: formatDate(thread.updatedAt || thread.createdAt),
					submeta: thread.teamId ? `Team thread` : 'General thread',
					href: `/forums/${thread.id}`,
				}));
			case 'polls':
				return user.polls.map((poll) => ({
					id: poll.id,
					title: poll.question,
					meta: formatDate(poll.createdAt),
					submeta: `Deadline ${formatDate(poll.deadline)}`,
					href: poll.threadId ? `/forums/${poll.threadId}` : null,
				}));
			default:
				return [];
		}
	}, [activeTab, user]);

	const availableActivityYears = useMemo(() => {
		return buildAvailableActivityYears(user?.posts ?? []);
	}, [user?.posts]);

	useEffect(() => {
		if (availableActivityYears.length === 0) {
			setActivityYear(new Date().getFullYear());
			return;
		}

		setActivityYear((current) =>
			availableActivityYears.includes(current)
				? current
				: availableActivityYears[availableActivityYears.length - 1],
		);
	}, [availableActivityYears]);

	const postActivity = useMemo(() => {
		return buildPostActivityByYear(user?.posts ?? [], activityYear);
	}, [activityYear, user?.posts]);

	useEffect(() => {
		setActivityPage(1);
	}, [activeTab]);

	const paginatedActivityItems = useMemo(() => {
		const startIndex = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
		return activityItems.slice(startIndex, startIndex + ACTIVITY_PAGE_SIZE);
	}, [activityItems, activityPage]);

	const totalActivityPages = Math.max(
		1,
		Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE),
	);

	useEffect(() => {
		setActivityPage((current) => Math.min(current, totalActivityPages));
	}, [totalActivityPages]);

	const displayedAvatar = avatarFile
		? avatarPreview
		: avatarRemoved
			? ''
			: user?.avatar ?? '';
	const selectedFavoriteTeam = teams.find((team) => team.id === Number(form.favoriteTeamId)) ?? null;

	async function openSocialList(view: Exclude<SocialView, null>) {
		setSocialView(view);
		setSocialError('');
		setIsSocialLoading(true);

		try {
			const response = await fetch(`/api/user/${view}`, {
				credentials: 'include',
				cache: 'no-store',
			});
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setSocialUsers([]);
				setSocialError(data?.error || `Unable to load ${view} right now.`);
				return;
			}

			setSocialUsers(data?.[view] ?? []);
		} catch {
			setSocialUsers([]);
			setSocialError(`Unable to load ${view} right now.`);
		} finally {
			setIsSocialLoading(false);
		}
	}

	async function handleSocialAction(
		event: React.MouseEvent<HTMLButtonElement>,
		targetUserId: number,
		view: Exclude<SocialView, null>,
	) {
		event.preventDefault();
		event.stopPropagation();

		setSocialActionUserId(targetUserId);
		setSocialError('');

		try {
			const response = await fetch(
				view === 'followers'
					? `/api/user/followers/${targetUserId}`
					: `/api/user/${targetUserId}/follow`,
				{
					method: 'DELETE',
					credentials: 'include',
				},
			);
			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setSocialError(data?.error || 'Unable to update this relationship right now.');
				return;
			}

			setSocialUsers((current) => current.filter((socialUser) => socialUser.id !== targetUserId));
			setUser((current) => {
				if (!current) {
					return current;
				}

				return {
					...current,
					followers:
						view === 'following'
							? current.followers.slice(0, Math.max(0, current.followers.length - 1))
							: current.followers,
					following:
						view === 'followers'
							? current.following.slice(0, Math.max(0, current.following.length - 1))
							: current.following,
				};
			});
		} catch {
			setSocialError('Unable to update this relationship right now.');
		} finally {
			setSocialActionUserId(null);
		}
	}

	async function handleSave() {
		if (!user) {
			return;
		}

		const trimmedUsername = form.username.trim();
		if (!trimmedUsername) {
			setSaveMessage('');
			setSettingsError('Username cannot be blank.');
			return;
		}

		setIsSaving(true);
		setSaveMessage('');
		setSettingsError('');

		try {
			const profileResponse = await fetch('/api/user/profile', {
				method: 'PATCH',
				credentials: 'include',
				body: buildProfileFormData({
					username: trimmedUsername,
					favoriteTeamId: form.favoriteTeamId,
					avatarFile,
					existingAvatar: avatarRemoved ? '' : user.avatar ?? '',
				}),
			});

			const profileData = await profileResponse.json().catch(() => null);

			if (!profileResponse.ok) {
				setSettingsError(profileData?.error || 'Unable to save profile changes.');
				return;
			}

			const selectedTeam =
				teams.find((team) => team.id === Number(form.favoriteTeamId)) ?? null;

			setUser((current) =>
				current
					? {
							...current,
							...profileData,
							favoriteTeamId: form.favoriteTeamId
								? Number(form.favoriteTeamId)
								: null,
							avatar:
								profileData && Object.prototype.hasOwnProperty.call(profileData, 'avatar')
									? profileData.avatar
									: current.avatar,
							favoriteTeam: selectedTeam,
					  }
					: current,
			);
			window.dispatchEvent(
				new CustomEvent('sportsdeck:profile-updated', {
					detail: {
						username: trimmedUsername,
						avatar:
							profileData && Object.prototype.hasOwnProperty.call(profileData, 'avatar')
								? profileData.avatar
								: user.avatar,
					},
				}),
			);
			window.dispatchEvent(new Event('sportsdeck:auth-changed'));
			setAvatarPreview('');
			setAvatarFile(null);
			setAvatarRemoved(false);

			setSaveMessage('Profile updated successfully.');
		} catch {
			setSettingsError('Something went wrong while saving your profile.');
		} finally {
			setIsSaving(false);
		}
	}

	if (isLoading) {
		return (
			<div className="grid gap-6">
				<div className="h-56 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
					<div className="h-96 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
					<div className="h-96 animate-pulse rounded-[2rem] border border-[color:var(--line)] bg-[var(--card-soft)]" />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<section className="theme-danger-panel rounded-[2rem] p-8">
				<h1 className="font-[family:var(--font-heading)] text-3xl uppercase">
					Profile Unavailable
				</h1>
				<p className="mt-3 text-base opacity-80">
					{pageError || 'We could not load the current profile.'}
				</p>
			</section>
		);
	}

	return (
		<div className="grid max-w-full gap-5 overflow-x-hidden sm:gap-6">
			<section className="min-w-0 overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow)] sm:p-8 lg:p-10">
				<div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.95fr)] xl:items-start">
					<div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
						<div className="shrink-0">
							<div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-soft)] shadow-[var(--shadow)] sm:h-28 sm:w-28 lg:h-32 lg:w-32">
								{displayedAvatar ? (
									<img
										src={displayedAvatar}
										alt={`${user.username} avatar`}
										className="h-full w-full object-cover"
									/>
								) : (
									<DefaultAvatarIcon />
								)}
							</div>
						</div>

						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
								<h1 className="font-[family:var(--font-heading)] text-2xl font-semibold uppercase tracking-[-0.03em] sm:text-4xl lg:text-5xl">
									{user.username}
								</h1>
								<span className="rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-3 py-1 text-sm uppercase tracking-[0.16em] theme-muted">
									{user.role}
								</span>
								{user.isBanned ? (
									<span className="theme-danger-panel rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.14em]">
										Banned
									</span>
								) : null}
							</div>
							<p className="theme-muted mt-2 break-all text-sm sm:text-base">{user.email}</p>

							<div className="mt-5 grid gap-3 sm:grid-cols-2">
								<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-3">
									<p className="theme-muted text-xs uppercase tracking-[0.18em]">
										Favorite Team
									</p>
									<div className="mt-2 flex items-center justify-center sm:justify-start">
										<TeamBadge team={user.favoriteTeam} compact />
									</div>
								</div>

								<div className="rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-3">
									<p className="theme-muted text-xs uppercase tracking-[0.18em]">
										Joined
									</p>
									<p className="mt-2 text-sm font-medium text-[var(--foreground)]">
										{formatDate(user.createdAt)}
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
						<StatCard
							label="Followers"
							value={user.following.length}
							accent="text-[var(--accent)]"
							onClick={() => openSocialList('followers')}
						/>
						<StatCard
							label="Following"
							value={user.followers.length}
							accent="text-[var(--accent-soft)]"
							onClick={() => openSocialList('following')}
						/>
						<StatCard label="Posts" value={user.posts.length} accent="text-[var(--foreground)]" />
						<StatCard label="Threads" value={user.threads.length} accent="text-[var(--foreground)]" />
					</div>
				</div>
			</section>

			<section className="theme-card relative z-20 min-w-0 overflow-visible rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Public Profile
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Account Settings
						</h2>
					</div>
					<button
						type="button"
						onClick={handleSave}
						disabled={isSaving}
						className="w-full cursor-pointer rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
					>
						{isSaving ? 'Saving...' : 'Save Changes'}
					</button>
				</div>

				<div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<label className="grid gap-2">
							<span className="text-sm font-medium theme-muted">Username</span>
							<input
								value={form.username}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										username: event.target.value,
									}))
								}
								className="theme-input rounded-2xl px-4 py-3 outline-none transition"
							/>
						</label>

						<label className="grid gap-2">
							<span className="text-sm font-medium theme-muted">Email</span>
							<input
								value={user.email}
								disabled
								className="cursor-not-allowed rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-3 theme-muted outline-none"
							/>
						</label>

						<div className="grid self-start content-start gap-2">
							<span className="text-sm font-medium theme-muted">Favorite Team</span>
							<div ref={teamPickerRef} className="relative">
								<button
									type="button"
									onClick={() => setTeamPickerOpen((current) => !current)}
									className={`theme-input flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none transition ${
										teamPickerOpen ? 'border-[color:color-mix(in_srgb,var(--accent)_56%,var(--line))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]' : ''
									}`}
								>
									<div className="flex min-w-0 items-center gap-3">
										<TeamPickerBadge team={selectedFavoriteTeam} />
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-[var(--foreground)]">
												{selectedFavoriteTeam?.name || 'No favorite team'}
											</p>
											<p className="theme-muted truncate text-xs">
												{selectedFavoriteTeam
													? `${selectedFavoriteTeam.conference} / ${resolveTeamDivision(selectedFavoriteTeam.name, selectedFavoriteTeam.division)}`
													: 'Pick a team from the database'}
											</p>
										</div>
									</div>
									<span className={`shrink-0 theme-muted transition-transform ${teamPickerOpen ? 'rotate-180' : ''}`}>
										<SelectChevronIcon />
									</span>
								</button>

								{teamPickerOpen ? (
									<div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-50 overflow-hidden rounded-[1.35rem] border border-[color:var(--line)] bg-[var(--card)] shadow-[var(--shadow)] backdrop-blur-xl">
										<div className="max-h-72 overflow-y-auto p-2">
											<button
												type="button"
												onClick={() => {
													setForm((current) => ({
														...current,
														favoriteTeamId: '',
													}));
													setTeamPickerOpen(false);
												}}
												className="flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition hover:bg-[var(--card-soft)]"
											>
												<TeamPickerBadge team={null} />
												<div>
													<p className="text-sm font-semibold text-[var(--foreground)]">No favorite team</p>
													<p className="theme-muted text-xs">Clear current selection</p>
												</div>
											</button>

											{teams.map((team) => (
												<button
													key={team.id}
													type="button"
													onClick={() => {
														setForm((current) => ({
															...current,
															favoriteTeamId: String(team.id),
														}));
														setTeamPickerOpen(false);
													}}
													className={`mt-1 flex w-full items-center gap-3 rounded-[1rem] px-3 py-3 text-left transition hover:bg-[var(--card-soft)] ${
														Number(form.favoriteTeamId) === team.id ? 'bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''
													}`}
												>
													<TeamPickerBadge team={team} />
													<div className="min-w-0">
														<p className="truncate text-sm font-semibold text-[var(--foreground)]">{team.name}</p>
														<p className="theme-muted truncate text-xs">
															{team.conference} / {resolveTeamDivision(team.name, team.division)}
														</p>
													</div>
												</button>
											))}
										</div>
									</div>
								) : null}
							</div>
							<p className="theme-muted text-xs">
								Showing every unique team currently available in the database.
							</p>
						</div>

						<div className="grid gap-2 md:col-span-2 self-start min-w-0 rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 sm:p-5">
								<span className="text-sm font-medium theme-muted">Avatar</span>
								<input
									id="avatar-input"
									type="file"
									accept="image/*"
									onChange={(event) => {
										const file = event.target.files?.[0] ?? null;
										setAvatarFile(file);
										if (file) {
											setAvatarRemoved(false);
											setAvatarPreview(URL.createObjectURL(file));
										}
									}}
									className="sr-only"
								/>
								<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
									<label
										htmlFor="avatar-input"
										className={`inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition sm:w-auto ${
											avatarFile
												? 'border border-[var(--accent)] bg-[var(--accent)] text-black hover:opacity-90'
												: 'border border-[color:color-mix(in_srgb,var(--accent)_80%,transparent)] bg-transparent text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-[var(--accent-soft)]'
										}`}
									>
										{avatarFile ? 'Uploaded' : 'Upload Avatar'}
									</label>
									<button
										type="button"
										onClick={() => {
											setAvatarFile(null);
											setAvatarPreview('');
											setAvatarRemoved(true);
										}}
										disabled={!displayedAvatar}
										className="theme-danger-panel inline-flex min-h-12 w-full shrink-0 cursor-pointer items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:border-[color:var(--line)] disabled:bg-[var(--card-inset)] disabled:text-[color:color-mix(in_srgb,var(--foreground)_34%,transparent)] sm:w-auto"
										>
											Remove
										</button>
									</div>
								<p className="theme-muted text-xs">
									Upload a square image for the cleanest profile presentation across SportsDeck.
								</p>
						</div>
				</div>

				{settingsError ? (
					<p className="theme-danger-panel mt-5 rounded-2xl px-4 py-3 text-sm">
						{settingsError}
					</p>
				) : null}

				{saveMessage ? (
					<p className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
						{saveMessage}
					</p>
				) : null}
			</section>

			<section className="theme-card relative z-0 min-w-0 rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Activity
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Activity Chart
						</h2>
						<p className="theme-muted mt-3 max-w-2xl text-sm leading-6">
							Track how many posts you made throughout the selected year.
						</p>
					</div>

					<label className="grid gap-2">
						<span className="text-xs uppercase tracking-[0.18em] theme-muted">
							Year
						</span>
						<select
							value={activityYear}
							onChange={(event) => setActivityYear(Number(event.target.value))}
							className="theme-input cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition"
						>
							{availableActivityYears.map((year) => (
								<option key={year} value={year}>
									{year}
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="mt-8 min-w-0 rounded-[1.75rem] border border-[color:var(--line)] bg-[var(--card-inset)] p-4 sm:p-6">
					<div className="max-w-full overflow-x-auto pb-2">
						<ActivityHeatmap
							months={postActivity.months}
							totalPosts={postActivity.totalPosts}
							year={activityYear}
						/>
					</div>
				</div>
			</section>

			<section className="theme-card relative z-0 min-w-0 rounded-[2rem] p-5 sm:p-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
							Activity
						</p>
						<h2 className="mt-3 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
							Recent Contributions
						</h2>
					</div>

					<div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
						{tabs.map((tab) => (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className={`rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4 ${
									activeTab === tab.key
										? 'bg-[var(--accent)] text-black'
										: 'border border-[color:var(--line)] bg-[var(--card-soft)] theme-muted hover:opacity-90'
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				<div className="mt-8 grid gap-4">
					{activityItems.length === 0 ? (
						<div className="rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-12 text-center">
							<p className="font-[family:var(--font-heading)] text-2xl uppercase text-[var(--foreground)]">
								No {activeTab} Yet
							</p>
							<p className="theme-muted mt-3">
								This section is ready for activity once the user starts posting and
								participating.
							</p>
						</div>
					) : (
						paginatedActivityItems.map((item) => {
							const content = (
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
											{item.title}
										</h3>
										<p className="theme-muted mt-2 text-sm">{item.submeta}</p>
									</div>
									<span className="theme-muted text-xs sm:text-sm">{item.meta}</span>
								</div>
							);

							if (item.href) {
								return (
									<Link
										key={`${activeTab}-${item.id}`}
										href={item.href}
										className="block rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)] sm:px-5 sm:py-5"
									>
										{content}
									</Link>
								);
							}

							return (
								<article
									key={`${activeTab}-${item.id}`}
									className="rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 sm:px-5 sm:py-5"
								>
									{content}
								</article>
							);
						})
					)}
				</div>

				{activityItems.length > ACTIVITY_PAGE_SIZE ? (
					<div className="mt-6 flex flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
						<p className="theme-muted text-sm">
							Page {activityPage} of {totalActivityPages}
						</p>
						<div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
							<button
								type="button"
								onClick={() => setActivityPage((current) => Math.max(1, current - 1))}
								disabled={activityPage === 1}
								className="cursor-pointer rounded-full border border-[color:var(--line)] bg-[var(--card-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() =>
									setActivityPage((current) => Math.min(totalActivityPages, current + 1))
								}
								disabled={activityPage === totalActivityPages}
								className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
							</button>
						</div>
					</div>
				) : null}
			</section>

			{socialView ? (
				<div className="theme-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm">
					<div className="theme-card max-h-[80vh] w-full max-w-xl overflow-hidden rounded-[2rem]">
						<div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-6 py-5">
							<div>
								<p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
									Community
								</p>
								<h2 className="mt-2 font-[family:var(--font-heading)] text-3xl uppercase tracking-[-0.02em]">
									{socialView === 'followers' ? 'Followers' : 'Following'}
								</h2>
							</div>
							<button
								type="button"
								onClick={() => setSocialView(null)}
								className="theme-muted cursor-pointer rounded-xl px-3 py-2 text-sm transition hover:bg-[var(--card-inset)] hover:text-[var(--foreground)]"
							>
								Close
							</button>
						</div>

						<div className="max-h-[calc(80vh-6.5rem)] overflow-y-auto px-6 py-5">
							{isSocialLoading ? (
								<div className="grid gap-3">
									{Array.from({ length: 3 }).map((_, index) => (
										<div
											key={`social-loading-${index}`}
											className="h-18 animate-pulse rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)]"
										/>
									))}
								</div>
							) : socialError ? (
								<p className="theme-danger-panel rounded-2xl px-4 py-3 text-sm">
									{socialError}
								</p>
							) : socialUsers.length === 0 ? (
								<div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] px-6 py-10 text-center">
									<p className="font-[family:var(--font-heading)] text-2xl uppercase">
										No {socialView} yet
									</p>
									<p className="theme-muted mt-3 text-sm">
										{socialView === 'followers'
											? 'No one is following this account yet.'
											: 'This account is not following anyone yet.'}
									</p>
								</div>
							) : (
								<div className="grid gap-3">
									{socialUsers.map((socialUser) => (
										<Link
											key={`${socialView}-${socialUser.id}`}
											href={`/profile/${socialUser.id}`}
											className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4 transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)]"
										>
											<div className="flex min-w-0 items-center gap-3">
												<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[var(--card-soft)]">
													{socialUser.avatar ? (
														<img
															src={socialUser.avatar}
															alt={`${socialUser.username} avatar`}
															className="h-full w-full object-cover"
														/>
													) : (
														<DefaultAvatarIcon className="h-6 w-6" />
													)}
												</div>
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold text-[var(--foreground)]">
														{socialUser.username}
													</p>
													<p className="theme-muted mt-1 text-xs">
														{socialView === 'followers' ? 'Followed you' : 'You followed'}
														{' '}
														{formatDate(socialUser.followedAt)}
													</p>
												</div>
											</div>
											<button
												type="button"
												onClick={(event) =>
													handleSocialAction(event, socialUser.id, socialView)
												}
												disabled={socialActionUserId === socialUser.id}
												className="theme-danger-panel shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{socialActionUserId === socialUser.id
													? 'Saving...'
													: socialView === 'followers'
														? 'Remove'
														: 'Unfollow'}
											</button>
										</Link>
									))}
								</div>
							)}
						</div>
					</div>
					<button
						type="button"
						aria-label="Close follower list"
						onClick={() => setSocialView(null)}
						className="absolute inset-0 -z-10"
					/>
				</div>
			) : null}
		</div>
	);
}

function buildProfileFormData({
	username,
	favoriteTeamId,
	avatarFile,
	existingAvatar,
}: {
	username: string;
	favoriteTeamId: string;
	avatarFile: File | null;
	existingAvatar: string;
}) {
	const formData = new FormData();
	formData.append('username', username);
	formData.append('favoriteTeamId', favoriteTeamId);
	formData.append('avatar', existingAvatar);

	if (avatarFile) {
		formData.append('avatarFile', avatarFile);
	}

	return formData;
}

function StatCard({
	label,
	value,
	accent,
	onClick,
}: {
	label: string;
	value: number;
	accent: string;
	onClick?: () => void;
}) {
	const Element = onClick ? 'button' : 'div';

	return (
		<Element
			{...(onClick ? { type: 'button', onClick } : {})}
			className={`rounded-[1.25rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-3 py-3 text-left sm:rounded-[1.5rem] sm:px-4 sm:py-4 ${
				onClick
					? 'cursor-pointer transition hover:border-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-[var(--card-soft)]'
					: ''
			}`}
		>
			<p className="theme-muted text-xs uppercase tracking-[0.18em]">{label}</p>
			<p className={`mt-2 font-[family:var(--font-heading)] text-3xl sm:mt-3 sm:text-4xl ${accent}`}>
				{value}
			</p>
		</Element>
	);
}

function DefaultAvatarIcon({ className = 'h-[52px] w-[52px]' }: { className?: string }) {
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

function SelectChevronIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function TeamBadge({
	team,
	compact = false,
}: {
	team: Team | null;
	compact?: boolean;
}) {
	if (!team) {
		return (
			<div className={`flex items-center gap-3 ${compact ? '' : 'rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4'}`}>
				<div className="theme-muted flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card-soft)] text-sm font-semibold">
					--
				</div>
				{compact ? null : (
					<div>
						<p className="text-sm font-semibold text-[var(--foreground)]">No Favorite Team</p>
						<p className="theme-muted text-xs">Pick one in settings</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={`flex items-center gap-3 ${compact ? '' : 'rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card-inset)] px-4 py-4'}`}>
			<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--card-soft)]">
				{team.logoUrl ? (
					<Image
						src={team.logoUrl}
						alt={`${team.name} logo`}
						width={40}
						height={40}
						className="h-full w-full object-cover"
						unoptimized
					/>
				) : (
					<span className="theme-muted text-sm font-semibold">
						{getTeamCode(team.name)}
					</span>
				)}
			</div>
			{compact ? null : (
				<div>
					<p className="text-sm font-semibold text-[var(--foreground)]">{team.name}</p>
					<p className="theme-muted text-xs">
						{team.conference} • {resolveTeamDivision(team.name, team.division)}
					</p>
				</div>
			)}
		</div>
	);
}

function TeamPickerBadge({ team }: { team: Team | null }) {
	if (!team) {
		return (
			<div className="theme-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card-soft)] text-xs font-semibold">
				--
			</div>
		);
	}

	return (
		<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--card-soft)]">
			{team.logoUrl ? (
				<Image
					src={team.logoUrl}
					alt={`${team.name} logo`}
					width={40}
					height={40}
					className="h-full w-full object-contain"
					unoptimized
				/>
			) : (
				<span className="text-xs font-semibold text-[var(--accent)]">
					{getTeamCode(team.name)}
				</span>
			)}
		</div>
	);
}

function ActivityHeatmap({
	months,
	totalPosts,
	year,
}: {
	months: Array<{
		label: string;
		cells: Array<{ date: string; count: number; isPadding: boolean }>;
	}>;
	totalPosts: number;
	year: number;
}) {
	const maxCount = Math.max(
		...months.flatMap((month) =>
			month.cells.filter((cell) => !cell.isPadding).map((cell) => cell.count),
		),
		0,
	);
	const monthGroups = months.map((month) => {
		const weeks: Array<Array<{ date: string; count: number; isPadding: boolean }>> = [];
		for (let index = 0; index < month.cells.length; index += 7) {
			weeks.push(month.cells.slice(index, index + 7));
		}

		return {
			...month,
			weeks,
		};
	});

	return (
		<div className="min-w-max">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-sm font-semibold text-[var(--foreground)]">
						{totalPosts} post{totalPosts === 1 ? '' : 's'} in {year}
					</p>
					<p className="theme-muted mt-1 text-xs">
						Darker squares represent more posts on that day from January through December.
					</p>
				</div>

				<div className="flex items-center gap-2 text-xs theme-muted">
					<span>Less</span>
					<div className="flex items-center gap-1">
						{[0, 1, 2, 3, 4].map((level) => (
							<span
								key={level}
								className="h-3 w-3 rounded-[4px] border border-[color:var(--line)]"
								style={{
									backgroundColor: getActivityCellColor(level, 4, true),
								}}
							/>
						))}
					</div>
					<span>More</span>
				</div>
			</div>

			<div className="flex items-start gap-2">
				{monthGroups.map((month) => (
					<div key={month.label} className="shrink-0">
						<p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] theme-muted">
							{month.label}
						</p>
						<div className="flex gap-0.5">
							{month.weeks.map((week, weekIndex) => (
								<div key={`${month.label}-week-${weekIndex}`} className="flex flex-col gap-0.5">
									{week.map((cell, index) => (
										<div
											key={
												cell.isPadding
													? `${month.label}-pad-${weekIndex}-${index}`
													: cell.date
											}
											title={
												cell.isPadding
													? undefined
													: `${formatDate(cell.date)}: ${cell.count} post${cell.count === 1 ? '' : 's'}`
											}
											className={`h-2.5 w-2.5 rounded-[3px] border border-[color:var(--line)] ${
												cell.isPadding ? 'opacity-0' : 'transition hover:scale-110'
											}`}
											style={{
												backgroundColor: getActivityCellColor(
													cell.count,
													maxCount,
													!cell.isPadding,
												),
											}}
										/>
									))}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function getTeamCode(name: string) {
	const words = name
		.replace(/[^a-zA-Z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter(Boolean);

	if (words.length === 0) {
		return 'TM';
	}

	if (words.length === 1) {
		return words[0].slice(0, 3).toUpperCase();
	}

	return words
		.slice(0, 3)
		.map((word) => word[0]?.toUpperCase() || '')
		.join('')
		.slice(0, 3);
}

function formatDate(value: string) {
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function buildAvailableActivityYears(posts: ActivityPost[]) {
	if (posts.length === 0) {
		return [new Date().getFullYear()];
	}

	const years = posts
		.map((post) => new Date(post.createdAt).getFullYear())
		.filter((year) => Number.isFinite(year));
	const minYear = Math.min(...years);
	const maxYear = Math.max(...years);

	return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
}

function buildPostActivityByYear(posts: ActivityPost[], year: number) {
	const counts = new Map<string, number>();
	for (const post of posts) {
		const key = startOfDay(new Date(post.createdAt)).toISOString().slice(0, 10);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const months = Array.from({ length: 12 }, (_, monthIndex) => {
		const firstDay = new Date(year, monthIndex, 1);
		const lastDay = new Date(year, monthIndex + 1, 0);
		const cells: Array<{ date: string; count: number; isPadding: boolean }> = [];

		for (let padding = 0; padding < firstDay.getDay(); padding += 1) {
			cells.push({
				date: `${year}-${monthIndex + 1}-pad-${padding}`,
				count: 0,
				isPadding: true,
			});
		}

		for (let day = 1; day <= lastDay.getDate(); day += 1) {
			const current = startOfDay(new Date(year, monthIndex, day));
			const key = current.toISOString().slice(0, 10);
			cells.push({
				date: key,
				count: counts.get(key) ?? 0,
				isPadding: false,
			});
		}

		return {
			label: new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
				month: 'short',
			}),
			cells,
		};
	});

	return {
		months,
		totalPosts: posts.filter((post) => new Date(post.createdAt).getFullYear() === year).length,
	};
}

function startOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

function getActivityCellColor(count: number, maxCount: number, isCurrentRange: boolean) {
	if (!isCurrentRange) {
		return 'color-mix(in srgb, var(--card-soft) 75%, transparent)';
	}

	if (count <= 0) {
		return 'color-mix(in srgb, var(--foreground) 4%, var(--card-soft))';
	}

	const intensity = maxCount <= 1 ? 1 : count / maxCount;

	if (intensity < 0.34) {
		return 'color-mix(in srgb, var(--accent) 30%, var(--card-soft))';
	}

	if (intensity < 0.67) {
		return 'color-mix(in srgb, var(--accent) 55%, var(--card-soft))';
	}

	return 'color-mix(in srgb, var(--accent) 85%, black)';
}
