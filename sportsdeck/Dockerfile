FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY setup-prisma.js ./setup-prisma.js
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN node ./setup-prisma.js
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl openssl \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/types ./types
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/babel.config.js ./babel.config.js
COPY --from=builder /app/eslint.config.mjs ./eslint.config.mjs
COPY --from=builder /app/jest.config.js ./jest.config.js
COPY --from=builder /app/setup-prisma.js ./setup-prisma.js
COPY docker/entrypoint.sh ./docker/entrypoint.sh
COPY docker/import-data-service.sh ./docker/import-data-service.sh
COPY docker/cron-runner.sh ./docker/cron-runner.sh

RUN chmod +x ./docker/entrypoint.sh ./docker/import-data-service.sh ./docker/cron-runner.sh

EXPOSE 3000

CMD ["./docker/entrypoint.sh"]
