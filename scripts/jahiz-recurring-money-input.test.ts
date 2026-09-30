import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseRecurringCommitmentAmount,
} from '../apps/mobile/src/features/create-trip/commitment-recurring-money.ts';

test(
  'monthly commitment parses plain integer amount',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '2500',
      ),
      2500,
    );
  },
);

test(
  'monthly commitment parses decimal amount',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '2500.50',
      ),
      2500.5,
    );
  },
);

test(
  'monthly commitment accepts common grouping comma',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '2,500',
      ),
      2500,
    );
  },
);

test(
  'monthly commitment accepts comma decimal input',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '2500,50',
      ),
      2500.5,
    );
  },
);

test(
  'monthly commitment accepts Arabic-Indic digits',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '\u0662\u0665\u0660\u0660',
      ),
      2500,
    );
  },
);

test(
  'monthly commitment accepts Eastern Arabic digits',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '\u06F2\u06F5\u06F0\u06F0',
      ),
      2500,
    );
  },
);

test(
  'monthly commitment accepts Arabic grouped decimal money',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '\u0662\u066C\u0665\u0660\u0660\u066B\u0665\u0660',
      ),
      2500.5,
    );
  },
);

test(
  'monthly commitment rejects zero negative and malformed values',
  () => {
    assert.equal(
      parseRecurringCommitmentAmount(
        '0',
      ),
      null,
    );

    assert.equal(
      parseRecurringCommitmentAmount(
        '-2500',
      ),
      null,
    );

    assert.equal(
      parseRecurringCommitmentAmount(
        'abc',
      ),
      null,
    );

    assert.equal(
      parseRecurringCommitmentAmount(
        '',
      ),
      null,
    );
  },
);
