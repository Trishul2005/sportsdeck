'use client';

import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CurrentUser = {
	id: number;
	email: string;
	username: string;
	avatar: string | null;
	favoriteTeamId: number | null;
	favoriteTeam?: {
		id: number;
		name: string;
		logoUrl: string | null;
	} | null;
	role: 'USER' | 'ADMIN' | string;
	isBanned: boolean;
	themeMode: 'LIGHT' | 'DARK';
};

type CurrentUserContextValue = {
	currentUser: CurrentUser | null;
	isAuthenticated: boolean;
	isLoaded: boolean;
	refreshCurrentUser: () => Promise<void>;
	setCurrentUser: Dispatch<SetStateAction<CurrentUser | null>>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined);

async function fetchCurrentUser(): Promise<CurrentUser | null> {
	const response = await fetch('/api/user/me', {
		cache: 'no-store',
		credentials: 'include',
	});
	const data = await response.json().catch(() => null);
	const normalizedUser = data?.user ?? data;
	return response.ok && normalizedUser?.id ? normalizedUser : null;
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);

	async function refreshCurrentUser() {
		try {
			const nextUser = await fetchCurrentUser();
			setCurrentUser(nextUser);
		} catch {
			setCurrentUser(null);
		} finally {
			setIsLoaded(true);
		}
	}

	useEffect(() => {
		void refreshCurrentUser();

		function handleRefresh() {
			void refreshCurrentUser();
		}

		window.addEventListener('sportsdeck:auth-changed', handleRefresh);
		window.addEventListener('sportsdeck:profile-updated', handleRefresh);

		return () => {
			window.removeEventListener('sportsdeck:auth-changed', handleRefresh);
			window.removeEventListener('sportsdeck:profile-updated', handleRefresh);
		};
	}, []);

	const value = useMemo(
		() => ({
			currentUser,
			isAuthenticated: Boolean(currentUser),
			isLoaded,
			refreshCurrentUser,
			setCurrentUser,
		}),
		[currentUser, isLoaded],
	);

	return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
	const context = useContext(CurrentUserContext);

	if (!context) {
		throw new Error('useCurrentUser must be used within a CurrentUserProvider');
	}

	return context;
}
