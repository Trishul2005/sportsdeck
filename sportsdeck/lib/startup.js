import { prisma } from "../prisma/db.js";
import jwt from "jsonwebtoken";

const API_BASE_URL = (process.env.APP_BASE_URL || process.env.CRON_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SEED_PASSWORD = process.env.SEED_PASSWORD || "password123";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_DAYS = 13;
const POST_EDIT_HISTORY_VERDICT = "__edit_history__";
const POLL_EDIT_HISTORY_VERDICT = "__poll_edit_history__";

const SEED_USERS = [
  {
    key: "admin",
    email: "seed.admin@sportsdeck.com",
    username: "commissioner",
    initialUsername: "seed_admin",
    favoriteTeam: "Toronto Raptors",
    role: "ADMIN",
    avatarLabel: "CM",
    avatarBg: "#b91c1c",
  },
  {
    key: "nova",
    email: "maya.nova@sportsdeck.com",
    username: "MayaNova",
    initialUsername: "seed_maya_nova",
    favoriteTeam: "Boston Celtics",
    avatarLabel: "MN",
    avatarBg: "#15803d",
  },
  {
    key: "diesel",
    email: "omar.diesel@sportsdeck.com",
    username: "OmarDiesel",
    initialUsername: "seed_omar_diesel",
    favoriteTeam: "Milwaukee Bucks",
    avatarLabel: "OD",
    avatarBg: "#065f46",
  },
  {
    key: "sky",
    email: "lena.sky@sportsdeck.com",
    username: "LenaSky",
    initialUsername: "seed_lena_sky",
    favoriteTeam: "Los Angeles Lakers",
    avatarLabel: "LS",
    avatarBg: "#7c3aed",
  },
  {
    key: "clutch",
    email: "dev.clutch@sportsdeck.com",
    username: "DevClutch",
    initialUsername: "seed_dev_clutch",
    favoriteTeam: "Dallas Mavericks",
    avatarLabel: "DC",
    avatarBg: "#1d4ed8",
  },
  {
    key: "rush",
    email: "nina.rush@sportsdeck.com",
    username: "NinaRush",
    initialUsername: "seed_nina_rush",
    favoriteTeam: "Golden State Warriors",
    avatarLabel: "NR",
    avatarBg: "#92400e",
  },
  {
    key: "crown",
    email: "isaac.crown@sportsdeck.com",
    username: "IsaacCrown",
    initialUsername: "seed_isaac_crown",
    favoriteTeam: "Phoenix Suns",
    avatarLabel: "IC",
    avatarBg: "#9a3412",
  },
  {
    key: "tempo",
    email: "zoe.tempo@sportsdeck.com",
    username: "ZoeTempo",
    initialUsername: "seed_zoe_tempo",
    favoriteTeam: "New York Knicks",
    avatarLabel: "ZT",
    avatarBg: "#be185d",
  },
  {
    key: "echo",
    email: "ryan.echo@sportsdeck.com",
    username: "RyanEcho",
    initialUsername: "seed_ryan_echo",
    favoriteTeam: "Denver Nuggets",
    avatarLabel: "RE",
    avatarBg: "#0f766e",
  },
  {
    key: "blaze",
    email: "tara.blaze@sportsdeck.com",
    username: "TaraBlaze",
    initialUsername: "seed_tara_blaze",
    favoriteTeam: "Oklahoma City Thunder",
    avatarLabel: "TB",
    avatarBg: "#374151",
  },
];

const FOLLOW_RELATIONSHIPS = [
  ["nova", "diesel"],
  ["nova", "sky"],
  ["diesel", "nova"],
  ["diesel", "clutch"],
  ["sky", "nova"],
  ["sky", "tempo"],
  ["clutch", "rush"],
  ["rush", "clutch"],
  ["rush", "echo"],
  ["crown", "nova"],
  ["tempo", "blaze"],
  ["echo", "tempo"],
  ["blaze", "nova"],
  ["admin", "nova"],
  ["admin", "diesel"],
];

const THREAD_BLUEPRINTS = [
  {
    key: "general_playoff",
    authorKey: "nova",
    title: "Playoff dark horse check-in",
    content:
      "Which under-the-radar team actually has the depth to make a real playoff run this year? I keep coming back to disciplined benches and half-court defense.",
    tags: ["playoff-race", "mvp-watch", "trade-watch"],
  },
  {
    key: "raptors_young_core",
    authorKey: "diesel",
    teamName: "Toronto Raptors",
    title: "Is the Raptors young core ahead of schedule?",
    content:
      "The effort level has been good, but I want to know whether people think the current rotation is a real foundation or just a fun stretch.",
    tags: ["bench-energy", "injury-update"],
  },
  {
    key: "lakers_bench",
    authorKey: "sky",
    teamName: "Los Angeles Lakers",
    title: "Bench unit trust meter for late-season games",
    content:
      "When the starters sit, which lineup combinations do you actually trust to hold momentum for five straight minutes?",
    tags: ["bench-energy", "playoff-race"],
  },
  {
    key: "mavs_spacing",
    authorKey: "clutch",
    teamName: "Dallas Mavericks",
    title: "Spacing choices around the stars",
    content:
      "I think the shot profile looks better when the wings cut hard instead of standing still. Curious if everyone else is seeing the same thing.",
    tags: ["trade-watch", "playoff-race"],
  },
];

const POLL_THREAD_BLUEPRINTS = [
  {
    key: "awards_poll",
    authorKey: "rush",
    title: "Award race pulse check",
    teamName: "Boston Celtics",
    tags: ["mvp-watch", "playoff-race"],
    poll: {
      question: "Which storyline will dominate the next week?",
      options: [
        "MVP race swings again",
        "Injury return changes a contender",
        "Trade deadline chemistry finally clicks",
        "Bench unit steals the spotlight",
      ],
      deadlineDays: 5,
    },
  },
  {
    key: "okc_poll",
    authorKey: "blaze",
    title: "Thunder rotation vote",
    teamName: "Oklahoma City Thunder",
    tags: ["bench-energy", "playoff-race"],
    poll: {
      question: "What matters most for OKC in the next stretch?",
      options: [
        "Half-court execution",
        "Frontcourt rebounding",
        "Protecting the stars' minutes",
        "Finding one more scorer off the bench",
      ],
      deadlineDays: 6,
    },
  },
];

const REPLY_BLUEPRINTS = [
  {
    key: "reply_general_1",
    authorKey: "diesel",
    threadKey: "general_playoff",
    content:
      "Depth still decides everything for me. If the eighth and ninth guys can survive road games, that team gets dangerous quickly.",
  },
  {
    key: "reply_general_2",
    authorKey: "tempo",
    threadKey: "general_playoff",
    parentKey: "reply_general_1",
    content:
      "Same, and I also care a lot about whether that depth can generate paint pressure instead of only spot-up threes.",
  },
  {
    key: "reply_raptors_1",
    authorKey: "nova",
    threadKey: "raptors_young_core",
    content:
      "Ahead of schedule maybe, but I still think they need one more reliable shooter before expectations get too serious.",
  },
  {
    key: "reply_lakers_1",
    authorKey: "echo",
    threadKey: "lakers_bench",
    content:
      "The stagger looks way cleaner when the second unit has one true organizer and one downhill driver on the floor together.",
  },
  {
    key: "reply_mavs_1",
    authorKey: "rush",
    threadKey: "mavs_spacing",
    content:
      "The cuts matter, but I think the bigger issue is whether the weak-side wing is ready to fire immediately when the pass comes.",
  },
];

const POST_EDITS = [
  {
    threadKey: "general_playoff",
    finalContent:
      "Which under-the-radar team actually has the depth and defensive discipline to make a real playoff run this year? I keep coming back to benches that can survive ugly road possessions.",
  },
  {
    replyKey: "reply_raptors_1",
    finalContent:
      "Ahead of schedule maybe, but I still think they need one more reliable shooter and one sturdier rebounder before expectations get too serious.",
  },
];

const POLL_EDITS = [
  {
    pollThreadKey: "awards_poll",
    question: "Which storyline will dominate the next NBA week?",
    options: [
      "MVP race swings again",
      "Injury return changes a contender",
      "Trade chemistry finally clicks",
      "Bench unit steals the spotlight",
    ],
    deadlineDays: 7,
  },
];

const MANUAL_REPORTS = [
  {
    reporterKey: "admin",
    type: "thread",
    threadKey: "lakers_bench",
    reason: "Keep an eye on this one for tone if it gets heated.",
  },
  {
    reporterKey: "nova",
    type: "post",
    replyKey: "reply_mavs_1",
    reason: "This feels unnecessarily dismissive and worth moderator review.",
  },
  {
    reporterKey: "diesel",
    type: "poll",
    pollThreadKey: "okc_poll",
    reason: "Poll framing is a little inflammatory and should be reviewed.",
  },
];

const AUTO_FLAG_CONTENT = {
  toxicThread: {
    key: "toxic_thread",
    authorKey: "echo",
    title: "Everyone on this bench is useless trash",
    content: "This rotation is pathetic and everyone on it is trash.",
    tags: ["bench-energy"],
  },
  toxicPost: {
    authorKey: "crown",
    targetThreadKey: "general_playoff",
    content: "This take is stupid and the whole fanbase sounds clueless.",
  },
  toxicPoll: {
    key: "toxic_poll",
    authorKey: "tempo",
    title: "Which fanbase is the most embarrassing right now?",
    tags: ["playoff-race"],
    poll: {
      question: "Which fanbase is the most embarrassing right now?",
      options: [
        "The loud frontrunners",
        "The excuse makers",
        "The meltdown crew",
        "The doom-posters",
      ],
      deadlineDays: 4,
    },
  },
};

function logStep(message) {
  console.log(`Startup seed: ${message}`);
}

function formatDateInput(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function plusDays(days) {
  return new Date(Date.now() + days * ONE_DAY_MS);
}

function createSeedAvatarSvg({ label, background, foreground = "#fff7ed" }) {
  const safeLabel = String(label || "?").trim().slice(0, 2).toUpperCase() || "?";
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${safeLabel}">
      <rect width="160" height="160" rx="80" fill="${background}" />
      <circle cx="80" cy="62" r="28" fill="${foreground}" fill-opacity="0.2" />
      <path d="M36 132c10-24 31-36 44-36s34 12 44 36" fill="${foreground}" fill-opacity="0.2" />
      <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="${foreground}">
        ${safeLabel}
      </text>
    </svg>
  `.replace(/\s+/g, " ").trim();
}

async function apiJson(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${method} ${path}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function buildAuthCookie(tokens) {
  return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`;
}

function issueSeedTokens(user) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not configured.");
  }

  // Seed only needs authenticated API access during bootstrap; refresh token content is irrelevant here.
  const accessToken = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "2h" },
  );

  return {
    accessToken,
    refreshToken: `seed-refresh-${user.id}`,
  };
}

