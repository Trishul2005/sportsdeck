import jwt from 'jsonwebtoken';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/prisma/db';

export async function getAuthUserFromCookie(request) {
	let token = request.cookies.get('accessToken')?.value;

	// auth issues.
	if (!token) {
		const authHeader = request.headers.get('Authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.substring(7); 
		}
	}

	if (!token) {
		try {
			const authToken = await getToken({
				req: request,
				secret: process.env.AUTH_SECRET,
			});

			if (authToken?.userId) {
				let user = await prisma.user.findUnique({
					where: { id: Number(authToken.userId) },
				});

				if (!user) {
					return { error: 'User not found', status: 401 };
				}

				if (!user.avatar && typeof authToken.avatar === 'string' && authToken.avatar.trim().length > 0) {
					user = {
						...user,
						avatar: authToken.avatar,
					};
				}

				const { password, ...userWithoutPassword } = user;
				user = userWithoutPassword;

				return {
					user,
					payload: {
						userId: user.id,
						username: user.username,
						role: user.role,
						avatar: user.avatar ?? null,
					},
				};
			}
		} catch {
			// Fall through to unauthorized response below.
		}

		return { error: 'Unauthorized', status: 401 };
	}

	try {
		const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

		let user = await prisma.user.findUnique({
			where: { id: payload.userId },
		});

		if (!user) {
			return { error: 'User not found', status: 401 };
		}

		const method = (request?.method || '').toUpperCase();
		// const isReadOnlyMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
		// if (user.isBanned && !isReadOnlyMethod) {
		// 	return { error: 'User is banned', status: 403 };
		// }

        let { password, ...userWithoutPassword } = user;
        user = userWithoutPassword;

		return { user, payload };
	} catch (error) {
		// Check if it's a token verification error
		if (error.name === 'JsonWebTokenError') {
			return { error: 'Invalid token', status: 401 };
		}
		return { error: 'Unauthorized', status: 401 };
	}
}
