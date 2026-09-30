#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export npm_config_registry="https://registry.npmjs.org/"
echo "Safaryaty Stability Test — Mac/Linux"

if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  npm ci --no-audit --no-fund
fi
npm run test:core
npm run test:stability
npm run build

cd backend
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/prisma ]; then
  npm ci --no-audit --no-fund
fi
npm run prisma:generate
npm run test:external
npm run build

echo "All runnable stability checks passed."
