import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = [
  'apps/mobile/package.json',
  'packages/design-tokens/package.json',
  'packages/ui/package.json',
  'packages/core-finance/package.json',
  'packages/api-contracts/package.json',
  'packages/i18n/package.json',
  'legacy/safaryaty/package.json',
  'legacy/safaryaty/backend/package.json',
  'compose.yml',
  '.github/workflows/ci.yml',
];

for (const path of required) await access(resolve(process.cwd(), path));
console.log(`Workspace structure passed (${required.length} required paths).`);
