import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(...parts) {
  return fs.readFileSync(
    path.join(root, ...parts),
    'utf8',
  );
}

const plan = read(
  'apps',
  'mobile',
  'src',
  'features',
  'plan',
  'plan-screen.tsx',
);

const i18n = read(
  'packages',
  'i18n',
  'src',
  'index.ts',
);

const selectors = read(
  'apps',
  'mobile',
  'src',
  'features',
  'trip-workspace',
  'trip-workspace-selectors.ts',
);

const installmentCard = read(
  'apps',
  'mobile',
  'src',
  'features',
  'create-trip',
  'commitment-installment-plan-card.tsx',
);

test('Plan Money uses the reconciled Ready Money breakdown instead of a generic expected total', () => {
  assert.match(
    plan,
    /selectReadyMoneyBreakdown/,
  );
  assert.doesNotMatch(
    plan,
    /selectExpectedByReturnMoneyInTotal/,
  );
  assert.doesNotMatch(
    plan,
    /selectExpectedBeforeTravelMoneyInTotal/,
  );
});

test('Plan Commitments uses the through-return total', () => {
  assert.match(
    plan,
    /selectTripWindowCommitmentsTotal/,
  );
  assert.doesNotMatch(
    plan,
    /selectBeforeTravelCommitmentsTotal/,
  );
});

test('Plan next commitment uses the grouped current trip-window truth', () => {
  assert.match(
    plan,
    /selectNextTripWindowCommitmentGroup/,
  );
  assert.match(
    plan,
    /nextCommitmentGroup[\s\S]*?totalAmount/,
  );
  assert.doesNotMatch(
    plan,
    /selectNextCommitment\(/,
  );
});

test('Plan Money summary states the Ready Money formula without changing commitment pluralization', () => {
  assert.match(
    i18n,
    /readyMoneyFormulaShort: 'Usable through return − reserve − commitments'/,
  );
  assert.match(
    i18n,
    /planCommitmentsSummary: '\{count\} \[\[plural:count\|obligation\|obligations\]\]'/,
  );
  assert.match(
    i18n,
    /planCommitmentsDetail: 'Review obligations and installment schedules that affect readiness through the return date\.'/,
  );
});

test('Money truth helper no longer says expected before travel', () => {
  assert.match(
    i18n,
    /moneyInTruthHelper: 'Ready Money uses only sources you chose to include that are available now or expected by the return date\.'/,
  );
  assert.doesNotMatch(
    i18n,
    /moneyInTruthHelper: 'Ready Money uses only sources you chose to include and that are available now or expected before travel\.'/,
  );
});

test('narrow pre-travel domain labels remain intentionally narrow', () => {
  assert.match(
    i18n,
    /expectedBeforeTravel: 'Expected before travel'/,
  );
  assert.match(
    i18n,
    /commitmentsBeforeTravel: 'Due before travel'/,
  );
  assert.match(
    installmentCard,
    /plan\.dueBeforeTravelAmount/,
  );
  assert.match(
    installmentCard,
    /t\('commitmentsBeforeTravel'\)/,
  );
});

test('trip-window selectors remain the source of truth', () => {
  assert.match(
    selectors,
    /export function selectExpectedByReturnMoneyInTotal\(/,
  );
  assert.match(
    selectors,
    /export function selectTripWindowCommitmentsTotal\(/,
  );
  assert.match(
    selectors,
    /export function selectNextTripWindowCommitmentGroup\(/,
  );
});
