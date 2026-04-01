'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
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

export default function SignupPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		username: '',
		email: '',
		password: '',
		confirmPassword: '',
	});
	const [error, setError] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

	function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
		const { name, value } = event.target;
		setFormData((current) => ({
			...current,
			[name]: value,
		}));
		setError('');
		setSuccessMessage('');
	}

	async function handleGoogleSignup() {
		setError('');
		setSuccessMessage('');
		setIsGoogleSubmitting(true);

		try {
			await signIn('google', { callbackUrl: '/feed' });
		} catch {
			setError('Unable to start Google sign up right now.');
			setIsGoogleSubmitting(false);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError('');
		setSuccessMessage('');

		const username = formData.username.trim();
		const email = formData.email.trim().toLowerCase();

		if (!username || !email || !formData.password || !formData.confirmPassword) {
			setError('Please fill in all fields.');
			return;
		}

		if (formData.password.length < 6) {
			setError('Password must be at least 6 characters long.');
			return;
		}

		if (formData.password !== formData.confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch('/api/user/signup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username,
					email,
					password: formData.password,
				}),
			});

			const data = await response.json().catch(() => null);

			if (!response.ok) {
				setError(data?.error || 'Unable to create account right now.');
				return;
			}

			setSuccessMessage('Account created successfully. Redirecting to login...');
			setFormData({
				username: '',
				email: '',
				password: '',
				confirmPassword: '',
			});

			setTimeout(() => {
				router.push('/login');
			}, 1200);
		} catch {
			setError('Network error. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="theme-page grid min-h-screen place-items-center px-6 py-8 text-[var(--foreground)]">
			<section className="theme-card w-full max-w-md rounded-[2rem] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
				<p className="font-[family:var(--font-heading)] text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
					Join SportsDeck
				</p>
				<h1 className="mt-3 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em]">
					Create Account
				</h1>
				<p className="theme-muted mt-4 text-base leading-7">
					Create your account to join the conversation.
				</p>

				<form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
					<input
						type="text"
						name="username"
						placeholder="Username"
						value={formData.username}
						onChange={handleChange}
						className="theme-input rounded-2xl px-4 py-4 outline-none transition"
					/>
					<input
						type="email"
						name="email"
						placeholder="Email"
						value={formData.email}
						onChange={handleChange}
						className="theme-input rounded-2xl px-4 py-4 outline-none transition"
					/>
					<input
						type="password"
						name="password"
						placeholder="Password"
						value={formData.password}
						onChange={handleChange}
						className="theme-input rounded-2xl px-4 py-4 outline-none transition"
					/>
					<input
						type="password"
						name="confirmPassword"
						placeholder="Confirm password"
						value={formData.confirmPassword}
						onChange={handleChange}
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
						{isSubmitting ? 'Creating account...' : 'Create account'}
					</button>

					<button
						type="button"
						onClick={handleGoogleSignup}
						disabled={isGoogleSubmitting}
						className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[var(--card-inset)] px-5 py-4 text-base font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-soft)] disabled:cursor-not-allowed disabled:opacity-60"
					>
						<GoogleIcon />
						{isGoogleSubmitting ? 'Redirecting to Google...' : 'Continue with Google'}
					</button>
				</form>

				<p className="theme-muted mt-6 text-sm">
					Already have an account?{' '}
					<Link href="/login" className="font-semibold text-[var(--accent)] transition hover:text-[var(--accent-soft)]">
						Log in
					</Link>
				</p>
			</section>
		</main>
	);
}
