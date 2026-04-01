'use client';

import {
	createContext,
	useContext,
	useEffect,
	useState,
} from 'react';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';

type ThemeMode = 'LIGHT' | 'DARK';

type ThemeContextValue = {
	theme: ThemeMode;
	isLoaded: boolean;
	toggleTheme: () => void;
	setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'sportsdeck-theme';

function getStoredOrSystemTheme(): ThemeMode {
	const savedTheme =
		typeof window !== 'undefined'
			? window.localStorage.getItem(STORAGE_KEY)
			: null;

	const systemTheme =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: light)').matches
			? 'LIGHT'
			: 'DARK';

	return savedTheme === 'LIGHT' || savedTheme === 'DARK'
		? (savedTheme as ThemeMode)
		: systemTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>('DARK');
	const [isLoaded, setIsLoaded] = useState(false);
	const { currentUser, isAuthenticated } = useCurrentUser();

	useEffect(() => {
		const initialTheme = getStoredOrSystemTheme();

		applyTheme(initialTheme);
		setThemeState(initialTheme);
		setIsLoaded(true);
	}, []);

	useEffect(() => {
		const fallbackTheme = getStoredOrSystemTheme();
		const nextTheme =
			currentUser?.themeMode === 'LIGHT' || currentUser?.themeMode === 'DARK'
				? currentUser.themeMode
				: fallbackTheme;

		setThemeState(nextTheme);
		applyTheme(nextTheme);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(STORAGE_KEY, nextTheme);
		}
	}, [currentUser]);

	function applyTheme(nextTheme: ThemeMode) {
		if (typeof document === 'undefined') {
			return;
		}

		const domTheme = nextTheme === 'LIGHT' ? 'light' : 'dark';
		document.documentElement.dataset.theme = domTheme;
		document.documentElement.style.colorScheme = domTheme;
	}

	async function persistTheme(nextTheme: ThemeMode) {
		if (!isAuthenticated) {
			return;
		}

		try {
			await fetch('/api/user/theme', {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ themeMode: nextTheme }),
			});
		} catch {}
	}

	function setTheme(nextTheme: ThemeMode) {
		setThemeState(nextTheme);
		applyTheme(nextTheme);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(STORAGE_KEY, nextTheme);
		}
		void persistTheme(nextTheme);
	}

	function toggleTheme() {
		setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK');
	}

	const value = {
		theme,
		isLoaded,
		toggleTheme,
		setTheme,
	};

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);

	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}

	return context;
}
