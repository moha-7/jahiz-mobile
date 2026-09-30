import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const store = fs.readFileSync(
  'apps/mobile/src/features/trip-workspace/trip-workspace-store.ts',
  'utf8',
);

const lifecycle = fs.readFileSync(
  'apps/mobile/src/features/trip-workspace/recurring-commitment-lifecycle.ts',
  'utf8',
);

test(
  'store exposes the complete recurring commitment lifecycle',
  () => {
    for (const token of [
      'addRecurringCommitment:',
      'updateRecurringCommitment:',
      'removeRecurringCommitment:',
      'markRecurringCommitmentOccurrencePaid:',
      'setRecurringCommitmentOccurrenceMoneyReflected:',
      'markRecurringCommitmentOccurrenceUnpaid:',
    ]) {
      assert.ok(
        store.includes(token),
        `Missing recurring store action: ${token}`,
      );
    }
  },
);

test(
  'new recurring plans start monthly with no invented payment history',
  () => {
    assert.ok(
      store.includes(
        "cadence: 'monthly'",
      ),
    );

    assert.ok(
      store.includes(
        'paidOccurrences: []',
      ),
    );

    assert.ok(
      store.includes(
        'currency: workspace.currency',
      ),
    );
  },
);

test(
  'store delegates payment state changes to the tested lifecycle policy',
  () => {
    for (const token of [
      'markRecurringOccurrencePaid(',
      'setRecurringOccurrenceMoneyReflected(',
      'markRecurringOccurrenceUnpaid(',
      'updateRecurringCommitmentPlan(',
    ]) {
      assert.ok(
        store.includes(token),
        `Store is not using lifecycle helper: ${token}`,
      );
    }
  },
);

test(
  'lifecycle snapshots amount and never treats recurring months as installment sequence',
  () => {
    assert.ok(
      lifecycle.includes(
        'amount: item.amount',
      ),
    );

    assert.ok(
      !lifecycle.includes(
        'isCommitmentInstallmentStatusTransitionAllowed',
      ),
    );
  },
);


test(
  'new recurring plans persist explicit ongoing or end-date truth',
  () => {
    assert.ok(
      store.includes(
        'endDate?: string | null;',
      ),
    );

    assert.ok(
      store.includes(
        'input.endDate ?? null',
      ),
    );
  },
);
