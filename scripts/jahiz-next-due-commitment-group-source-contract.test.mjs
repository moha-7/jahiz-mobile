import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const commitments =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/commitments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'Next due headlines the exact next item while preserving same-day group context',
  () => {
    assert.match(
      commitments,
      /selectNextTripWindowCommitmentGroup/,
    );

    assert.match(
      commitments,
      /const nextCommitment =[\s\S]*?nextCommitmentGroup\?\.items\[0\]/,
    );

    assert.match(
      commitments,
      /\{nextCommitment\.title\}/,
    );

    assert.match(
      commitments,
      /formatMoney\([\s\S]*?nextCommitment\.amount/,
    );

    assert.match(
      commitments,
      /nextCommitmentGroup\.itemCount > 1[\s\S]*?nextCommitmentGroupTitle[\s\S]*?nextCommitmentGroup[\s\S]*?totalAmount/,
    );
  },
);
