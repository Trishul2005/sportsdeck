import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/prisma/db';
import { invalidateUserMeCache } from '@/app/utils/userMeCache';
import { invalidateRouteCache } from '@/app/utils/routeCache';

function slugifyUsername(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 18);
}

async function generateUniqueUsername(email: string | null | undefined, name?: string | null) {
	const emailPrefix = email?.split('@')[0] || '';
	const base =
		slugifyUsername(name || '') ||
		slugifyUsername(emailPrefix) ||
		'user';

	let candidate = base;
	let counter = 1;

	while (true) {
		const existing = await prisma.user.findUnique({
			where: { username: candidate },
			select: { id: true },
		});

		if (!existing) {
			return candidate;
		}

		counter += 1;
		candidate = `${base}${counter}`.slice(0, 24);
	}
}

export const authOptions = {
	secret: process.env.AUTH_SECRET,
	session: {
		strategy: 'jwt' as const,
	},
	providers: [
		GoogleProvider({
			clientId: process.env.AUTH_GOOGLE_ID || '',
			clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
		}),
	],
	callbacks: {
		async signIn({ user }: { user: { email?: string | null; image?: string | null; name?: string | null } }) {
			if (!user.email) {
				return false;
			}

			const existingUser = await prisma.user.findUnique({
				where: { email: user.email.toLowerCase() },
				select: { id: true, username: true, role: true, isBanned: true, themeMode: true, avatar: true, favoriteTeamId: true },
			});

			if (!existingUser) {
				const username = await generateUniqueUsername(user.email, user.name);
				const createdUser = await prisma.user.create({
					data: {
						email: user.email.toLowerCase(),
						username,
						password: null,
						avatar: null,
						role: 'USER',
						isBanned: false,
						themeMode: 'LIGHT',
					},
				});
				await invalidateUserMeCache(createdUser.id);
				await invalidateRouteCache();
				return true;
			}

			return true;
		},
		async jwt({ token, user }: { token: any; user?: { email?: string | null; image?: string | null; name?: string | null } | null }) {
			const email = user?.email || token.email;

			if (email) {
				const appUser = await prisma.user.findUnique({
					where: { email: email.toLowerCase() },
					select: {
						id: true,
						email: true,
						username: true,
						avatar: true,
						role: true,
						isBanned: true,
						themeMode: true,
						favoriteTeamId: true,
					},
				});

				if (appUser) {
					token.userId = appUser.id;
					token.username = appUser.username;
					token.role = appUser.role;
					token.isBanned = appUser.isBanned;
					token.themeMode = appUser.themeMode;
					token.avatar = appUser.avatar;
					token.favoriteTeamId = appUser.favoriteTeamId;
				}
			}

			return token;
		},
		async session({ session, token }: { session: any; token: any }) {
			if (session.user) {
				session.user.id = token.userId as number;
				session.user.username = token.username as string;
				session.user.role = token.role as string;
				session.user.isBanned = Boolean(token.isBanned);
				session.user.themeMode = token.themeMode as string;
				session.user.avatar = (token.avatar as string | null) ?? null;
				session.user.favoriteTeamId = (token.favoriteTeamId as number | null) ?? null;
			}

			return session;
		},
	},
	pages: {
		signIn: '/login',
	},
};
