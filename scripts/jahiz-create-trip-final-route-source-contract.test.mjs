import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const costsScreen =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/costs-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const paymentsScreen =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/payments/payments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const footerStart =
  costsScreen.indexOf(
    '<JzFlowFooter',
  );

const footerEnd =
  costsScreen.indexOf(
    '/>',
    footerStart,
  );

assert.ok(
  footerStart >= 0 &&
    footerEnd > footerStart,
  'Costs screen final flow footer must exist.',
);

const footer =
  costsScreen.slice(
    footerStart,
    footerEnd + 2,
  );

test(
  'final create-trip Continue sends uncovered bookings to Payments, otherwise Today',
  () => {
    assert.match(
      footer,
      /primaryLabel=\{t\('continue'\)\}/,
    );

    assert.match(
      footer,
      /onPrimaryPress=\{handleContinue\}/,
    );

    assert.match(
      costsScreen,
      /const bookingPaymentSetupNeeded = useMemo\(/,
    );

    assert.match(
      costsScreen,
      /payment\.status ===[\s\S]*?'paid'[\s\S]*?payment\.status ===[\s\S]*?'scheduled'/,
    );

    assert.match(
      costsScreen,
      /function handleContinue\(\)[\s\S]*?markCostsReviewed\(true\)[\s\S]*?bookingPaymentSetupNeeded[\s\S]*?'\/payments'[\s\S]*?'\/'/,
    );
  },
);

test(
  'Save and exit from final setup still returns to Plan',
  () => {
    assert.match(
      footer,
      /'saveAndExit'/,
    );

    assert.match(
      footer,
      /onSecondaryPress=\{[\s\S]*?handleSaveAndExit[\s\S]*?\}/,
    );

    assert.match(
      costsScreen,
      /function handleSaveAndExit\(\)[\s\S]*?router\.replace\('\/plan'\)/,
    );
  },
);

test(
  'Costs marks review and sends payment setup through an explicit route flag',
  () => {
    assert.match(
      costsScreen,
      /markCostsReviewed\(true\)[\s\S]*?pathname:\s*'\/payments'[\s\S]*?setup:\s*'1'[\s\S]*?: '\/'/,
    );
  },
);

test(
  'Payments offers an explicit Today handoff only in reviewed setup mode',
  () => {
    assert.match(
      paymentsScreen,
      /setup\?: string/,
    );

    assert.match(
      paymentsScreen,
      /params\.setup === '1' &&[\s\S]*?workspace\.costsReviewed === true/,
    );

    assert.match(
      paymentsScreen,
      /\{fromSetup \? \([\s\S]*?finishSetupToday[\s\S]*?router\.replace\('\/'\)/,
    );

    assert.match(
      paymentsScreen,
      /router\.setParams\(\{\s*setup:\s*'0'\s*\}\);[\s\S]*?router\.replace\('\/'\)/,
    );

    assert.doesNotMatch(
      paymentsScreen,
      /router\.replace\('\/plan'\)/,
    );
  },
);
