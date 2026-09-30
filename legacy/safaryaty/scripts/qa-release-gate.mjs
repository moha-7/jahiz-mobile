import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const required = [
  'qa/v4-29-37-full-mvp-scenario-matrix.md',
  'qa/release-signoff-template.md',
  'src/engine.test.js',
  'src/payments.test.js',
  'src/crossEngineParity.test.js',
  'src/decision-engine.test.js',
  'shared/decision-engine.js',
  'shared/recommendation-engine.js',
  'src/recommendation-engine.test.js',
  'qa/v4-29-42-recommendation-engine-checklist.md',
  'src/fx.test.js',
  'src/notifications.test.js',
  'src/notificationContract.test.js',
  'qa/v4-29-48-notification-system-checklist.md',
  'shared/trip-finance-profile.js',
  'src/tripFinanceProfile.test.js',
  'src/databaseNormalizationContract.test.js',
  'qa/v4-29-49-database-normalization-checklist.md',
  'backend/prisma/postgresql/schema.prisma',
  'backend/prisma/postgresql/migrations/202606230001_postgresql_baseline/migration.sql',
  'backend/prisma/postgresql/migrations/202606230002_staging_cutover_receipt/migration.sql',
  'backend/scripts/audit-postgresql-readiness.mjs',
  'backend/scripts/lib/migration-bundle.mjs',
  'src/postgresqlReadiness.test.js',
  'qa/v4-29-50-postgresql-readiness-checklist.md',
  'backend/scripts/import-postgresql-staging.mjs',
  'backend/scripts/postgresql-staging-smoke.ts',
  'backend/src/lib/postgresql-runtime-safety.ts',
  'src/postgresqlCutover.test.js',
  'qa/v4-29-51-controlled-postgresql-staging-checklist.md',
  'src/backendBuildGateContract.test.js',
  'docs/v4-29-52-1-backend-build-gate.md',
  'qa/v4-29-52-1-backend-build-gate-checklist.md'
];

const missing = required.filter((path) => !existsSync(path));
if (missing.length) {
  console.error(`QA gate blocked. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('QA artifacts present. Running automated release checks...');
const result = spawnSync('npm', ['run', 'test:all'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.status !== 0) process.exit(result.status ?? 1);

console.log('\nAutomated gate passed. Manual release approval still requires:');
console.log('  qa/v4-29-37-full-mvp-scenario-matrix.md');
console.log('Record results in:');
console.log('  qa/release-signoff-template.md');
