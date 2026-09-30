import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCommitmentInstallmentStatusTransitionAllowed,
  type CommitmentInstallmentSequenceItem,
} from '../apps/mobile/src/features/trip-workspace/commitment-installment-sequence.ts';

function installment(
  number: number,
  status: 'paid' | 'unpaid',
): CommitmentInstallmentSequenceItem {
  return {
    id: `i-${number}`,
    status,
    installmentPlanId: 'plan-1',
    installmentNumber: number,
    installmentCount: 4,
  };
}

test(
  'installment payments can advance only from the first unpaid item',
  () => {
    const items = [
      installment(1, 'paid'),
      installment(2, 'unpaid'),
      installment(3, 'unpaid'),
      installment(4, 'unpaid'),
    ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-2',
        'paid',
      ),
      true,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-3',
        'paid',
      ),
      false,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-4',
        'paid',
      ),
      false,
    );
  },
);

test(
  'installment undo can move backward only from the latest paid item',
  () => {
    const items = [
      installment(1, 'paid'),
      installment(2, 'paid'),
      installment(3, 'paid'),
      installment(4, 'unpaid'),
    ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-3',
        'unpaid',
      ),
      true,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-2',
        'unpaid',
      ),
      false,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-1',
        'unpaid',
      ),
      false,
    );
  },
);

test(
  'valid installment states are always one contiguous paid prefix',
  () => {
    const paidTwo = [
      installment(1, 'paid'),
      installment(2, 'paid'),
      installment(3, 'unpaid'),
      installment(4, 'unpaid'),
    ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        paidTwo,
        'i-3',
        'paid',
      ),
      true,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        paidTwo,
        'i-4',
        'paid',
      ),
      false,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        paidTwo,
        'i-2',
        'unpaid',
      ),
      true,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        paidTwo,
        'i-1',
        'unpaid',
      ),
      false,
    );
  },
);

test(
  'reflection-only edits remain allowed without changing installment order',
  () => {
    const items = [
      installment(1, 'paid'),
      installment(2, 'paid'),
      installment(3, 'unpaid'),
      installment(4, 'unpaid'),
    ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-1',
        'paid',
      ),
      true,
    );

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        items,
        'i-2',
        'paid',
      ),
      true,
    );
  },
);

test(
  'one-time commitments remain independently reversible',
  () => {
    const regular: CommitmentInstallmentSequenceItem[] =
      [
        {
          id: 'regular-1',
          status: 'paid',
        },
      ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        regular,
        'regular-1',
        'unpaid',
      ),
      true,
    );
  },
);

test(
  'malformed installment metadata fails closed on status changes',
  () => {
    const malformed = [
      installment(1, 'paid'),
      installment(3, 'unpaid'),
      installment(4, 'unpaid'),
    ];

    assert.equal(
      isCommitmentInstallmentStatusTransitionAllowed(
        malformed,
        'i-3',
        'paid',
      ),
      false,
    );
  },
);