async function ensureSeedUser(definition) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: definition.email }, { username: definition.username }, { username: definition.initialUsername }],
    },
    select: { id: true, email: true, username: true },
  });

  if (!user) {
    const signupPayload = await apiJson("/api/user/signup", {
      method: "POST",
      body: {
        email: definition.email,
        username: definition.initialUsername || definition.username,
        password: SEED_PASSWORD,
      },
    });
    user = signupPayload.user;
  }

  if (definition.role === "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }

  return prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, username: true, role: true },
  });
}

async function issueSeedSession(user) {
  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, role: true },
  });
  const tokens = issueSeedTokens(freshUser);
  return buildAuthCookie(tokens);
}

async function ensureProfile(userDef, cookie, teamIdByName) {
  const favoriteTeamId = teamIdByName.get(userDef.favoriteTeam) || null;
  const formData = new FormData();
  formData.set("username", userDef.username);
  formData.set("favoriteTeamId", favoriteTeamId === null ? "" : String(favoriteTeamId));

  const avatarSvg = createSeedAvatarSvg({
    label: userDef.avatarLabel,
    background: userDef.avatarBg,
  });
  const avatarFile = new File([avatarSvg], `${userDef.key}-avatar.svg`, {
    type: "image/svg+xml",
  });
  formData.set("avatarFile", avatarFile);

  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: "PATCH",
    headers: {
      Cookie: cookie,
    },
    body: formData,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error || "Failed to update seed profile.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
}

