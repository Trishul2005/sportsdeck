This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Cron Jobs (Docker Deployment)

This project includes two cron-friendly scripts:

- `npm run cron:matches`
	- Calls `/api/matches` for a rolling 14-day window (`today` to `today + 13 days`).
	- Reuses the existing API logic for match ingestion, DB upserts, and thread synchronization.
- `npm run cron:sentiment`
	- Computes sentiment for active match threads and upserts one sentiment record per match.

### Required environment variables

- `DATABASE_URL` (required for sentiment job)
- `HF_TOKEN` (required for sentiment job unless `MOCK_EXTERNAL_APIS=true`)
- `CRON_BASE_URL` or `APP_BASE_URL` (required for match job when it calls your app endpoint)
- `CRON_SECRET` (optional, sent as `x-cron-secret` header)

### Optional environment variables

- `SENTIMENT_CRON_COOLDOWN_MINUTES` (default: `30`)
- `SENTIMENT_CRON_MATCH_LIMIT` (default: `50`)

### Example crontab entries (host-level cron)

Assuming your running app container is named `sportsdeck-app`:

```cron
# Every hour, fetch/sync NBA matches
5 * * * * docker exec sportsdeck-app sh -lc 'cd /app && npm run cron:matches'

# Every 30 minutes, refresh sentiment for active match threads
*/30 * * * * docker exec sportsdeck-app sh -lc 'cd /app && npm run cron:sentiment'
```

### Manual verification

Run once to verify behavior before adding schedules:

```bash
npm run cron:matches
npm run cron:sentiment
```
