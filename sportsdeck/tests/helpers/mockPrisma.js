const MODEL_META = {
	user: {
		plural: 'users',
		fields: {
			favoriteTeam: { model: 'team', type: 'one', foreignKey: 'favoriteTeamId', targetKey: 'id' },
			posts: { model: 'post', type: 'many', foreignKey: 'authorId', sourceKey: 'id' },
			threads: { model: 'thread', type: 'many', foreignKey: 'createdById', sourceKey: 'id' },
			polls: { model: 'poll', type: 'many', foreignKey: 'createdById', sourceKey: 'id' },
			reports: { model: 'report', type: 'many', foreignKey: 'reportedById', sourceKey: 'id' },
			followers: { model: 'follow', type: 'many', foreignKey: 'followingId', sourceKey: 'id' },
			following: { model: 'follow', type: 'many', foreignKey: 'followerId', sourceKey: 'id' },
			appeals: { model: 'appeal', type: 'many', foreignKey: 'userId', sourceKey: 'id' },
			refreshTokens: { model: 'refreshToken', type: 'many', foreignKey: 'userId', sourceKey: 'id' },
		},
	},
	team: {
		plural: 'teams',
		fields: {
			matchesHome: { model: 'match', type: 'many', foreignKey: 'homeTeamId', sourceKey: 'id' },
			matchesAway: { model: 'match', type: 'many', foreignKey: 'awayTeamId', sourceKey: 'id' },
			threads: { model: 'thread', type: 'many', foreignKey: 'teamId', sourceKey: 'id' },
			fans: { model: 'user', type: 'many', foreignKey: 'favoriteTeamId', sourceKey: 'id' },
		},
	},
	match: {
		plural: 'matches',
		fields: {
			homeTeam: { model: 'team', type: 'one', foreignKey: 'homeTeamId', targetKey: 'id' },
			awayTeam: { model: 'team', type: 'one', foreignKey: 'awayTeamId', targetKey: 'id' },
			threads: { model: 'thread', type: 'many', foreignKey: 'matchId', sourceKey: 'id' },
			sentiment: { model: 'sentiment', type: 'oneInverse', foreignKey: 'matchId', sourceKey: 'id' },
		},
	},
	thread: {
		plural: 'threads',
		fields: {
			mainPost: { model: 'post', type: 'one', foreignKey: 'mainPostId', targetKey: 'id' },
			createdBy: { model: 'user', type: 'one', foreignKey: 'createdById', targetKey: 'id' },
			team: { model: 'team', type: 'one', foreignKey: 'teamId', targetKey: 'id' },
			match: { model: 'match', type: 'one', foreignKey: 'matchId', targetKey: 'id' },
			posts: { model: 'post', type: 'many', foreignKey: 'threadId', sourceKey: 'id' },
			polls: { model: 'poll', type: 'many', foreignKey: 'threadId', sourceKey: 'id' },
			tags: { model: 'tagThread', type: 'many', foreignKey: 'threadId', sourceKey: 'id' },
			reports: { model: 'report', type: 'many', foreignKey: 'threadId', sourceKey: 'id' },
		},
	},
	post: {
		plural: 'posts',
		fields: {
			thread: { model: 'thread', type: 'one', foreignKey: 'threadId', targetKey: 'id' },
			author: { model: 'user', type: 'one', foreignKey: 'authorId', targetKey: 'id' },
			replies: { model: 'post', type: 'many', foreignKey: 'parentId', sourceKey: 'id' },
			parent: { model: 'post', type: 'one', foreignKey: 'parentId', targetKey: 'id' },
			reports: { model: 'report', type: 'many', foreignKey: 'postId', sourceKey: 'id' },
			poll: { model: 'poll', type: 'oneInverse', foreignKey: 'postId', sourceKey: 'id' },
		},
	},
	poll: {
		plural: 'polls',
		fields: {
			thread: { model: 'thread', type: 'one', foreignKey: 'threadId', targetKey: 'id' },
			post: { model: 'post', type: 'one', foreignKey: 'postId', targetKey: 'id' },
			createdBy: { model: 'user', type: 'one', foreignKey: 'createdById', targetKey: 'id' },
			options: { model: 'pollOption', type: 'many', foreignKey: 'pollId', sourceKey: 'id' },
			votes: { model: 'pollVote', type: 'many', foreignKey: 'pollId', sourceKey: 'id' },
			reports: { model: 'report', type: 'many', foreignKey: 'pollId', sourceKey: 'id' },
		},
	},
	pollOption: {
		plural: 'pollOptions',
		fields: {
			poll: { model: 'poll', type: 'one', foreignKey: 'pollId', targetKey: 'id' },
			votes: { model: 'pollVote', type: 'many', foreignKey: 'optionId', sourceKey: 'id' },
		},
	},
	pollVote: {
		plural: 'pollVotes',
		fields: {
			poll: { model: 'poll', type: 'one', foreignKey: 'pollId', targetKey: 'id' },
			option: { model: 'pollOption', type: 'one', foreignKey: 'optionId', targetKey: 'id' },
			user: { model: 'user', type: 'one', foreignKey: 'userId', targetKey: 'id' },
		},
	},
	tag: {
		plural: 'tags',
		fields: {
			threads: { model: 'tagThread', type: 'many', foreignKey: 'tagId', sourceKey: 'id' },
		},
	},
	tagThread: {
		plural: 'tagThreads',
		fields: {
			tag: { model: 'tag', type: 'one', foreignKey: 'tagId', targetKey: 'id' },
			thread: { model: 'thread', type: 'one', foreignKey: 'threadId', targetKey: 'id' },
		},
	},
	report: {
		plural: 'reports',
		fields: {
			reportedBy: { model: 'user', type: 'one', foreignKey: 'reportedById', targetKey: 'id' },
			post: { model: 'post', type: 'one', foreignKey: 'postId', targetKey: 'id' },
			thread: { model: 'thread', type: 'one', foreignKey: 'threadId', targetKey: 'id' },
			poll: { model: 'poll', type: 'one', foreignKey: 'pollId', targetKey: 'id' },
		},
	},
	follow: {
		plural: 'follows',
		fields: {
			follower: { model: 'user', type: 'one', foreignKey: 'followerId', targetKey: 'id' },
			following: { model: 'user', type: 'one', foreignKey: 'followingId', targetKey: 'id' },
		},
	},
	appeal: {
		plural: 'appeals',
		fields: {
			user: { model: 'user', type: 'one', foreignKey: 'userId', targetKey: 'id' },
		},
	},
	sentiment: {
		plural: 'sentiments',
		fields: {
			match: { model: 'match', type: 'one', foreignKey: 'matchId', targetKey: 'id' },
		},
	},
	refreshToken: {
		plural: 'refreshTokens',
		fields: {
			user: { model: 'user', type: 'one', foreignKey: 'userId', targetKey: 'id' },
		},
	},
};

