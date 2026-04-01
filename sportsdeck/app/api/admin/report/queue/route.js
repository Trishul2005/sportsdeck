import { prisma } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { getAuthUserFromCookie } from '@/lib/auth';
import { withRedisRouteCache } from '@/app/utils/routeCache';

const EDIT_HISTORY_VERDICT = '__edit_history__';
const POLL_EDIT_HISTORY_VERDICT = '__poll_edit_history__';
const SEVERITY_ORDER = {
	SAFE: 1,
	WARNING: 2,
	VIOLATION: 3,
};

function verdictFromToxicity(toxicity) {
	if (toxicity >= 0.8) return 'VIOLATION';
	if (toxicity >= 0.5) return 'WARNING';
	return 'SAFE';
}

function normalizeVerdict(verdict, toxicity = 0) {
	const normalized = typeof verdict === 'string' ? verdict.trim().toUpperCase() : '';
	if (normalized === 'SAFE' || normalized === 'WARNING' || normalized === 'VIOLATION') {
		return normalized;
	}
	return verdictFromToxicity(toxicity);
}

function getSeverityScore(verdict, toxicity = 0) {
	return SEVERITY_ORDER[normalizeVerdict(verdict, toxicity)] ?? SEVERITY_ORDER.SAFE;
}

function parseAutoModerationReason(reason) {
	if (typeof reason !== 'string') {
		return {
			attemptedContent: null,
			offenderUserId: null,
			detectedScore: null,
		};
	}

	const attemptedMatch = reason.match(/Attempted content:\s*(.*?)\.\s*made by user\s+\d+/i);
	const userMatch = reason.match(/made by user\s+(\d+)/i);
	const scoreMatch = reason.match(/score\s+([0-9.]+)/i);

	return {
		attemptedContent: attemptedMatch?.[1]?.trim() || null,
		offenderUserId: userMatch ? Number.parseInt(userMatch[1], 10) : null,
		detectedScore: scoreMatch ? Number.parseFloat(scoreMatch[1]) : null,
	};
}

function buildContentLink(contentType, threadId) {
	if (!threadId) {
		return null;
	}
	return contentType === 'THREAD' ? `/forums/${threadId}` : `/forums/${threadId}`;
}

