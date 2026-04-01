'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type GlobalLoadingContextValue = {
	isLoading: boolean;
	pendingRequests: number;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue>({
	isLoading: false,
	pendingRequests: 0,
});

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
	const [pendingRequests, setPendingRequests] = useState(0);
	const restoreFetchRef = useRef<typeof window.fetch | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const originalFetch = window.fetch.bind(window);
		restoreFetchRef.current = originalFetch;

		window.fetch = async (...args) => {
			setPendingRequests((count) => count + 1);

			try {
				return await originalFetch(...args);
			} finally {
				setPendingRequests((count) => Math.max(0, count - 1));
			}
		};

		return () => {
			if (restoreFetchRef.current) {
				window.fetch = restoreFetchRef.current;
			}
		};
	}, []);

	const value = useMemo(
		() => ({
			isLoading: pendingRequests > 0,
			pendingRequests,
		}),
		[pendingRequests],
	);

	return (
		<GlobalLoadingContext.Provider value={value}>
			<GlobalLoadingIndicator isVisible={value.isLoading} />
			{children}
		</GlobalLoadingContext.Provider>
	);
}

export function useGlobalLoading() {
	return useContext(GlobalLoadingContext);
}

function GlobalLoadingIndicator({ isVisible }: { isVisible: boolean }) {
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none fixed inset-x-0 top-0 z-[120] transition-opacity duration-200 ${
				isVisible ? 'opacity-100' : 'opacity-0'
			}`}
		>
			<div className="global-loading-bar" />
			<div className="global-loading-orb">
				<div className="global-loading-orb__ring" />
				<div className="global-loading-orb__dot" />
			</div>
		</div>
	);
}
