import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['tsx', '--test', 'src/modules/external/countryMetadata.adapter.test.ts', 'src/modules/external/costProfile.adapter.test.ts', 'src/modules/fx/fx.provider.test.ts', 'src/modules/suggestions/suggestions.engine.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db' }
});
process.exit(result.status ?? 1);
