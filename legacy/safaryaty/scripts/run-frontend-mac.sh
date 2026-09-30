#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export npm_config_registry="https://registry.npmjs.org/"

if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  echo "Installing frontend packages from the public npm registry..."
  npm ci --no-audit --no-fund
else
  echo "Frontend packages already installed. Skipping npm install."
fi

npm run dev