async function ensureFollow(followerId, followingId, cookie) {
  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId, followingId },
    },
    select: { id: true },
  });
  if (existing) return existing;
  return apiJson(`/api/user/${followingId}/follow`, { method: "POST", cookie });
}

async function ensureTeamsAndMatches() {
  await apiJson("/api/teams?limit=50&refresh=true");
  await apiJson("/api/standings?abbreviation=EAST&refresh=true");
  await apiJson("/api/standings?abbreviation=WEST&refresh=true");

  const pastFrom = formatDateInput(plusDays(-MATCH_WINDOW_DAYS));
  const pastTo = formatDateInput(plusDays(-1));
  const futureFrom = formatDateInput(new Date());
  const futureTo = formatDateInput(plusDays(MATCH_WINDOW_DAYS));

  await apiJson(`/api/matches?fromDate=${pastFrom}&toDate=${pastTo}&limit=100&refresh=true`);
  await apiJson(`/api/matches?fromDate=${futureFrom}&toDate=${futureTo}&limit=100&refresh=true`);
}

async function getTeamsByName() {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  return new Map(teams.map((team) => [team.name, team.id]));
}

async function createStandalonePost({ authorId, cookie, content }) {
  const existing = await prisma.post.findFirst({
    where: {
      authorId,
      threadId: null,
      parentId: null,
      content,
    },
    select: { id: true },
  });
  if (existing) {
    return prisma.post.findUnique({ where: { id: existing.id } });
  }

  return apiJson("/api/post", {
    method: "POST",
    cookie,
    body: { content },
  });
}

