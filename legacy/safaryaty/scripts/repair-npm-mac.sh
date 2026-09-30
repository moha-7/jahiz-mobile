#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Resetting this project to the public npm registry..."
npm config delete proxy --location=project 2>/dev/null || true
npm config delete https-proxy --location=project 2>/dev/null || true
npm config set registry https://registry.npmjs.org/ --location=project

rm -rf node_modules
npm cache verify || true
npm ci --no-audit --no-fund

echo "Frontend npm installation repaired. Run ./scripts/run-frontend-mac.sh"
