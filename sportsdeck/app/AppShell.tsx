'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';

const plainLayoutRoutes = new Set(['/landing', '/login', '/signup']);

export default function AppShell({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const pathname = usePathname();
	const { isAuthenticated } = useCurrentUser();

	if (pathname && plainLayoutRoutes.has(pathname)) {
		return <>{children}</>;
	}

	return (
		<div className="theme-page relative min-h-screen text-[var(--foreground)]">
			<div className="pointer-events-none absolute inset-0 theme-hero opacity-90" />
			<div className="relative">
				<Navbar isAuthenticated={isAuthenticated} />

				<main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
					<div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start">
						<Sidebar />
						<div className="min-w-0">{children}</div>
					</div>
				</main>
			</div>
		</div>
	);
}