async function ensureDiscussionThread({ blueprint, usersByKey, cookiesByUserId, teamIdByName }) {
  const author = usersByKey.get(blueprint.authorKey);
  const teamId = blueprint.teamName ? teamIdByName.get(blueprint.teamName) : null;

  let existingThread = await prisma.thread.findFirst({
    where: {
      title: blueprint.title,
      createdById: author.id,
    },
    select: { id: true, mainPostId: true },
  });

  if (!existingThread) {
    const mainPost = await createStandalonePost({
      authorId: author.id,
      cookie: cookiesByUserId.get(author.id),
      content: blueprint.content,
    });

    const thread = await apiJson("/api/threads", {
      method: "POST",
      cookie: cookiesByUserId.get(author.id),
      body: {
        title: blueprint.title,
        mainPostId: mainPost.id,
        teamId,
        tags: blueprint.tags,
      },
    });
    existingThread = { id: thread.id, mainPostId: thread.mainPostId };
  }

  return prisma.thread.findUnique({
    where: { id: existingThread.id },
    include: {
      mainPost: true,
      tags: { include: { tag: true } },
    },
  });
}

async function ensurePollThread({ blueprint, usersByKey, cookiesByUserId, teamIdByName }) {
  const author = usersByKey.get(blueprint.authorKey);
  const teamId = blueprint.teamName ? teamIdByName.get(blueprint.teamName) : null;
  const deadline = plusDays(blueprint.poll.deadlineDays).toISOString();

  let existingThread = await prisma.thread.findFirst({
    where: {
      title: blueprint.title,
      createdById: author.id,
    },
    select: { id: true },
  });

  if (!existingThread) {
    const created = await apiJson("/api/threads", {
      method: "POST",
      cookie: cookiesByUserId.get(author.id),
      body: {
        title: blueprint.title,
        teamId,
        tags: blueprint.tags,
        poll: {
          question: blueprint.poll.question,
          options: blueprint.poll.options,
          deadline,
        },
      },
    });
    existingThread = { id: created.id };
  }

  return prisma.thread.findUnique({
    where: { id: existingThread.id },
    include: {
      polls: { include: { options: true } },
    },
  });
}

