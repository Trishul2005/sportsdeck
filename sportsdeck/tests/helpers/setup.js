const { PrismaClient } = require('@prisma/client');

function isPostgresUrl(value) {
	return typeof value === 'string' && /^postgres(ql)?:\/\//i.test(value);
}

module.exports = async function globalSetup() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!isPostgresUrl(databaseUrl)) {
		console.log('\n⏭️ Skipping test database cleanup because DATABASE_URL is not a PostgreSQL connection string.\n');
		return;
	}

	console.log('\n🧹 Cleaning test database...');

	// Create Prisma client with explicit datasource (respects DATABASE_URL env var)
	const prisma = new PrismaClient({
		datasources: {
			db: {
				url: databaseUrl,
			},
		},
	});

	try {
		// Delete all data in reverse order of dependencies
		await prisma.sentiment.deleteMany({});
		await prisma.pollVote.deleteMany({});
		await prisma.pollOption.deleteMany({});
		await prisma.poll.deleteMany({});
		await prisma.report.deleteMany({});
		await prisma.appeal.deleteMany({});
		await prisma.post.deleteMany({});
		await prisma.tagThread.deleteMany({});
		await prisma.thread.deleteMany({});
		await prisma.tag.deleteMany({});
		await prisma.match.deleteMany({});
		await prisma.follow.deleteMany({});
		await prisma.user.deleteMany({});
		await prisma.team.deleteMany({});

		await prisma.$disconnect();

		console.log('✅ Test database cleaned\n');
	} catch (error) {
		console.warn('⚠️ Skipping test database cleanup because Prisma could not connect to the configured database.');
		console.warn(error);
		await prisma.$disconnect().catch(() => {});
	}
};
