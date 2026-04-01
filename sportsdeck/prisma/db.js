import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;
const DEFAULT_CONNECTION_LIMIT = process.env.PRISMA_CONNECTION_LIMIT || '8';
const DEFAULT_POOL_TIMEOUT = process.env.PRISMA_POOL_TIMEOUT || '30';

function buildPrismaUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT);
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

const prismaUrl = buildPrismaUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    prismaUrl
      ? {
          datasources: {
            db: {
              url: prismaUrl,
            },
          },
        }
      : undefined,
  );

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