async function ensureReply({ authorId, cookie, threadId, parentId, content }) {
  const existing = await prisma.post.findFirst({
    where: {
      authorId,
      threadId,
      parentId: parentId ?? null,
      content,
    },
    select: { id: true },
  });
  if (existing) {
    return prisma.post.findUnique({ where: { id: existing.id } });
  }

  if (parentId) {
    const legacyReply = await prisma.post.findFirst({
      where: {
        authorId,
        threadId,
        parentId: null,
        content,
      },
      select: { id: true },
    });

    if (legacyReply) {
      await prisma.post.update({
        where: { id: legacyReply.id },
        data: { parentId },
      });
      return prisma.post.findUnique({ where: { id: legacyReply.id } });
    }
  }

  return apiJson("/api/post", {
    method: "POST",
    cookie,
    body: {
      content,
      threadId,
      ...(parentId ? { parentId } : {}),
    },
  });
}

async function ensurePostEdit(postId, cookie, finalContent) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, content: true },
  });
  if (!post || post.content === finalContent) return;

  await apiJson(`/api/post/${postId}`, {
    method: "PUT",
    cookie,
    body: { content: finalContent },
  });
}

async function ensurePollEdit(pollId, cookie, edit) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { orderBy: { id: "asc" } } },
  });
  if (!poll) return;

  const sameQuestion = poll.question === edit.question;
  const sameOptions = poll.options.map((option) => option.text).join("||") === edit.options.join("||");
  if (sameQuestion && sameOptions) return;

  await apiJson(`/api/poll/${pollId}`, {
    method: "PUT",
    cookie,
    body: {
      question: edit.question,
      options: edit.options,
      deadline: plusDays(edit.deadlineDays).toISOString(),
    },
  });
}

async function ensureVote(pollId, userId, cookie) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { orderBy: { id: "asc" } } },
  });
  if (!poll || poll.options.length === 0) return;

  const existing = await prisma.pollVote.findFirst({
    where: { pollId, userId },
    select: { id: true },
  });
  if (existing) return;

  const option = poll.options[userId % poll.options.length];
  await apiJson(`/api/poll/${pollId}/vote`, {
    method: "POST",
    cookie,
    body: { optionId: option.id },
  });
}

async function ensureThreadReport(threadId, reporterId, cookie, reason) {
  const existing = await prisma.report.findFirst({
    where: { threadId, reportedById: reporterId },
    select: { id: true },
  });
  if (existing) return;

  await apiJson(`/api/threads/${threadId}/report`, { method: "POST", cookie, body: { reason } });
}

async function ensurePostReport(postId, reporterId, cookie, reason) {
  const existing = await prisma.report.findFirst({
    where: {
      postId,
      reportedById: reporterId,
      aiVerdict: { not: POST_EDIT_HISTORY_VERDICT },
    },
    select: { id: true },
  });
  if (existing) return;

  await apiJson(`/api/post/${postId}/report`, { method: "POST", cookie, body: { reason } });
}

async function ensurePollReport(pollId, reporterId, cookie, reason) {
  const existing = await prisma.report.findFirst({
    where: {
      pollId,
      reportedById: reporterId,
      aiVerdict: { not: POLL_EDIT_HISTORY_VERDICT },
    },
    select: { id: true },
  });
  if (existing) return;

  await apiJson(`/api/poll/${pollId}/report`, { method: "POST", cookie, body: { reason } });
}