const DEFAULTS = {
	user: () => ({
		password: null,
		avatar: null,
		favoriteTeamId: null,
		role: 'USER',
		isBanned: false,
		themeMode: 'LIGHT',
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
	team: () => ({
		logoUrl: null,
		wins: 0,
		losses: 0,
		conference: 'Unknown',
		division: 'Unknown',
		createdAt: new Date(),
	}),
	match: () => ({
		venue: null,
		homeScore: null,
		awayScore: null,
		status: 'scheduled',
		endedAt: null,
		createdAt: new Date(),
	}),
	thread: () => ({
		teamId: null,
		matchId: null,
		isClosed: false,
		isVisible: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		opensAt: null,
		closesAt: null,
	}),
	post: () => ({
		threadId: null,
		parentId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		version: 1,
		isVisible: true,
	}),
	poll: () => ({
		threadId: null,
		postId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		version: 1,
		isVisible: true,
	}),
	pollOption: () => ({}),
	pollVote: () => ({}),
	tag: () => ({ createdAt: new Date() }),
	tagThread: () => ({}),
	report: () => ({
		postId: null,
		threadId: null,
		pollId: null,
		aiVerdict: null,
		toxicity: null,
		isResolved: false,
		resolvedAt: null,
		createdAt: new Date(),
	}),
	follow: () => ({ createdAt: new Date() }),
	appeal: () => ({
		status: 'PENDING',
		createdAt: new Date(),
		reviewedAt: null,
	}),
	sentiment: () => ({
		overall: null,
		homeTeam: null,
		awayTeam: null,
		createdAt: new Date(),
		numPosts: 0,
		updatedAt: new Date(),
	}),
	refreshToken: () => ({
		revokedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
};

let db;
let counters;
let prisma;

function clone(value) {
	if (value === null || value === undefined) return value;
	if (value instanceof Date) return new Date(value);
	if (Array.isArray(value)) return value.map(clone);
	if (typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
	}
	return value;
}

function resetState() {
	db = {
		users: [],
		teams: [],
		matches: [],
		threads: [],
		posts: [],
		polls: [],
		pollOptions: [],
		pollVotes: [],
		tags: [],
		tagThreads: [],
		reports: [],
		follows: [],
		appeals: [],
		sentiments: [],
		refreshTokens: [],
	};
	counters = Object.fromEntries(Object.keys(MODEL_META).map((model) => [model, 1]));
}

function getCollection(model) {
	return db[MODEL_META[model].plural];
}

function nextId(model) {
	const id = counters[model];
	counters[model] += 1;
	return id;
}

function toComparable(value) {
	if (value instanceof Date) return value.getTime();
	return value;
}

function resolveRelation(model, record, field) {
	const rel = MODEL_META[model].fields[field];
	if (!rel) return undefined;
	const records = getCollection(rel.model);
	if (rel.type === 'one') {
		const fk = record[rel.foreignKey];
		return records.find((entry) => entry[rel.targetKey || 'id'] === fk) || null;
	}
	if (rel.type === 'oneInverse') {
		return records.find((entry) => entry[rel.foreignKey] === record[rel.sourceKey || 'id']) || null;
	}
	return records.filter((entry) => entry[rel.foreignKey] === record[rel.sourceKey || 'id']);
}

function matchesField(actual, expected) {
	if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
		if (Object.prototype.hasOwnProperty.call(expected, 'equals')) {
			return matchesField(actual, expected.equals);
		}
		if (Object.prototype.hasOwnProperty.call(expected, 'in')) {
			return expected.in.some((value) => matchesField(actual, value));
		}
		if (Object.prototype.hasOwnProperty.call(expected, 'notIn')) {
			return !expected.notIn.some((value) => matchesField(actual, value));
		}
		if (Object.prototype.hasOwnProperty.call(expected, 'contains')) {
			return String(actual || '').includes(String(expected.contains));
		}
		if (Object.prototype.hasOwnProperty.call(expected, 'startsWith')) {
			return String(actual || '').startsWith(String(expected.startsWith));
		}
		if (Object.prototype.hasOwnProperty.call(expected, 'not')) {
			return !matchesField(actual, expected.not);
		}
		const actualComp = toComparable(actual);
		if (Object.prototype.hasOwnProperty.call(expected, 'gte') && !(actualComp >= toComparable(expected.gte))) return false;
		if (Object.prototype.hasOwnProperty.call(expected, 'gt') && !(actualComp > toComparable(expected.gt))) return false;
		if (Object.prototype.hasOwnProperty.call(expected, 'lte') && !(actualComp <= toComparable(expected.lte))) return false;
		if (Object.prototype.hasOwnProperty.call(expected, 'lt') && !(actualComp < toComparable(expected.lt))) return false;
		return true;
	}
	return toComparable(actual) === toComparable(expected);
}

function matchesWhere(model, record, where) {
	if (!where) return true;
	if (Array.isArray(where)) return where.every((item) => matchesWhere(model, record, item));
	if (where.OR) {
		return where.OR.some((item) => matchesWhere(model, record, item));
	}
	if (where.AND) {
		return where.AND.every((item) => matchesWhere(model, record, item));
	}
	if (where.NOT) {
		return !matchesWhere(model, record, where.NOT);
	}

	return Object.entries(where).every(([key, value]) => {
		if (['OR', 'AND', 'NOT'].includes(key)) return true;
		const rel = MODEL_META[model].fields[key];
		if (rel) {
			const related = resolveRelation(model, record, key);
			if (value?.some) {
				return Array.isArray(related) && related.some((item) => matchesWhere(rel.model, item, value.some));
			}
			if (value?.none) {
				return Array.isArray(related) && related.every((item) => !matchesWhere(rel.model, item, value.none));
			}
			if (value?.every) {
				return Array.isArray(related) && related.every((item) => matchesWhere(rel.model, item, value.every));
			}
			if (Array.isArray(related)) {
				return related.some((item) => matchesWhere(rel.model, item, value));
			}
			return related ? matchesWhere(rel.model, related, value) : false;
		}
		return matchesField(record[key], value);
	});
}

function sortRecords(records, orderBy) {
	if (!orderBy) return records;
	const sorters = Array.isArray(orderBy) ? orderBy : [orderBy];
	return [...records].sort((a, b) => {
		for (const sorter of sorters) {
			const [field, dir] = Object.entries(sorter)[0];
			const av = toComparable(a[field]);
			const bv = toComparable(b[field]);
			if (av === bv) continue;
			const cmp = av > bv ? 1 : -1;
			return dir === 'desc' ? -cmp : cmp;
		}
		return 0;
	});
}

function countRelated(model, record, key) {
	const related = resolveRelation(model, record, key);
	return Array.isArray(related) ? related.length : related ? 1 : 0;
}

function projectRecord(model, record, args = {}) {
	if (!record) return record;
	const source = clone(record);
	const { select, include } = args;
	if (!select && !include) return source;

	const out = {};
	if (select) {
		for (const [key, cfg] of Object.entries(select)) {
			if (!cfg) continue;
			if (key === '_count') {
				out._count = Object.fromEntries(
					Object.entries(cfg.select || {}).map(([relKey]) => [relKey, countRelated(model, source, relKey)]),
				);
				continue;
			}
			const rel = MODEL_META[model].fields[key];
			if (!rel) {
				out[key] = clone(source[key]);
				continue;
			}
			const related = resolveRelation(model, source, key);
			if (Array.isArray(related)) {
				let rows = related;
				if (cfg.where) rows = rows.filter((entry) => matchesWhere(rel.model, entry, cfg.where));
				rows = sortRecords(rows, cfg.orderBy);
				if (cfg.take) rows = rows.slice(0, cfg.take);
				out[key] = rows.map((entry) => projectRecord(rel.model, entry, cfg));
			} else {
				out[key] = related ? projectRecord(rel.model, related, cfg) : null;
			}
		}
		return out;
	}

	Object.assign(out, source);
	for (const [key, cfg] of Object.entries(include || {})) {
		if (!cfg) continue;
		if (key === '_count') {
			out._count = Object.fromEntries(
				Object.entries(cfg.select || {}).map(([relKey]) => [relKey, countRelated(model, source, relKey)]),
			);
			continue;
		}
		const rel = MODEL_META[model].fields[key];
		if (!rel) continue;
		const related = resolveRelation(model, source, key);
		if (Array.isArray(related)) {
			let rows = related;
			if (cfg.where) rows = rows.filter((entry) => matchesWhere(rel.model, entry, cfg.where));
			rows = sortRecords(rows, cfg.orderBy);
			if (cfg.take) rows = rows.slice(0, cfg.take);
			out[key] = rows.map((entry) => projectRecord(rel.model, entry, cfg));
		} else {
			out[key] = related ? projectRecord(rel.model, related, cfg) : null;
		}
	}
	return out;
}

function normalizeCreate(model, data) {
	const cleanedData = Object.fromEntries(
		Object.entries(clone(data || {})).filter(([, value]) => value !== undefined),
	);
	const record = {
		id: nextId(model),
		...DEFAULTS[model](),
		...cleanedData,
	};
	return record;
}

function uniqueMatch(model, record, where) {
	return Object.entries(where).every(([key, value]) => {
		if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
			return Object.entries(value).every(([subKey, subValue]) => matchesField(record[subKey], subValue));
		}
		return matchesField(record[key], value);
	});
}

function applyNestedCreate(model, record, data) {
	if (model === 'thread' && data.tags?.create) {
		for (const entry of data.tags.create) {
			let tag = null;
			if (entry?.tag?.connect?.id) {
				tag = db.tags.find((item) => item.id === entry.tag.connect.id) || null;
			}
			const tagName =
				entry?.tag?.connectOrCreate?.where?.name ||
				entry?.tag?.connectOrCreate?.create?.name;
			if (!tag && tagName) {
				tag = db.tags.find((item) => item.name === tagName) || null;
			}
			if (!tag && tagName) {
				tag = normalizeCreate('tag', { name: tagName });
				db.tags.push(tag);
			}
			if (!tag) continue;
			const existing = db.tagThreads.find((item) => item.tagId === tag.id && item.threadId === record.id);
			if (!existing) {
				db.tagThreads.push(normalizeCreate('tagThread', { tagId: tag.id, threadId: record.id }));
			}
		}
	}

	if (model === 'poll' && data.options?.create) {
		for (const option of data.options.create) {
			db.pollOptions.push(normalizeCreate('pollOption', { pollId: record.id, ...option }));
		}
	}
}

function createImpl(model, args = {}) {
	const { data, select, include } = args;
	const scalarData = { ...data };
	delete scalarData.tags;
	delete scalarData.options;
	const record = normalizeCreate(model, scalarData);
	getCollection(model).push(record);
	applyNestedCreate(model, record, data || {});
	return projectRecord(model, record, { select, include });
}

function findManyImpl(model, args = {}) {
	let rows = getCollection(model).filter((record) => matchesWhere(model, record, args.where));
	rows = sortRecords(rows, args.orderBy);
	if (args.skip) rows = rows.slice(args.skip);
	if (args.take !== undefined) rows = rows.slice(0, args.take);
	return rows.map((record) => projectRecord(model, record, args));
}

function findFirstImpl(model, args = {}) {
	return findManyImpl(model, { ...args, take: 1 })[0] || null;
}

function findUniqueImpl(model, args = {}) {
	const row = getCollection(model).find((record) => uniqueMatch(model, record, args.where || {}));
	return row ? projectRecord(model, row, args) : null;
}

function updateImpl(model, args = {}) {
	const records = getCollection(model);
	const index = records.findIndex((record) => uniqueMatch(model, record, args.where || {}));
	if (index < 0) {
		const error = new Error('Record not found');
		error.code = 'P2025';
		throw error;
	}
	const current = records[index];
	const clonedData = clone(args.data || {});
	const resolvedData = {};
	for (const [key, value] of Object.entries(clonedData)) {
		if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'increment')) {
			resolvedData[key] = (current[key] || 0) + value.increment;
		} else {
			resolvedData[key] = value;
		}
	}
	const next = {
		...current,
		...resolvedData,
		updatedAt:
			Object.prototype.hasOwnProperty.call(resolvedData, 'updatedAt')
				? resolvedData.updatedAt
				: current.updatedAt !== undefined
					? new Date()
					: current.updatedAt,
	};
	delete next.tags;
	delete next.options;
	records[index] = next;
	applyNestedCreate(model, next, args.data || {});
	return projectRecord(model, next, args);
}

