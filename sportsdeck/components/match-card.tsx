import type { Match } from '@/lib/mock-data';

function VenueIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z" />
			<circle cx="12" cy="10" r="2" />
		</svg>
	);
}

function DiscussionIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
			<path d="M4 6h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-9l-5 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
		</svg>
	);
}

type MatchCardProps = {
	match: Match;
	variant?: 'featured' | 'compact';
};

export function MatchCard({ match, variant = 'featured' }: MatchCardProps) {
	if (variant === 'compact') {
		return (
			<div className="theme-panel rounded-[1.35rem] p-5">
				<p className="text-sm font-semibold text-[var(--accent)]">{match.periodLabel}</p>
				<div className="mt-4 space-y-3">
					<div className="flex items-center gap-4">
						<span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white ${match.home.color}`}>
							{match.home.code}
						</span>
						<span className="text-base text-[var(--foreground)]">{match.home.name}</span>
					</div>
					<div className="flex items-center gap-4">
						<span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white ${match.away.color}`}>
							{match.away.code}
						</span>
						<span className="text-base text-[var(--foreground)]">{match.away.name}</span>
					</div>
				</div>
			</div>
		);
	}

	return (
		<article className="rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[var(--card)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.20)]">
			<div className="theme-muted flex items-center justify-between text-sm">
				<span className="theme-danger-panel rounded-full px-3 py-1 text-xs font-medium tracking-[0.04em]">
					{match.periodLabel}
				</span>
				<span>{match.matchday}</span>
			</div>

			<div className="mt-6 space-y-5">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white ${match.home.color}`}>
							{match.home.code}
						</div>
						<div>
							<p className="text-[1.75rem] font-semibold leading-none text-[var(--foreground)]">
								{match.home.name}
							</p>
							<p className="theme-muted mt-1 text-sm">{match.home.side}</p>
						</div>
					</div>
					<p className="text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
						{match.home.score}
					</p>
				</div>

				<div className="theme-muted flex items-center gap-4 text-xs uppercase tracking-[0.3em]">
					<div className="h-px flex-1 bg-[var(--line)]" />
					<span>VS</span>
					<div className="h-px flex-1 bg-[var(--line)]" />
				</div>

				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white ${match.away.color}`}>
							{match.away.code}
						</div>
						<div>
							<p className="text-[1.75rem] font-semibold leading-none text-[var(--foreground)]">
								{match.away.name}
							</p>
							<p className="theme-muted mt-1 text-sm">{match.away.side}</p>
						</div>
					</div>
					<p className="text-5xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
						{match.away.score}
					</p>
				</div>
			</div>

			<div className="theme-muted mt-6 flex items-center justify-between text-sm">
				<span className="flex items-center gap-2">
					<VenueIcon />
					<span>{match.venue}</span>
				</span>
				<span className="flex items-center gap-2">
					<DiscussionIcon />
					<span>Discussion</span>
				</span>
			</div>
		</article>
	);
}
