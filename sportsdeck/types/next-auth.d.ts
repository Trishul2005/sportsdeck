declare module 'next-auth' {
	interface Session {
		user: {
			id: number;
			username: string;
			role: string;
			isBanned: boolean;
			themeMode: string;
			avatar: string | null;
			favoriteTeamId: number | null;
		} & Session['user'];
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		userId?: number;
		username?: string;
		role?: string;
		isBanned?: boolean;
		themeMode?: string;
		avatar?: string | null;
		favoriteTeamId?: number | null;
	}
}
