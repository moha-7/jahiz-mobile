#!/usr/bin/env sh
set -eu

[ -f .env ] || cp .env.example .env
npm install
docker compose up -d postgres

printf '%s\n' \
  'Jahiz workspace is ready.' \
  'Mobile: npm run mobile:start' \
  'Legacy install:' \
  '  npm ci --prefix legacy/safaryaty' \
  '  npm ci --prefix legacy/safaryaty/backend' \
  'Validation: npm run test'