function updateManyImpl(model, args = {}) {
	let count = 0;
	const records = getCollection(model);
	for (let i = 0; i < records.length; i += 1) {
		if (!matchesWhere(model, records[i], args.where)) continue;
		const resolvedData = {};
		for (const [key, value] of Object.entries(clone(args.data || {}))) {
			if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'increment')) {
				resolvedData[key] = (records[i][key] || 0) + value.increment;
			} else {
				resolvedData[key] = value;
			}
		}
		records[i] = {
			...records[i],
			...resolvedData,
			updatedAt:
				Object.prototype.hasOwnProperty.call(resolvedData, 'updatedAt')
					? resolvedData.updatedAt
					: records[i].updatedAt !== undefined
						? new Date()
						: records[i].updatedAt,
		};
		count += 1;
	}
	return { count };
}

function deleteImpl(model, args = {}) {
	const records = getCollection(model);
	const index = records.findIndex((record) => uniqueMatch(model, record, args.where || {}));
	if (index < 0) {
		const error = new Error('Record not found');
		error.code = 'P2025';
		throw error;
	}
	const [deleted] = records.splice(index, 1);
	return clone(deleted);
}

function deleteManyImpl(model, args = {}) {
	const records = getCollection(model);
	const kept = records.filter((record) => !matchesWhere(model, record, args.where));
	const count = records.length - kept.length;
	db[MODEL_META[model].plural] = kept;
	return { count };
}

