'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
			<path
				fill="#EA4335"
				d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3.1l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.5-.2-2.1H12Z"
			/>
			<path
				fill="#34A853"
				d="M12 21c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.3-4H3.5v2.5C5.1 18.9 8.2 21 12 21Z"
			/>
			<path
				fill="#4A90E2"
				d="M6.7 13.1c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V6.8H3.5C2.9 8 2.5 9.3 2.5 10.7s.4 2.7 1 3.9l3.2-2.5Z"
			/>
			<path
				fill="#FBBC05"
				d="M12 5.3c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.3 14.6 1.5 12 1.5 8.2 1.5 5.1 3.6 3.5 6.8l3.2 2.5c.7-2.3 2.8-4 5.3-4Z"
			/>
		</svg>
	);
}

export default function LoginPage() {
	const router = useRouter();
	const [identifier, setIdentifier] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError('');
		setSuccessMessage('');

		const trimmedIdentifier = identifier.trim();

		if (!trimmedIdentifier || !password) {
			setError('Please enter your username or email, and your password.');
			return;
		}

		setIsSubmitting(true);

		try {
			const payload = trimmedIdentifier.includes('@')
				? { email: trimmedIdentifier.toLowerCase(), password }
				: { username: trimmedIdentifier, password };

			const response = await fetch('/api/user/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setError(data?.error || 'Unable to log in right now.');
				return;
			}

			setSuccessMessage('Login successful. Redirecting...');
			window.dispatchEvent(new Event('sportsdeck:auth-changed'));

			setTimeout(() => {
				router.push('/feed');
				router.refresh();
			}, 1000);
		} catch {
			setError('Network error. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleGoogleLogin() {
		setError('');
		setSuccessMessage('');
		setIsGoogleSubmitting(true);

		try {
			await signIn('google', { callbackUrl: '/feed' });
		} catch {
			setError('Unable to start Google sign in right now.');
			setIsGoogleSubmitting(false);
		}
	}

	return (
		<main className="theme-page grid min-h-screen place-items-center px-6 py-8 text-[var(--foreground)]">
			<section className="theme-card w-full max-w-md rounded-[2rem] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
				<p className="font-[family:var(--font-heading)] text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
					Welcome Back
				</p>
				<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em]">
					Log In
				</h1>
				<p className="theme-muted mt-4 text-base leading-7">
					Sign in to continue into SportsDeck.
				</p>

				<form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
					<input
						type="text"
						placeholder="Username or email"
						value={identifier}
						onChange={(event) => {
							setIdentifier(event.target.value);
							setError('');
							setSuccessMessage('');
						}}
						className="theme-input rounded-2xl px-4 py-4 outline-none transition"
					/>
					<input
						type="password"
						placeholder="Password"
						value={password}
						onChange={(event) => {
							setPassword(event.target.value);
							setError('');
							setSuccessMessage('');
						}}
						className="theme-input rounded-2xl px-4 py-4 outline-none transition"
					/>

					{error ? (
						<p className="theme-danger-panel rounded-2xl px-4 py-3 text-sm">
							{error}
						</p>
					) : null}

					{successMessage ? (
						<p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
							{successMessage}
						</p>
					) : null}

					<button
						type="submit"
						disabled={isSubmitting}
						className="mt-2 cursor-pointer rounded-2xl bg-[var(--accent)] px-5 py-4 text-base font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSubmitting ? 'Logging in...' : 'Log in'}
					</button>

					<button
						type="button"
						onClick={handleGoogleLogin}
						disabled={isGoogleSubmitting}
						className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-4 text-base font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<GoogleIcon />
						{isGoogleSubmitting ? 'Redirecting to Google...' : 'Continue with Google'}
					</button>
				</form>

				<p className="theme-muted mt-6 text-sm">
					Don&apos;t have an account?{' '}
					<Link
						href="/signup"
						className="font-semibold text-[var(--accent)] transition hover:text-[var(--accent-soft)]"
					>
						Create account
					</Link>
				</p>
			</section>
		</main>
	);
}