async function ensureBan(userId, adminCookie, shouldBan = true) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true },
  });
  if (!user || user.isBanned === shouldBan) return;

  await apiJson(`/api/admin/ban/${userId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { result: shouldBan ? "BAN" : "UNBAN" },
  });
}

async function ensureAppeal(userId, cookie, reason) {
  const existing = await prisma.appeal.findFirst({
    where: { userId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) return;

  await apiJson("/api/user/appeal", { method: "POST", cookie, body: { reason } });
}

async function seedMatchActivity(usersByKey, cookiesByUserId) {
  const matchThreads = await prisma.thread.findMany({
    where: { matchId: { not: null }, isVisible: true },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, mainPostId: true },
  });

  if (matchThreads.length === 0) return;

  const matchCommentSeeds = [
    {
      authorKey: "nova",
      content: "This matchup should be a good test of who can control the glass early.",
    },
    {
      authorKey: "diesel",
      content: "I mostly want to see which bench unit keeps the pace up when the starters sit.",
    },
    {
      authorKey: "sky",
      content: "If the home team protects the paint, the thread mood is going to swing fast tonight.",
    },
  ];

  for (let index = 0; index < matchThreads.length; index += 1) {
    const thread = matchThreads[index];
    const seed = matchCommentSeeds[index % matchCommentSeeds.length];
    const author = usersByKey.get(seed.authorKey);
    await ensureReply({
      authorId: author.id,
      cookie: cookiesByUserId.get(author.id),
      threadId: thread.id,
      parentId: thread.mainPostId,
      content: `${seed.content} Seed note for ${thread.title}.`,
    });
  }
}

async function ensureAutoFlagSeeds(usersByKey, cookiesByUserId, teamIdByName, threadsByKey) {
  await ensureDiscussionThread({
    blueprint: AUTO_FLAG_CONTENT.toxicThread,
    usersByKey,
    cookiesByUserId,
    teamIdByName,
  });

  const toxicPostThread = threadsByKey.get(AUTO_FLAG_CONTENT.toxicPost.targetThreadKey);
  if (toxicPostThread) {
    const author = usersByKey.get(AUTO_FLAG_CONTENT.toxicPost.authorKey);
    await ensureReply({
      authorId: author.id,
      cookie: cookiesByUserId.get(author.id),
      threadId: toxicPostThread.id,
      parentId: toxicPostThread.mainPostId,
      content: AUTO_FLAG_CONTENT.toxicPost.content,
    });
  }

  await ensurePollThread({
    blueprint: AUTO_FLAG_CONTENT.toxicPoll,
    usersByKey,
    cookiesByUserId,
    teamIdByName,
  });
}

async function main() {
  logStep("begin");

  const usersByKey = new Map();
  const cookiesByUserId = new Map();

  for (const userDef of SEED_USERS) {
    const user = await ensureSeedUser(userDef);
    usersByKey.set(userDef.key, user);
  }
  logStep(`users ready (${Array.from(usersByKey.values()).map((user) => user.id).join(", ")})`);

  for (const user of usersByKey.values()) {
    const cookie = await issueSeedSession(user);
    cookiesByUserId.set(user.id, cookie);
  }

  await ensureTeamsAndMatches();
  const teamIdByName = await getTeamsByName();
  logStep(`teams synced (${teamIdByName.size})`);

  for (const userDef of SEED_USERS) {
    const user = usersByKey.get(userDef.key);
    await ensureProfile(userDef, cookiesByUserId.get(user.id), teamIdByName);
  }
  logStep("profiles updated");

  for (const [followerKey, followingKey] of FOLLOW_RELATIONSHIPS) {
    const follower = usersByKey.get(followerKey);
    const following = usersByKey.get(followingKey);
    await ensureFollow(follower.id, following.id, cookiesByUserId.get(follower.id));
  }
  logStep("follow graph ready");

  const threadsByKey = new Map();
  for (const blueprint of THREAD_BLUEPRINTS) {
    const thread = await ensureDiscussionThread({ blueprint, usersByKey, cookiesByUserId, teamIdByName });
    threadsByKey.set(blueprint.key, thread);
  }
  for (const blueprint of POLL_THREAD_BLUEPRINTS) {
    const thread = await ensurePollThread({ blueprint, usersByKey, cookiesByUserId, teamIdByName });
    threadsByKey.set(blueprint.key, thread);
  }
  logStep(`threads ready (${threadsByKey.size})`);

  const repliesByKey = new Map();
  for (const blueprint of REPLY_BLUEPRINTS) {
    const author = usersByKey.get(blueprint.authorKey);
    const thread = threadsByKey.get(blueprint.threadKey);
    const parent = blueprint.parentKey ? repliesByKey.get(blueprint.parentKey) : thread?.mainPost;
    const reply = await ensureReply({
      authorId: author.id,
      cookie: cookiesByUserId.get(author.id),
      threadId: thread.id,
      parentId: parent?.id,
      content: blueprint.content,
    });
    repliesByKey.set(blueprint.key, reply);
  }
  await seedMatchActivity(usersByKey, cookiesByUserId);
  logStep("posts and replies ready");

  for (const edit of POST_EDITS) {
    let postId = null;
    let authorId = null;

    if (edit.threadKey) {
      const thread = threadsByKey.get(edit.threadKey);
      postId = thread?.mainPostId;
      authorId = thread?.createdById;
    } else if (edit.replyKey) {
      const reply = repliesByKey.get(edit.replyKey);
      postId = reply?.id;
      authorId = reply?.authorId;
    }

    if (postId && authorId) {
      await ensurePostEdit(postId, cookiesByUserId.get(authorId), edit.finalContent);
    }
  }

  for (const edit of POLL_EDITS) {
    const thread = threadsByKey.get(edit.pollThreadKey);
    const poll =
      thread?.polls?.[0] ||
      (await prisma.poll.findFirst({
        where: { threadId: thread?.id },
        select: { id: true, createdById: true },
      }));

    if (poll) {
      await ensurePollEdit(poll.id, cookiesByUserId.get(poll.createdById), edit);
    }
  }
  logStep("edit history ready");

  const pollThreads = await prisma.thread.findMany({
    where: { id: { in: Array.from(threadsByKey.values()).map((thread) => thread.id) } },
    include: { polls: { include: { options: true } } },
  });
  for (const thread of pollThreads) {
    const poll = thread.polls[0];
    if (!poll) continue;

    for (const voterKey of ["nova", "diesel", "sky", "clutch"]) {
      const voter = usersByKey.get(voterKey);
      await ensureVote(poll.id, voter.id, cookiesByUserId.get(voter.id));
    }
  }
  logStep("poll votes ready");

  for (const report of MANUAL_REPORTS) {
    const reporter = usersByKey.get(report.reporterKey);

    if (report.type === "thread") {
      await ensureThreadReport(
        threadsByKey.get(report.threadKey).id,
        reporter.id,
        cookiesByUserId.get(reporter.id),
        report.reason,
      );
      continue;
    }

    if (report.type === "post") {
      await ensurePostReport(
        repliesByKey.get(report.replyKey).id,
        reporter.id,
        cookiesByUserId.get(reporter.id),
        report.reason,
      );
      continue;
    }

    const thread = threadsByKey.get(report.pollThreadKey);
    const poll = await prisma.poll.findFirst({
      where: { threadId: thread.id },
      select: { id: true },
    });
    if (poll) {
      await ensurePollReport(poll.id, reporter.id, cookiesByUserId.get(reporter.id), report.reason);
    }
  }

  await ensureAutoFlagSeeds(usersByKey, cookiesByUserId, teamIdByName, threadsByKey);
  logStep("reports and moderation samples ready");

  const adminUser = usersByKey.get("admin");
  for (const bannedKey of ["crown", "echo", "blaze"]) {
    const target = usersByKey.get(bannedKey);
    await ensureBan(target.id, cookiesByUserId.get(adminUser.id), true);
  }

  for (const appealKey of ["echo", "blaze"]) {
    const target = usersByKey.get(appealKey);
    await ensureAppeal(
      target.id,
      cookiesByUserId.get(target.id),
      `Seed appeal from ${appealKey}: I understand the moderation rules now and would like another chance to participate respectfully.`,
    );
  }
  logStep("bans and appeals ready");

  logStep("done");
}

main()
  .catch((error) => {
    console.error("Startup seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });