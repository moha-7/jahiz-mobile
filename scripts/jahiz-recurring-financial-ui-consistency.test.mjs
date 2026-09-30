import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const screen =
  fs.readFileSync(
    'apps/mobile/src/features/create-trip/commitments-screen.tsx',
    'utf8',
  );

const i18n =
  fs.readFileSync(
    'packages/i18n/src/index.ts',
    'utf8',
  );

const metricsOverlay =
  fs.readFileSync(
    'apps/mobile/src/features/product-metrics/jahiz-product-metrics-diagnostics-overlay.tsx',
    'utf8',
  );

const shadowOverlay =
  fs.readFileSync(
    'apps/mobile/src/features/sync/jahiz-shadow-diagnostics-overlay.tsx',
    'utf8',
  );

test(
  'Commitments All unpaid uses recurring-aware trip-window truth',
  () => {
    assert.doesNotMatch(
      screen,
      /selectUnpaidCommitmentsTotal/,
    );

    assert.match(
      screen,
      /selectTripWindowUnpaidCommitmentsTotal/,
    );

    assert.match(
      screen,
      /formatMoney\(\s*unpaidTotal,/,
    );
  },
);

test(
  'monthly English preview uses the intended separator',
  () => {
    assert.match(
      i18n,
      /monthlyCommitmentTripPreview:\s*'\{count\} payments affect this trip · \{total\} through return'/,
    );

    assert.match(
      i18n,
      /monthlyCommitmentWindowImpact:\s*'\{count\} payments · \{total\} through return'/,
    );

    assert.doesNotMatch(
      i18n,
      /monthlyCommitment(?:TripPreview|WindowImpact):[^\n]* \? /,
    );
  },
);

test(
  'participant mode suppresses both diagnostics overlays',
  () => {
    for (
      const source
      of [
        metricsOverlay,
        shadowOverlay,
      ]
    ) {
      assert.match(
        source,
        /__DEV__\s*&&[\s\S]*?EXPO_PUBLIC_JAHIZ_PARTICIPANT_MODE[\s\S]*?!==[\s\S]*?'1'/,
      );
    }
  },
);
