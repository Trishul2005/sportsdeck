'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
	{ href: '/feed', label: 'Feed', icon: RssIcon },
	{ href: '/matches', label: 'Matches', icon: CalendarIcon },
	{ href: '/standings', label: 'Standings', icon: TrophyIcon },
	{ href: '/forums', label: 'Forums', icon: ChatIcon },
];

const adminItems = [
	{ href: '/reports', label: 'Reports', icon: FlagIcon },
	{ href: '/appeals', label: 'Appeals', icon: ShieldAlertIcon },
];

const bannedItems = [
	{ href: '/appeal', label: 'Appeal', icon: ShieldAlertIcon },
];

type SidebarProps = {
	isMobileOpen?: boolean;
	onCloseMobile?: () => void;
};

export default function Sidebar({
	isMobileOpen = false,
	onCloseMobile,
}: SidebarProps) {
	const pathname = usePathname();
	const [isAdmin, setIsAdmin] = useState(false);
	const [isBanned, setIsBanned] = useState(false);

	useEffect(() => {
		let isMounted = true;

		async function loadUserState() {
			try {
				const response = await fetch('/api/user/me', {
					credentials: 'include',
					cache: 'no-store',
				});
				const data = await response.json().catch(() => null);

				if (!isMounted) {
					return;
				}

				const user = data?.user ?? data;
				setIsAdmin(user?.role === 'ADMIN');
				setIsBanned(Boolean(user?.isBanned));
			} catch {
				if (isMounted) {
					setIsAdmin(false);
					setIsBanned(false);
				}
			}
		}

		void loadUserState();

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<>
			{isMobileOpen ? (
				<button
					type="button"
					aria-label="Close menu overlay"
					onClick={onCloseMobile}
					className="fixed inset-0 z-30 bg-transparent lg:hidden"
				/>
			) : null}

			<aside
				className={`w-full lg:sticky lg:top-24 lg:max-w-[16.5rem] ${
					isMobileOpen
						? 'fixed left-4 right-4 top-24 z-40 block'
						: 'hidden lg:block'
				}`}
			>
				<div
					className={`overflow-hidden rounded-[2rem] border border-[color:var(--line)] px-3 py-4 text-[var(--foreground)] shadow-[var(--shadow)] ${
						isMobileOpen ? 'bg-[var(--card)]' : 'bg-[var(--card-soft)]'
					}`}
				>
					<div className="space-y-1.5">
						<h3 className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] theme-muted">
							Menu
						</h3>
						<div className="space-y-1">
							{navItems.map((item) => {
								const isActive =
									pathname === item.href || pathname.startsWith(`${item.href}/`);
								const Icon = item.icon;

								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={onCloseMobile}
										className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-2.5 text-sm font-medium transition ${
											isActive
												? 'bg-[var(--accent)] text-black'
											: 'theme-muted theme-hover'
										}`}
									>
										<Icon active={isActive} />
										<span>{item.label}</span>
									</Link>
								);
							})}
						</div>
					</div>

					{isAdmin ? (
						<div className="mt-5 space-y-1.5 border-t border-[color:var(--line)] pt-4">
							<h3 className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] theme-muted">
								Admin
							</h3>
							<div className="space-y-1">
								{adminItems.map((item) => {
									const isActive =
										pathname === item.href || pathname.startsWith(`${item.href}/`);
									const Icon = item.icon;

									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={onCloseMobile}
											className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-2.5 text-sm font-medium transition ${
												isActive
													? 'bg-[var(--accent)] text-black'
													: 'theme-muted theme-hover'
											}`}
										>
											<Icon active={isActive} />
											<span>{item.label}</span>
										</Link>
									);
								})}
							</div>
						</div>
					) : null}

					{isBanned ? (
						<div className="mt-5 space-y-1.5 border-t border-[color:var(--line)] pt-4">
							<h3 className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] theme-muted">
								Account
							</h3>
							<div className="space-y-1">
								{bannedItems.map((item) => {
									const isActive =
										pathname === item.href || pathname.startsWith(`${item.href}/`);
									const Icon = item.icon;

									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={onCloseMobile}
											className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-2.5 text-sm font-medium transition ${
												isActive
													? 'bg-[var(--accent)] text-black'
													: 'theme-muted theme-hover'
											}`}
										>
											<Icon active={isActive} />
											<span>{item.label}</span>
										</Link>
									);
								})}
							</div>
						</div>
					) : null}
				</div>
			</aside>
		</>
	);
}

function CalendarIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</svg>
	);
}

function TrophyIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<path d="M8 21h8" />
			<path d="M12 17v4" />
			<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
			<path d="M17 5h3a2 2 0 0 1-2 2h-1" />
			<path d="M7 5H4a2 2 0 0 0 2 2h1" />
		</svg>
	);
}

function ChatIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		</svg>
	);
}

function RssIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<path d="M4 11a9 9 0 0 1 9 9" />
			<path d="M4 4a16 16 0 0 1 16 16" />
			<circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function FlagIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<path d="M4 21V5" />
			<path d="M4 5h10l-1.5 3L14 11H4" />
		</svg>
	);
}

function ShieldAlertIcon({ active }: { active: boolean }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={active ? 'text-black' : 'theme-muted'}
		>
			<path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3Z" />
			<path d="M12 8v4" />
			<path d="M12 16h.01" />
		</svg>
	);
}
