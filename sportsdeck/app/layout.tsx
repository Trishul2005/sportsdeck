import './globals.css';
import AppShell from '@/app/AppShell';
import { CurrentUserProvider } from '@/components/providers/CurrentUserProvider';
import { FavoriteTeamThemeProvider } from '@/components/providers/FavoriteTeamThemeProvider';
import { GlobalLoadingProvider } from '@/components/providers/GlobalLoadingProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
export const metadata = {
	title: 'SportsDeck | The Ultimate Hub for Sports Fans',
	description:
		'A bold basketball-first fan platform for matchday conversation, standings, AI digest highlights, and community energy.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="theme-page min-h-screen antialiased">
				<CurrentUserProvider>
					<ThemeProvider>
						<FavoriteTeamThemeProvider>
							<GlobalLoadingProvider>
								<AppShell>{children}</AppShell>
							</GlobalLoadingProvider>
						</FavoriteTeamThemeProvider>
					</ThemeProvider>
				</CurrentUserProvider>
			</body>
		</html>
	);
}
