#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"

export npm_config_registry="https://registry.npmjs.org/"
[ -f .env ] || cp .env.example .env

if [ ! -d node_modules ] || [ ! -x node_modules/.bin/prisma ]; then
  echo "Installing backend packages from the public npm registry..."
  npm ci --no-audit --no-fund
else
  echo "Backend packages already installed. Skipping npm install."
fi

npm run prisma:generate
npm run prisma:migrate
npm run dev