function countImpl(model, args = {}) {
	return getCollection(model).filter((record) => matchesWhere(model, record, args.where)).length;
}

function upsertImpl(model, args = {}) {
	const existing = getCollection(model).find((record) => uniqueMatch(model, record, args.where || {}));
	if (existing) {
		return updateImpl(model, { ...args, where: args.where, data: args.update, select: args.select, include: args.include });
	}
	return createImpl(model, { data: args.create, select: args.select, include: args.include });
}

function makeModelApi(model) {
	return {
		findMany: jest.fn(async (args) => findManyImpl(model, args)),
		findFirst: jest.fn(async (args) => findFirstImpl(model, args)),
		findUnique: jest.fn(async (args) => findUniqueImpl(model, args)),
		create: jest.fn(async (args) => createImpl(model, args)),
		update: jest.fn(async (args) => updateImpl(model, args)),
		updateMany: jest.fn(async (args) => updateManyImpl(model, args)),
		delete: jest.fn(async (args) => deleteImpl(model, args)),
		deleteMany: jest.fn(async (args) => deleteManyImpl(model, args)),
		count: jest.fn(async (args) => countImpl(model, args)),
		upsert: jest.fn(async (args) => upsertImpl(model, args)),
	};
}

function buildPrisma() {
	const api = {
		$transaction: jest.fn(async (callback) => callback(api)),
		$disconnect: jest.fn(async () => undefined),
	};
	for (const model of Object.keys(MODEL_META)) {
		api[model] = makeModelApi(model);
	}
	return api;
}

function resetMockDb() {
	resetState();
	if (!prisma) {
		prisma = buildPrisma();
		return;
	}
	for (const model of Object.keys(MODEL_META)) {
		for (const method of Object.keys(prisma[model])) {
			prisma[model][method].mockReset();
			const impl = makeModelApi(model)[method].getMockImplementation();
			prisma[model][method].mockImplementation(impl);
		}
	}
	prisma.$transaction.mockReset();
	prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
	prisma.$disconnect.mockReset();
	prisma.$disconnect.mockImplementation(async () => undefined);
}

resetState();
prisma = buildPrisma();

module.exports = {
	prisma,
	resetMockDb,
	__mockDb: {
		getState: () => db,
	},
};