export async function GET(req) {
	const auth = await getAuthUserFromCookie(req);
	const viewerKey = auth.error ? 'anon' : `user:${auth.payload.userId}`;

	return withRedisRouteCache(
		req,
		async () => {
			try {
				if (auth.error) {
					return NextResponse.json({ error: auth.error }, { status: auth.status });
				}

				const payload = auth.payload;
				const userRecord = await prisma.user.findUnique({
					where: { id: payload.userId },
				});

				if (!userRecord || userRecord.role !== 'ADMIN') {
					return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
				}

				const reports = await prisma.report.findMany({
					where: {
						isResolved: false,
						aiVerdict: {
							notIn: [EDIT_HISTORY_VERDICT, POLL_EDIT_HISTORY_VERDICT],
						},
					},
					include: {
						post: {
							select: {
								id: true,
								content: true,
								isVisible: true,
								author: {
									select: {
										id: true,
										username: true,
										avatar: true,
										isBanned: true,
									},
								},
								thread: {
									select: {
										id: true,
										title: true,
										isClosed: true,
										isVisible: true,
									},
								},
							},
						},
						thread: {
							select: {
								id: true,
								title: true,
								isClosed: true,
								isVisible: true,
								createdBy: {
									select: {
										id: true,
										username: true,
										avatar: true,
										isBanned: true,
									},
								},
							},
						},
						poll: {
							select: {
								id: true,
								question: true,
								version: true,
								isVisible: true,
								threadId: true,
								createdBy: {
									select: {
										id: true,
										username: true,
										avatar: true,
										isBanned: true,
									},
								},
								thread: {
									select: {
										id: true,
										title: true,
										isClosed: true,
										isVisible: true,
									},
								},
								options: {
									select: {
										text: true,
									},
									orderBy: {
										id: 'asc',
									},
								},
							},
						},
					},
					orderBy: {
						createdAt: 'desc',
					},
				});

				const postIds = Array.from(
					new Set(reports.map((report) => report.postId).filter(Boolean)),
				);
				const pollIds = Array.from(
					new Set(reports.map((report) => report.pollId).filter(Boolean)),
				);

				const historyRows = postIds.length
					? await prisma.report.findMany({
							where: {
								postId: { in: postIds },
								aiVerdict: EDIT_HISTORY_VERDICT,
							},
							select: {
								postId: true,
								reason: true,
								createdAt: true,
							},
							orderBy: {
								createdAt: 'asc',
							},
						})
					: [];
				const pollHistoryRows = pollIds.length
					? await prisma.report.findMany({
							where: {
								pollId: { in: pollIds },
								aiVerdict: POLL_EDIT_HISTORY_VERDICT,
							},
							select: {
								pollId: true,
								reason: true,
								createdAt: true,
							},
							orderBy: {
								createdAt: 'asc',
							},
						})
					: [];

				const historyByPostId = new Map();
				for (const row of historyRows) {
					if (!row.postId) continue;
					try {
						const parsed = JSON.parse(row.reason);
						if (
							typeof parsed?.version === 'number' &&
							typeof parsed?.content === 'string'
						) {
							if (!historyByPostId.has(row.postId)) {
								historyByPostId.set(row.postId, []);
							}
							historyByPostId.get(row.postId).push({
								version: parsed.version,
								content: parsed.content,
							});
						}
					} catch {
						continue;
					}
				}
				const historyByPollId = new Map();
				for (const row of pollHistoryRows) {
					if (!row.pollId) continue;
					try {
						const parsed = JSON.parse(row.reason);
						if (
							typeof parsed?.version === 'number' &&
							typeof parsed?.question === 'string'
						) {
							if (!historyByPollId.has(row.pollId)) {
								historyByPollId.set(row.pollId, []);
							}
							historyByPollId.get(row.pollId).push({
								version: parsed.version,
								question: parsed.question,
								options: Array.isArray(parsed.options) ? parsed.options : [],
							});
						}
					} catch {
						continue;
					}
				}

				const parsedReasons = reports.map((report) => ({
					reportId: report.id,
					...parseAutoModerationReason(report.reason),
				}));
				const offenderUserIds = Array.from(
					new Set(
						parsedReasons
							.map((entry) => entry.offenderUserId)
							.filter((value) => Number.isInteger(value)),
					),
				);
				const offenderUsers = offenderUserIds.length
					? await prisma.user.findMany({
							where: { id: { in: offenderUserIds } },
							select: {
								id: true,
								username: true,
								avatar: true,
								isBanned: true,
							},
						})
					: [];
				const offenderUserById = new Map(offenderUsers.map((user) => [user.id, user]));
				const parsedReasonByReportId = new Map(
					parsedReasons.map((entry) => [entry.reportId, entry]),
				);

				const grouped = new Map();

				for (const report of reports) {
					const isPost = Boolean(report.postId);
					const isPoll = Boolean(report.pollId);
					const contentType = isPost ? 'POST' : isPoll ? 'POLL' : 'THREAD';
					const contentId = report.postId || report.pollId || report.threadId;
					const parsedReason = parsedReasonByReportId.get(report.id);
					const threadId =
						report.post?.thread?.id ||
						report.poll?.thread?.id ||
						report.poll?.threadId ||
						report.threadId ||
						null;
					const threadTitle =
						report.post?.thread?.title ||
						report.poll?.thread?.title ||
						report.thread?.title ||
						null;
					const offender =
						(parsedReason?.offenderUserId
							? offenderUserById.get(parsedReason.offenderUserId)
							: null) ||
						(isPost
							? report.post?.author
							: isPoll
								? report.poll?.createdBy
								: report.thread?.createdBy);
					const pollOptionsPreview = isPoll
						? (report.poll?.options || []).map((option) => option.text).join(' | ')
						: '';
					const contentPreview = isPost
						? parsedReason?.attemptedContent || report.post?.content?.slice(0, 180) || ''
						: isPoll
							? parsedReason?.attemptedContent || report.poll?.question || ''
							: parsedReason?.attemptedContent || report.thread?.title || '';
					const contentForAi = isPost
						? parsedReason?.attemptedContent || report.post?.content || ''
						: isPoll
							? [
									parsedReason?.attemptedContent || report.poll?.question || '',
									pollOptionsPreview ? `Options: ${pollOptionsPreview}` : '',
								]
									.filter(Boolean)
									.join('\n')
							: parsedReason?.attemptedContent || report.thread?.title || '';

					const key = `${contentType}-${contentId}`;
					if (!grouped.has(key)) {
						grouped.set(key, {
							contentType,
							contentId,
							reportId: report.id,
							threadId,
							threadTitle,
							contentLink: buildContentLink(contentType, threadId),
							reportCount: 0,
							worstAiVerdict: normalizeVerdict(report.aiVerdict, report.toxicity || 0),
							highestToxicity: report.toxicity || 0,
							contentPreview,
							pollOptions: isPoll
								? (report.poll?.options || []).map((option) => option.text).filter(Boolean)
								: [],
							contentForAi,
							reasons: [],
							storedModerationExplanation: '',
							offender: offender
								? {
										id: offender.id,
										username: offender.username,
										avatar: offender.avatar ?? null,
										isBanned: offender.isBanned,
									}
								: null,
							isHidden: isPost
								? report.post?.isVisible === false
								: isPoll
									? report.poll?.isVisible === false
									: report.thread?.isVisible === false,
							isClosed: isPost
								? Boolean(report.post?.thread?.isClosed)
								: Boolean(report.poll?.thread?.isClosed || report.thread?.isClosed),
							lastReportedAt: report.createdAt.toISOString(),
						});
					}

					const group = grouped.get(key);
					group.reportCount += 1;
					if (report.createdAt.toISOString() > group.lastReportedAt) {
						group.lastReportedAt = report.createdAt.toISOString();
					}

					if (typeof report.reason === 'string' && report.reason.trim()) {
						group.reasons.push(report.reason.trim());
					}

					const currentSeverity = getSeverityScore(
						group.worstAiVerdict,
						group.highestToxicity,
					);
					const reportSeverity = getSeverityScore(
						report.aiVerdict,
						report.toxicity || 0,
					);
					if (reportSeverity > currentSeverity) {
						group.worstAiVerdict = normalizeVerdict(
							report.aiVerdict,
							report.toxicity || 0,
						);
					}

					group.highestToxicity = Math.max(
						group.highestToxicity,
						report.toxicity || 0,
					);
					if (!group.storedModerationExplanation && report.toxicity != null) {
						const score = parsedReason?.detectedScore ?? report.toxicity;
						group.storedModerationExplanation = `Moderation verdict ${normalizeVerdict(
							report.aiVerdict,
							report.toxicity || 0,
						)} with toxicity score ${score.toFixed(2)}.`;
					}

					if (!group.offender && offender) {
						group.offender = {
							id: offender.id,
							username: offender.username,
							avatar: offender.avatar ?? null,
							isBanned: offender.isBanned,
						};
					}

					group.isHidden =
						group.isHidden ||
						(isPost
							? report.post?.isVisible === false
							: isPoll
								? report.poll?.isVisible === false
								: report.thread?.isVisible === false);
					group.isClosed =
						group.isClosed ||
						(isPost
							? Boolean(report.post?.thread?.isClosed)
							: Boolean(report.poll?.thread?.isClosed || report.thread?.isClosed));

					if (isPost && report.postId && report.post) {
						const versions = historyByPostId.get(report.postId) || [];
						const uniqueVersions = new Map();
						for (const item of versions) {
							if (!uniqueVersions.has(item.version)) {
								uniqueVersions.set(item.version, item.content);
							}
						}
						const ordered = Array.from(uniqueVersions.entries()).sort(
							(a, b) => a[0] - b[0],
						);
						const historySummary = ordered.length
							? ordered
									.map(([version, content]) => `V${version}: ${content}`)
									.join('\n')
							: '';

						group.contentForAi =
							`Current content:\n${parsedReason?.attemptedContent || report.post.content}` +
							(historySummary ? `\n\nVersion history:\n${historySummary}` : '');
						group.contentPreview = (
							parsedReason?.attemptedContent || report.post.content
						).slice(0, 180);
					}

					if (isPoll && report.pollId && report.poll) {
						const versions = historyByPollId.get(report.pollId) || [];
						const uniqueVersions = new Map();
						for (const item of versions) {
							if (!uniqueVersions.has(item.version)) {
								uniqueVersions.set(item.version, {
									question: item.question,
									options: item.options,
								});
							}
						}
						const ordered = Array.from(uniqueVersions.entries()).sort(
							(a, b) => a[0] - b[0],
						);
						const historySummary = ordered.length
							? ordered
									.map(
										([version, item]) =>
											`V${version}: ${item.question}${
												Array.isArray(item.options) && item.options.length
													? ` | Options: ${item.options.join(' | ')}`
													: ''
											}`,
									)
									.join('\n')
							: '';

						group.contentForAi =
							`Current content:\n${report.poll.question}` +
							(pollOptionsPreview ? `\nOptions: ${pollOptionsPreview}` : '') +
							(historySummary ? `\n\nVersion history:\n${historySummary}` : '');
						group.contentPreview = report.poll.question.slice(0, 180);
						group.pollOptions = (report.poll.options || [])
							.map((option) => option.text)
							.filter(Boolean);
					}
				}

				const queue = Array.from(grouped.values()).map((item) => {
					item.reasons = Array.from(new Set(item.reasons));
					delete item.contentForAi;
					return item;
				});

				queue.sort((a, b) => {
					const severityDiff =
						getSeverityScore(b.worstAiVerdict, b.highestToxicity) -
						getSeverityScore(a.worstAiVerdict, a.highestToxicity);
					if (severityDiff !== 0) return severityDiff;

					const toxicityDiff = b.highestToxicity - a.highestToxicity;
					if (toxicityDiff !== 0) return toxicityDiff;

					const reportCountDiff = b.reportCount - a.reportCount;
					if (reportCountDiff !== 0) return reportCountDiff;

					return (
						new Date(b.lastReportedAt).getTime() -
						new Date(a.lastReportedAt).getTime()
					);
				});

				return NextResponse.json(queue);
			} catch (err) {
				console.error(err);
				return NextResponse.json(
					{ error: 'Internal Server Error' },
					{ status: 500 },
				);
			}
		},
		{ namespace: 'admin-report-queue', ttlSeconds: 60, keyParts: [viewerKey] },
	);
}
