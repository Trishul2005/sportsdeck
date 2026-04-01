import type { Thread } from '@/lib/mock-data';

type ThreadCardProps = {
	thread: Thread;
	variant?: 'default' | 'compact';
};

export function ThreadCard({ thread, variant = 'default' }: ThreadCardProps) {
	return (
		<div
			className={`theme-panel flex flex-col gap-4 rounded-[1.35rem] p-5 md:flex-row md:items-center md:justify-between ${
				variant === 'compact' ? '' : ''
			}`}
		>
			<div className="flex items-start gap-4">
				<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--card-inset)] text-sm font-bold text-[var(--accent)]">
					{thread.code}
				</div>
				<div>
					<p className={`text-lg font-semibold ${thread.isClosed ? 'text-[color:var(--muted)]' : 'text-[var(--foreground)]'}`}>{thread.title}</p>
					{thread.isClosed && (
						<span className="theme-warning-panel mt-1 inline-flex rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
							Closed
						</span>
					)}
					<p className="theme-muted mt-1 text-sm">
						{thread.author}
						<span className="mx-2"> </span>
						{thread.date}
					</p>
				</div>
			</div>
			<div className="theme-muted text-sm font-semibold">{thread.count}</div>
		</div>
	);
}
