#!/usr/bin/env bash
set -euo pipefail

echo "Beginning startup script..."

echo "Installing dependencies..."
npm install

echo "Syncing database schema..."
node ./setup-prisma.js
npx prisma migrate deploy || npx prisma db push
npx prisma generate

echo "Running database seed script..."
node ./lib/startup.js
