import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const commitmentsScreen =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/commitments-screen.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const workspaceStore =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/trip-workspace/trip-workspace-store.ts',
      import.meta.url,
    ),
    'utf8',
  );

const installmentSequence =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/trip-workspace/commitment-installment-sequence.ts',
      import.meta.url,
    ),
    'utf8',
  );

const installmentPlanCard =
  fs.readFileSync(
    new URL(
      '../apps/mobile/src/features/create-trip/commitment-installment-plan-card.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const i18n =
  fs.readFileSync(
    new URL(
      '../packages/i18n/src/index.ts',
      import.meta.url,
    ),
    'utf8',
  );
test(
  'new commitments are always created unpaid',
  () => {
    assert.match(
      commitmentsScreen,
      /const effectiveStatus:[\s\S]*?item[\s\S]*?\?[\s\S]*?draft\.status[\s\S]*?:\s*'unpaid'/,
    );

    assert.match(
      commitmentsScreen,
      /status:\s*effectiveStatus/,
    );
  },
);

test(
  'paid-unpaid status control is edit-only',
  () => {
    const statusLabelIndex =
      commitmentsScreen.indexOf(
        "{t('commitmentStatus')}",
      );

    assert.ok(
      statusLabelIndex >= 0,
    );

    const preceding =
      commitmentsScreen.slice(
        Math.max(
          0,
          statusLabelIndex - 500,
        ),
        statusLabelIndex,
      );

    assert.match(
      preceding,
      /\{item\s*\?\s*\(/,
    );
  },
);

test(
  'new unpaid commitments still require a due date',
  () => {
    assert.match(
      commitmentsScreen,
      /const requiresDueDate\s*=\s*effectiveStatus\s*===\s*'unpaid'/,
    );

    assert.match(
      commitmentsScreen,
      /!requiresDueDate\s*\|\|\s*draft\.dueDate/,
    );
  },
);

test(
  'paid commitment reflection resets when its amount changes',
  () => {
    assert.match(
      workspaceStore,
      /const paidAmountChanged =[\s\S]*?input\.amount !== undefined[\s\S]*?input\.amount !== item\.amount/,
    );

    assert.match(
      workspaceStore,
      /item\.status === 'paid' &&[\s\S]*?!paidAmountChanged[\s\S]*?item\.paidAmountReflectedInMoney === true/,
    );

    assert.match(
      workspaceStore,
      /status: input\.status \?\? 'unpaid',[\s\S]*?paidAmountReflectedInMoney: false/,
    );
  },
);


test(
  'marking paid defaults conservatively without forcing a Money decision',
  () => {
    assert.match(
      commitmentsScreen,
      /function markPaidConservatively[\s\S]*?status: 'paid'[\s\S]*?paidAmountReflectedInMoney: false/,
    );

    assert.match(
      commitmentsScreen,
      /onMarkPaid=\{[\s\S]*?markPaidConservatively[\s\S]*?\}/,
    );

    assert.match(
      installmentPlanCard,
      /onMarkPaid\(item\)/,
    );

    assert.doesNotMatch(
      commitmentsScreen,
      /effectiveStatus !== 'paid'[\s\S]*?paidAmountReflectedInMoney !==[\s\S]*?null/,
    );

    assert.doesNotMatch(
      commitmentsScreen,
      /onMarkPaid=\{requestMarkPaid\}/,
    );
  },
);


test(
  'paid status and Money-impact review are separate user actions',
  () => {
    assert.match(
      commitmentsScreen,
      /function reviewPaidImpact/,
    );

    assert.match(
      commitmentsScreen,
      /commitmentPaidImpactAction/,
    );

    assert.match(
      commitmentsScreen,
      /commitmentsReadyMoneyBreakdown/,
    );

    assert.match(
      installmentPlanCard,
      /onReviewPaidImpact\(item\)/,
    );

    assert.match(
      commitmentsScreen,
      /commitmentPaidStillDeductedShort/,
    );

    assert.match(
      installmentPlanCard,
      /commitmentPaidStillDeductedShort/,
    );

    const sheetStart =
      commitmentsScreen.indexOf(
        'paidReflectionTarget !== null',
      );

    const sheetEnd =
      commitmentsScreen.indexOf(
        '<CommitmentEditorModal',
        sheetStart,
      );

    assert.ok(sheetStart >= 0);
    assert.ok(sheetEnd > sheetStart);

    const reviewSheet =
      commitmentsScreen.slice(
        sheetStart,
        sheetEnd,
      );

    assert.doesNotMatch(
      reviewSheet,
      /tone:\s*'success'/,
    );

    for (const key of [
      'commitmentPaidImpactAction',
      'commitmentsReadyMoneyBreakdown',
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
        key + ' must exist once in EN and once in AR.',
      );
    }
  },
);


test(
  'legacy paid commitment stays conservative without blocking normal edits',
  () => {
    assert.match(
      commitmentsScreen,
      /item\.paidAmountReflectedInMoney ===[\s\S]*?undefined[\s\S]*?\? null[\s\S]*?: item[\s\S]*?\.paidAmountReflectedInMoney/,
    );

    assert.match(
      commitmentsScreen,
      /effectiveStatus === 'paid'[\s\S]*?\? draft\.paidAmountReflectedInMoney ===[\s\S]*?true[\s\S]*?: false/,
    );

    assert.doesNotMatch(
      commitmentsScreen,
      /effectiveStatus !== 'paid'[\s\S]*?paidAmountReflectedInMoney !==[\s\S]*?null/,
    );
  },
);


test(
  'paid impact review supports explicit unpaid recovery and locale-owned amount order',
  () => {
    assert.match(
      commitmentsScreen,
      /key: 'mark-unpaid'[\s\S]*?status:\s*'unpaid'[\s\S]*?paidAmountReflectedInMoney:\s*false/,
    );

    assert.match(
      commitmentsScreen,
      /paidReflectionTarget\.amount[\s\S]*?toLocaleString[\s\S]*?currency:[\s\S]*?workspace\.currency/,
    );

    assert.equal(
      (
        i18n.match(
          /^\s*commitmentPaidUndoPayment:/gm,
        ) ?? []
      ).length,
      2,
    );

    assert.match(
      i18n,
      /commitmentPaidMoneyQuestion: 'Has this \{amount\} \{currency\} payment already been reflected in your current Money\?'/,
    );

    assert.match(
      i18n,
      /commitmentPaidKeepDeducted: 'Not yet .* keep \{amount\} \{currency\} counted'/,
    );

    assert.match(
      i18n,
      /commitmentPaidMoneyUpdated: 'Yes .* stop counting \{amount\} \{currency\}'/,
    );
  },
);

test(
  'installment paid state is a sequential domain invariant shared by UI',
  () => {
    assert.match(
      installmentSequence,
      /let sawUnpaid = false;[\s\S]*?if \(sawUnpaid\)[\s\S]*?return false/,
    );

    assert.match(
      workspaceStore,
      /isCommitmentInstallmentStatusTransitionAllowed\([\s\S]*?state\.workspace\.commitments[\s\S]*?requestedStatus[\s\S]*?return state/,
    );

    assert.match(
      installmentPlanCard,
      /const canMarkPaid =[\s\S]*?isCommitmentInstallmentStatusTransitionAllowed\([\s\S]*?disabled=\{!canMarkPaid\}/,
    );

    assert.match(
      commitmentsScreen,
      /isCommitmentInstallmentStatusTransitionAllowed\([\s\S]*?paidReflectionTarget\.id[\s\S]*?'unpaid'[\s\S]*?key: 'mark-unpaid'/,
    );
  },
);

test(
  'paid commitment bilingual copy preserves exact Unicode text',
  () => {
    const expected = [
      'Paid \u00B7 still counted',
      'Paid \u2713',
      'Not yet \u2014 keep {amount} {currency} counted',
      'Yes \u2014 stop counting {amount} {currency}',
      "I didn't pay this \u2014 mark as unpaid",
      '\u0647\u0644 \u062A\u0639\u0643\u0633 \u0623\u0645\u0648\u0627\u0644\u0643 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u062F\u0641\u0639\u0629 {amount} {currency} \u0628\u0627\u0644\u0641\u0639\u0644\u061F',
      '\u0644\u064A\u0633 \u0628\u0639\u062F \u2014 \u0623\u0628\u0642\u0650 {amount} {currency} \u0645\u062D\u0633\u0648\u0628\u0629',
      '\u0646\u0639\u0645 \u2014 \u0623\u0648\u0642\u0641 \u0627\u062D\u062A\u0633\u0627\u0628 {amount} {currency}',
      '\u0644\u0645 \u0623\u062F\u0641\u0639 \u0647\u0630\u0647 \u0627\u0644\u062F\u0641\u0639\u0629 \u2014 \u0623\u0639\u062F\u0647\u0627 \u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639\u0629',
      '\u0645\u062F\u0641\u0648\u0639 \u00B7 \u0645\u0627 \u0632\u0627\u0644 \u0645\u062D\u0633\u0648\u0628\u064B\u0627',
      '\u0645\u062F\u0641\u0648\u0639 \u2713',
      '\u0645\u0631\u0627\u062C\u0639\u0629 \u062A\u0623\u062B\u064A\u0631 \u0627\u0644\u062F\u0641\u0639\u0629',
    ];

    for (const value of expected) {
      assert.equal(
        i18n.includes(value),
        true,
        'Missing or corrupted paid UX copy: ' + value,
      );
    }

    assert.equal(
      i18n.includes(
        "commitmentPaidStillDeductedShort: 'Paid ? still counted'",
      ),
      false,
    );
  },
);
