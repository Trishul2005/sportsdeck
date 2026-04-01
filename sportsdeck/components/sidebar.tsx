'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';

const mainNavigation = [
	{ name: 'Feed', href: '/feed', icon: FeedIcon },
	{ name: 'Matches', href: '/matches', icon: CalendarIcon },
	{ name: 'Standings', href: '/standings', icon: TrophyIcon },
	{ name: 'Forums', href: '/forums', icon: MessageSquareIcon },
];

const secondaryNavigation = [
	{ name: 'AI Digest', href: '/digest', icon: TrendingUpIcon },
	{ name: 'Following', href: '/following', icon: UsersIcon },
];

const adminNavigation = [
	{ name: 'Reports', href: '/reports', icon: FlagIcon },
	{ name: 'Appeals', href: '/appeals', icon: ShieldIcon },
];

const bannedNavigation = [
	{ name: 'Appeal', href: '/appeal', icon: ShieldIcon },
];

type SidebarProps = {
	className?: string;
};

export function Sidebar({ className = '' }: SidebarProps) {
	const pathname = usePathname();
	const { currentUser } = useCurrentUser();

	const isAdmin = currentUser?.role === 'ADMIN';
	const isBanned = Boolean(currentUser?.isBanned);

	return (
		<aside
			className={`theme-glass hidden w-full max-w-[16.5rem] self-start overflow-hidden rounded-[2rem] lg:sticky lg:top-24 lg:block ${className}`}
		>
			<div className="max-h-[calc(100vh-7rem)] overflow-y-auto px-3 py-4">
				<div className="space-y-6">
					<NavGroup title="Menu">
						{mainNavigation.map((item) => (
							<NavLink
								key={item.name}
								href={item.href}
								label={item.name}
								icon={item.icon}
								active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
							/>
						))}
					</NavGroup>

					<NavDivider />

					<NavGroup title="Discover">
						{secondaryNavigation.map((item) => (
							<NavLink
								key={item.name}
								href={item.href}
								label={item.name}
								icon={item.icon}
								active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
							/>
						))}
					</NavGroup>

					{isAdmin ? (
						<>
							<NavDivider />

							<NavGroup title="Admin">
								{adminNavigation.map((item) => (
									<NavLink
										key={item.name}
										href={item.href}
										label={item.name}
										icon={item.icon}
										active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
									/>
								))}
							</NavGroup>
						</>
					) : null}

					{isBanned ? (
						<>
							<NavDivider />

							<NavGroup title="Account">
								{bannedNavigation.map((item) => (
									<NavLink
										key={item.name}
										href={item.href}
										label={item.name}
										icon={item.icon}
										active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
									/>
								))}
							</NavGroup>
						</>
					) : null}
				</div>
			</div>
		</aside>
	);
}

function NavGroup({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<h3 className="theme-muted px-3 text-[11px] font-semibold uppercase tracking-[0.2em]">
				{title}
			</h3>
			<div className="space-y-1">{children}</div>
		</div>
	);
}

function NavDivider() {
	return <div className="theme-divider mx-3 h-px" />;
}

function NavLink({
	href,
	label,
	icon: Icon,
	active,
}: {
	href: string;
	label: string;
	icon: (props: { active: boolean }) => React.ReactNode;
	active: boolean;
}) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-2.5 text-sm font-medium transition ${
				active
					? 'bg-[var(--accent)] text-black'
					: 'text-[color:color-mix(in_srgb,var(--foreground)_80%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)]'
			}`}
		>
			<Icon active={active} />
			<span>{label}</span>
		</Link>
	);
}

function baseIconClasses(active: boolean) {
	return active ? 'h-4 w-4 text-black' : 'h-4 w-4 text-[color:color-mix(in_srgb,var(--foreground)_70%,transparent)]';
}

function CalendarIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<rect x="3" y="4" width="18" height="17" rx="2" />
			<path d="M8 2v4M16 2v4M3 10h18" />
		</svg>
	);
}

function TrophyIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
			<path d="M17 5h3a2 2 0 0 1-2 2h-1M7 5H4a2 2 0 0 0 2 2h1" />
		</svg>
	);
}

function MessageSquareIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		</svg>
	);
}

function FeedIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M4 11a9 9 0 0 1 9 9" />
			<path d="M4 4a16 16 0 0 1 16 16" />
			<circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function UsersIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
			<circle cx="9.5" cy="7" r="3.5" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function TrendingUpIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M3 17 9 11l4 4 8-8" />
			<path d="M14 7h7v7" />
		</svg>
	);
}

function ShieldIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" />
		</svg>
	);
}

function FlagIcon({ active }: { active: boolean }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={baseIconClasses(active)}>
			<path d="M4 21V4" />
			<path d="m4 4 6-2 4 2 6-2v11l-6 2-4-2-6 2" />
		</svg>
	);
}
