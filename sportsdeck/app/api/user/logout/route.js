import { NextResponse } from 'next/server';
import { revokeRefreshToken } from '@/lib/tokens';

export async function POST(request) {
	const refreshToken = request.cookies.get('refreshToken')?.value;

	if (refreshToken) {
		try {
			await revokeRefreshToken(refreshToken);
		} catch (error) {
			console.error('Failed to revoke refresh token during logout:', error);
		}
	}

	const response = NextResponse.json(
		{ message: 'Logout successful' },
		{ status: 200 },
	);

	response.cookies.delete('accessToken');
	response.cookies.delete('refreshToken');

	return response;
}
