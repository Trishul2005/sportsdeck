type SectionPageProps = {
	title: string;
	description: string;
};

export default function SectionPage({
	title,
	description,
}: SectionPageProps) {
	return (
		<section className="theme-card rounded-[2rem] p-8 sm:p-10">
			<p className="font-[family:var(--font-heading)] text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
				SportsDeck
			</p>
			<h1 className="mt-4 font-[family:var(--font-heading)] text-4xl font-semibold uppercase tracking-[-0.02em] sm:text-5xl">
				{title}
			</h1>
			<p className="theme-muted mt-5 max-w-2xl text-lg leading-8">
				{description}
			</p>

			<div className="mt-10 rounded-[1.75rem] border border-dashed border-[color:var(--line)] bg-[var(--card-inset)] p-8">
				<p className="theme-muted text-base">
					This is a starter page for the {title.toLowerCase()} section. We can
					build the real content here next.
				</p>
			</div>
		</section>
	);
}
