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

const selectors = read(
  'apps',
  'mobile',
  'src',
  'features',
  'trip-workspace',
  'trip-workspace-selectors.ts',
);

const funds = read(
  'apps',
  'mobile',
  'src',
  'features',
  'create-trip',
  'funds-screen.tsx',
);

const commitments = read(
  'apps',
  'mobile',
  'src',
  'features',
  'create-trip',
  'commitments-screen.tsx',
);

const installmentCard = read(
  'apps',
  'mobile',
  'src',
  'features',
  'create-trip',
  'commitment-installment-plan-card.tsx',
);

const installmentModal = read(
  'apps',
  'mobile',
  'src',
  'features',
  'create-trip',
  'commitment-installment-modal.tsx',
);

const i18n = read(
  'packages',
  'i18n',
  'src',
  'index.ts',
);

test('Money summary uses Expected by return instead of the pre-travel selector', () => {
  assert.match(
    selectors,
    /export function selectExpectedByReturnMoneyInTotal\(/,
  );
  assert.match(
    selectors,
    /event\.dateConfidence !== 'on-hand'[\s\S]*?event\.timing === 'before-trip'[\s\S]*?event\.timing === 'during-trip'/,
  );
  assert.match(
    funds,
    /selectExpectedByReturnMoneyInTotal/,
  );
  assert.match(
    funds,
    /t\('expectedByReturn'\)/,
  );
  assert.doesNotMatch(
    funds,
    /selectExpectedBeforeTravelMoneyInTotal/,
  );
});

test('Ready Money financial truth remains the M7F.4A.2.2 trip-window formula', () => {
  assert.match(
    selectors,
    /summary\.inflowBeforeTrip[\s\S]*?summary\.inflowDuringTrip/,
  );
  assert.match(
    selectors,
    /selectReadyMoney[\s\S]*?selectTripWindowCommitmentsTotal\(workspace\)/,
  );
});

test('commitments classify exact dates into before, during and other buckets', () => {
  assert.match(
    selectors,
    /export function isCommitmentDueDuringTrip\([\s\S]*?item\.dueDate >[\s\S]*?departureDate[\s\S]*?item\.dueDate <=[\s\S]*?returnDate/,
  );
  assert.match(
    commitments,
    /const beforeTravelItems = useMemo\(/,
  );
  assert.match(
    commitments,
    /const duringTripItems = useMemo\(/,
  );
  assert.match(
    commitments,
    /const otherItems = useMemo\(/,
  );
  assert.match(
    commitments,
    /t\('commitmentsDuringTrip'\)/,
  );
});

test('commitments headline metric and next item use the whole trip window', () => {
  assert.match(
    commitments,
    /selectTripWindowCommitmentsTotal/,
  );
  assert.match(
    commitments,
    /selectNextTripWindowCommitment/,
  );
  assert.match(
    commitments,
    /t\('commitmentsReadyMoneyDeduction'\)/,
  );
});

test('unpaid commitments require an exact due date before review completes', () => {
  assert.match(
    commitments,
    /workspace\.commitments\.every\([\s\S]*?item\.status === 'paid' \|\|[\s\S]*?Boolean\(item\.dueDate\)/,
  );
});

test('copy describes through-return readiness in both locales', () => {
  for (const key of [
    'expectedByReturn',
    'commitmentsThroughReturn',
    'commitmentsDuringTrip',
    'dueDuringTrip',
  ]) {
    const count = (
      i18n.match(
        new RegExp(
          '^\\s*' + key + ':',
          'gm',
        ),
      ) ?? []
    ).length;
    assert.equal(
      count,
      2,
      key + ' must exist once in EN and once in AR',
    );
  }

  assert.match(
    i18n,
    /moneyInReadySummaryHelper: 'Money included for this trip, after reserve and commitments through return\.'/,
  );
  assert.match(
    i18n,
    /commitmentsFundsSummary: '\{count\} \[\[plural:count\|item\|items\]\] · \{amount\} due through return'/,
  );
});

test('installment pre-travel metric remains narrow and is not falsely relabeled', () => {
  assert.match(
    selectors,
    /dueBeforeTravelAmount/,
  );
  assert.match(
    installmentCard,
    /dueBeforeTravelAmount/,
  );
  assert.doesNotMatch(
    installmentCard,
    /commitmentsThroughReturn/,
  );
});


test('monthly salary UI cannot stay in Available now mode', () => {
  assert.match(
    funds,
    /function selectMonthlySalary\([\s\S]*?repeatsMonthly: true,[\s\S]*?availability: 'expected'/,
  );

  assert.match(
    funds,
    /\{!recurringSalary \? \([\s\S]*?t\('moneyInAvailability'\)/,
  );

  assert.match(
    selectors,
    /selectAvailableNowMoneyInTotal[\s\S]*?item\.availability ===[\s\S]*?'available-now'[\s\S]*?!item\.recurrence/,
  );

  assert.match(
    funds,
    /availability: recurringSalary[\s\S]*?'expected'[\s\S]*?: item\.availability/,
  );

  assert.match(
    funds,
    /const displayAvailability =[\s\S]*?recurringSalary[\s\S]*?'expected'[\s\S]*?: item\.availability/,
  );

  assert.match(
    funds,
    /const timingLabel = recurringSalary[\s\S]*?moneyInExpectedOption/,
  );
});

test('Ready Money amount label never claims the trip itself is ready', () => {
  assert.match(
    i18n,
    /moneyInReadySummary: 'Ready Money'/,
  );
  assert.doesNotMatch(
    i18n,
    /moneyInReadySummary: 'Ready for the trip'/,
  );

  const summaryLabelCount = (
    i18n.match(
      /^\s*moneyInReadySummary:/gm,
    ) ?? []
  ).length;

  assert.equal(
    summaryLabelCount,
    2,
    'Ready Money summary label must exist in EN and AR',
  );
});

test('salary copy separates future payday schedule from cash already on hand', () => {
  assert.match(
    i18n,
    /Monthly salary is treated as future income starting from the next payday\./,
  );

  assert.match(
    i18n,
    /Money already in your account should be added separately as Available now\./,
  );

  assert.match(
    i18n,
    /الراتب الشهري بيتعامل كدخل جاي/,
  );

  assert.match(
    i18n,
    /أي فلوس موجودة في حسابك دلوقتي ضيفها لوحدها كفلوس متاحة دلوقتي/,
  );
});

test(
  'installment preview uses canonical before during after trip timing',
  () => {
    assert.match(
      installmentModal,
      /classifyTripDateTiming/,
    );

    assert.match(
      commitments,
      /<CommitmentInstallmentModal[\s\S]*?returnDate=\{[\s\S]*?workspace\.dates\.returnDate/,
    );

    assert.match(
      installmentModal,
      /timing ===[\s\S]*?'before-trip'[\s\S]*?'beforeTravelShort'/,
    );

    assert.match(
      installmentModal,
      /timing ===[\s\S]*?'during-trip'[\s\S]*?'duringTravelShort'/,
    );

    assert.match(
      installmentModal,
      /timing ===[\s\S]*?'after-trip'[\s\S]*?'afterTravelShort'/,
    );

    assert.doesNotMatch(
      installmentModal,
      /const beforeTravel =[\s\S]*?scheduleItem\.dueDate <=[\s\S]*?departureDate/,
    );

    const duringLabelCount = (
      i18n.match(
        /^\s*duringTravelShort:/gm,
      ) ?? []
    ).length;

    assert.equal(
      duringLabelCount,
      2,
      'During trip label must exist once in EN and once in AR.',
    );
  },
);
