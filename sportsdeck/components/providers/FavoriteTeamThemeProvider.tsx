'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';
import { DEFAULT_THEME_COLOR, getTeamThemeColor, withAlpha } from '@/lib/team-theme';

function applyThemeColor(color: string) {
	const root = document.documentElement;
	root.style.setProperty('--hero-glow', withAlpha(color, 0.28));
	root.style.setProperty('--accent', color);
	root.style.setProperty('--accent-soft', withAlpha(color, 0.72));
}

export function FavoriteTeamThemeProvider({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { currentUser } = useCurrentUser();

	useEffect(() => {
		const color = getTeamThemeColor(currentUser?.favoriteTeam?.name ?? null);
		applyThemeColor(color || DEFAULT_THEME_COLOR);
	}, [currentUser]);

	return <>{children}</>;
}
