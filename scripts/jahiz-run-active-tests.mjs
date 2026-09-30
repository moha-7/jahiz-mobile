import {
  spawnSync,
} from 'node:child_process';

import path from 'node:path';

import {
  pathToFileURL,
} from 'node:url';

const regressionTests = [
  'packages/api-contracts/src/financial-timeline.test.ts',
  'packages/api-contracts/src/recurring-commitments.test.ts',
  'packages/api-contracts/src/trip-portfolio.test.ts',

  'scripts/jahiz-account-local-isolation.test.ts',
  'scripts/jahiz-account-local-isolation-source-contract.test.mjs',
  'scripts/jahiz-anonymous-portfolio-adoption.test.ts',
  'scripts/jahiz-anonymous-portfolio-adoption-source-contract.test.mjs',
  'scripts/jahiz-api-readiness.test.mjs',

  'scripts/jahiz-actionable-focus-source-contract.test.mjs',

  'scripts/jahiz-bottom-inset-contract.test.ts',
  'scripts/jahiz-create-trip-final-route-source-contract.test.mjs',
  'scripts/jahiz-cost-review-truth-source-contract.test.mjs',

  'scripts/jahiz-decision-state.test.ts',
  'scripts/jahiz-exact-overdue-payment-action.test.ts',

  'scripts/jahiz-i18n-interpolation-regression.test.ts',
  'scripts/jahiz-i18n-pluralization.test.ts',
  'scripts/jahiz-i18n-runtime.test.ts',

  'scripts/jahiz-large-secure-persistence.test.ts',
  'scripts/jahiz-local-calendar-date-truth.test.ts',

  'scripts/jahiz-new-commitment-status-source-contract.test.mjs',
  'scripts/jahiz-installment-sequence.test.ts',
  'scripts/jahiz-recurring-commitment-lifecycle.test.ts',
  'scripts/jahiz-recurring-commitment-store-source-contract.test.mjs',
  'scripts/jahiz-recurring-commitment-selectors.test.ts',
  'scripts/jahiz-recurring-commitment-read-model-source-contract.test.mjs',
  'scripts/jahiz-recurring-commitment-ui-preview.test.ts',
  'scripts/jahiz-recurring-money-input.test.ts',
  'scripts/jahiz-recurring-financial-ui-consistency.test.mjs',
  'scripts/jahiz-recurring-commitment-ui-source-contract.test.mjs',
  'scripts/jahiz-recurring-commitment-ui-wiring.test.mjs',
  'scripts/jahiz-recurring-commitment-ui-lifecycle-wiring.test.mjs',

  'scripts/jahiz-money-timing-truth.test.ts',
  'scripts/jahiz-need-to-save-remaining-cost.test.ts',
  'scripts/jahiz-next-due-commitment-group-source-contract.test.mjs',
  'scripts/jahiz-money-timing-ux-truth.test.mjs',
  'scripts/jahiz-financial-summary-clarity-source-contract.test.mjs',

  'scripts/jahiz-move-engine.test.ts',
  'scripts/jahiz-move-specific-explanation-source-contract.test.mjs',

  'scripts/jahiz-plan-next-step-route-contract.test.mjs',
  'scripts/jahiz-plan-trip-window-truth.test.mjs',

  'scripts/jahiz-product-metrics.test.ts',
  'scripts/jahiz-product-metrics-source-contract.test.mjs',

  'scripts/jahiz-profile-theme-contrast.test.mjs',

  'scripts/jahiz-server-truth.test.ts',

  'scripts/jahiz-shadow-acceptance-lifecycle.test.mjs',
  'scripts/jahiz-shadow-diagnostics.test.ts',
  'scripts/jahiz-shadow-observe-wiring.test.ts',
  'scripts/jahiz-shadow-parity-evidence.test.ts',
  'scripts/jahiz-shadow-sync-runtime.test.ts',
  'scripts/jahiz-shadow-sync.test.ts',

  'scripts/jahiz-today-financial-coverage.test.ts',

  'scripts/jahiz-trip-portfolio-secure-persistence.test.mjs',
  'scripts/jahiz-sync-conflict-review.test.ts',
  'scripts/jahiz-sync-conflict-review-source-contract.test.mjs',

  'scripts/jahiz-sync-runtime-integration.test.ts',
  'scripts/jahiz-sync-runtime-integration-source-contract.test.mjs',

  'scripts/jahiz-trip-sync-executor.test.ts',
  'scripts/jahiz-trip-sync-state.test.ts',
  'scripts/jahiz-trip-sync-state-source-contract.test.mjs',

  'scripts/jahiz-travel-preference-flexibility-source-contract.test.mjs',

  'scripts/jahiz-trip-profile.test.ts',
];

const suites = {
  regression: regressionTests,

  'shadow-channel': [
    'scripts/jahiz-shadow-channel-e2e.test.mjs',
  ],
};

const suiteName =
  process.argv[2];

const tests =
  suites[suiteName];

if (!tests) {
  console.error(
    `Unknown active-test suite: ${suiteName ?? '<missing>'}`,
  );

  console.error(
    `Expected one of: ${Object.keys(suites).join(', ')}`,
  );

  process.exit(2);
}

const loaderUrl =
  pathToFileURL(
    path.resolve(
      'scripts',
      'jahiz-node-ts-resolver-loader.mjs',
    ),
  ).href;

const args = [
  '--experimental-strip-types',
  '--experimental-loader',
  loaderUrl,
  '--test',
  '--test-concurrency=1',
  ...tests,
];

console.log(
  `Running Jahiz active-test suite "${suiteName}" (${tests.length} file(s)).`,
);

const result =
  spawnSync(
    process.execPath,
    args,
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

if (result.error) {
  throw result.error;
}

process.exit(
  result.status ?? 1,
);
