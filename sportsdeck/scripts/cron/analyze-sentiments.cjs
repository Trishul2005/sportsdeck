#!/usr/bin/env node

/*
 * Cron job: analyze sentiment for active match threads.
 * Aggregates post content by match and upserts one sentiment record per match.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const HF_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_LEGACY_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const MAX_LEN = 512;
const BATCH_SIZE = 10;
const DEFAULT_COOLDOWN_MINUTES = 1;
const DEFAULT_MATCH_LIMIT = 50;

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function scoreFromLabel(label, score) {
  if (label === 'positive') return Number(score) || 0;
  if (label === 'negative') return -(Number(score) || 0);
  return 0;
}

function parseClassificationPayload(payload) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const result = Array.isArray(first) ? first[0] : first;
  if (!result || !result.label) {
    return null;
  }
  return {
    label: String(result.label).toLowerCase(),
    score: Number(result.score) || 0,
  };
}

async function requestClassification(url, text, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Hugging Face API failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const parsed = parseClassificationPayload(payload);
  if (!parsed) {
    throw new Error('Unexpected Hugging Face response format.');
  }

  return parsed;
}

async function classifyText(text) {
  const mockEnabled = process.env.MOCK_EXTERNAL_APIS === 'true' || process.env.NODE_ENV === 'test';
  if (mockEnabled) {
    return { label: 'neutral', score: 0.5 };
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    throw new Error('HF_TOKEN is not configured.');
  }

  try {
    return await requestClassification(HF_ROUTER_URL, text, token);
  } catch (routerError) {
    try {
      return await requestClassification(HF_LEGACY_URL, text, token);
    } catch (legacyError) {
      console.warn(
        JSON.stringify({
          job: 'analyze-sentiments',
          warning: 'Using neutral fallback sentiment due to external API errors.',
          routerError: routerError?.message || String(routerError),
          legacyError: legacyError?.message || String(legacyError),
          at: new Date().toISOString(),
        }),
      );
      return { label: 'neutral', score: 0 };
    }
  }
}

async function analyzeBatchedSentiment(posts, prompt = null) {
  if (!posts.length) return null;

  const batches = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const batchText = batch.join('\n').slice(0, MAX_LEN);
    batches.push(prompt ? `${prompt}\n${batchText}` : batchText);
  }

  let total = 0;
  for (const batchText of batches) {
    const result = await classifyText(batchText);
    total += scoreFromLabel(result.label, result.score);
  }

  return total / batches.length;
}

async function getEligibleMatches({ cooldownMinutes, limit }) {
  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  return prisma.match.findMany({
    where: {
      threads: {
        some: {
          isVisible: true,
          isClosed: false,
          posts: {
            some: {},
          },
        },
      },
      OR: [
        { sentiment: null },
        { sentiment: { updatedAt: { lt: cutoff } } },
      ],
    },
    select: {
      id: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      sentiment: { select: { updatedAt: true } },
      threads: {
        where: { isVisible: true },
        select: {
          id: true,
          posts: {
            select: { content: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

async function analyzeAndUpsertMatch(match) {
  const allPosts = [];
  for (const thread of match.threads) {
    for (const post of thread.posts) {
      if (post.content && post.content.trim()) {
        allPosts.push(post.content.trim());
      }
    }
  }

  if (!allPosts.length) {
    return { skipped: true, reason: 'no_posts' };
  }

  const overall = await analyzeBatchedSentiment(allPosts);
  const homePrompt = `Analyze the sentiment towards ${match.homeTeam?.name || 'home team'} in the following text:`;
  const awayPrompt = `Analyze the sentiment towards ${match.awayTeam?.name || 'away team'} in the following text:`;
  const homeTeam = await analyzeBatchedSentiment(allPosts, homePrompt);
  const awayTeam = await analyzeBatchedSentiment(allPosts, awayPrompt);

  await prisma.sentiment.upsert({
    where: { matchId: match.id },
    update: {
      overall,
      homeTeam,
      awayTeam,
      numPosts: allPosts.length,
    },
    create: {
      matchId: match.id,
      overall,
      homeTeam,
      awayTeam,
      numPosts: allPosts.length,
    },
  });

  return {
    skipped: false,
    numPosts: allPosts.length,
    overall,
  };
}

async function main() {
  const cooldownMinutes = parseNumber(process.env.SENTIMENT_CRON_COOLDOWN_MINUTES, DEFAULT_COOLDOWN_MINUTES);
  const matchLimit = parseNumber(process.env.SENTIMENT_CRON_MATCH_LIMIT, DEFAULT_MATCH_LIMIT);

  const matches = await getEligibleMatches({
    cooldownMinutes,
    limit: matchLimit,
  });

  let processed = 0;
  let skipped = 0;
  const errors = [];

  for (const match of matches) {
    try {
      const result = await analyzeAndUpsertMatch(match);
      if (result.skipped) {
        skipped += 1;
      } else {
        processed += 1;
      }
    } catch (error) {
      errors.push({ matchId: match.id, error: error?.message || String(error) });
    }
  }

  const ok = errors.length === 0;
  console.log(
    JSON.stringify({
      job: 'analyze-sentiments',
      ok,
      consideredMatches: matches.length,
      processed,
      skipped,
      errors,
      at: new Date().toISOString(),
    }),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        job: 'analyze-sentiments',
        ok: false,
        error: error?.message || String(error),
        at: new Date().toISOString(),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
