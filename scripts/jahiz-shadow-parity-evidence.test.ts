import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyShadowParityEvidence,
  isShadowParityEvidencePrivacySafe,
  reduceShadowParityEvidence,
  summarizeShadowParityEvidence,
} from '../apps/mobile/src/features/sync/jahiz-shadow-parity-evidence.ts';

import {
  createShadowParityEvidenceStore,
} from '../apps/mobile/src/features/sync/jahiz-shadow-parity-evidence-store.ts';

import {
  evaluateShadowCutoverEvidence,
} from '../apps/mobile/src/features/sync/jahiz-shadow-cutover-policy.ts';

function event(
  outcome:
    | 'matched'
    | 'updated'
    | 'conflict'
    | 'bootstrap-divergence'
    | 'server-divergence'
    | 'unavailable'
    | 'invalid-response'
    | 'unauthorized',
  parity:
    | 'same'
    | 'different'
    | 'unknown',
) {
  return {
    outcome,
    parity,
    networkAction: 'update',
    serverRevision: 1,
    durationMs: 25,
  } as const;
}

test('evidence reducer tracks only aggregate parity and outcomes', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence =
    reduceShadowParityEvidence(
      evidence,
      event(
        'matched',
        'same',
      ),
      '2026-08-24T07:15:00.000Z',
    );

  evidence =
    reduceShadowParityEvidence(
      evidence,
      event(
        'conflict',
        'different',
      ),
      '2026-08-24T07:16:00.000Z',
    );

  assert.equal(
    evidence.observations,
    2,
  );
  assert.equal(
    evidence.paritySame,
    1,
  );
  assert.equal(
    evidence.parityDifferent,
    1,
  );
  assert.equal(
    evidence.conflicts,
    1,
  );
  assert.equal(
    evidence.outcomeCounts
      .matched,
    1,
  );
});

test('evidence payload remains privacy-safe', () => {
  const evidence =
    reduceShadowParityEvidence(
      createEmptyShadowParityEvidence(),
      event(
        'updated',
        'same',
      ),
      '2026-08-24T07:17:00.000Z',
    );

  assert.equal(
    isShadowParityEvidencePrivacySafe(
      evidence,
    ),
    true,
  );

  const serialized =
    JSON.stringify(evidence);

  for (const forbidden of [
    'workspace',
    'availableNow',
    'safetyReserve',
    'commitments',
    'destination',
  ]) {
    assert.equal(
      serialized.includes(
        forbidden,
      ),
      false,
    );
  }
});

test('evidence store serializes concurrent records without lost increments', async () => {
  let raw: string | null = null;

  const store =
    createShadowParityEvidenceStore(
      {
        async getItemAsync() {
          return raw;
        },
        async setItemAsync(
          _key,
          value,
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1,
              ),
          );

          raw = value;
        },
      },
      () =>
        '2026-08-24T07:18:00.000Z',
    );

  await Promise.all(
    Array.from(
      { length: 50 },
      () =>
        store.record(
          event(
            'updated',
            'same',
          ),
        ),
    ),
  );

  const evidence =
    await store.load();

  assert.equal(
    evidence.observations,
    50,
  );
  assert.equal(
    evidence.paritySame,
    50,
  );
});

test('session count persists independently from observations', async () => {
  let raw: string | null = null;

  const store =
    createShadowParityEvidenceStore({
      async getItemAsync() {
        return raw;
      },
      async setItemAsync(
        _key,
        value,
      ) {
        raw = value;
      },
    });

  await store.beginSession();
  await store.beginSession();

  const evidence =
    await store.load();

  assert.equal(
    evidence.sessions,
    2,
  );
  assert.equal(
    evidence.observations,
    0,
  );
});

test('cutover policy blocks insufficient evidence', () => {
  const evaluation =
    evaluateShadowCutoverEvidence(
      createEmptyShadowParityEvidence(),
    );

  assert.equal(
    evaluation.status,
    'blocked',
  );

  assert.ok(
    evaluation.reasons.includes(
      'insufficient-sessions',
    ),
  );

  assert.ok(
    evaluation.reasons.includes(
      'insufficient-observations',
    ),
  );
});

test('clean evidence becomes eligible for human review, never automatic cutover', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 3,
  };

  for (
    let index = 0;
    index < 25;
    index += 1
  ) {
    evidence =
      reduceShadowParityEvidence(
        evidence,
        event(
          'updated',
          'same',
        ),
        `2026-08-24T07:${String(
          20 + index,
        ).padStart(
          2,
          '0',
        )}:00.000Z`,
      );
  }

  const evaluation =
    evaluateShadowCutoverEvidence(
      evidence,
    );

  assert.equal(
    evaluation.status,
    'eligible-for-review',
  );

  assert.deepEqual(
    evaluation.reasons,
    [],
  );
});

test('any bootstrap or server divergence blocks review eligibility', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 3,
  };

  for (
    let index = 0;
    index < 25;
    index += 1
  ) {
    evidence =
      reduceShadowParityEvidence(
        evidence,
        event(
          'updated',
          'same',
        ),
        '2026-08-24T07:30:00.000Z',
      );
  }

  evidence =
    reduceShadowParityEvidence(
      evidence,
      event(
        'bootstrap-divergence',
        'different',
      ),
      '2026-08-24T07:31:00.000Z',
    );

  const evaluation =
    evaluateShadowCutoverEvidence(
      evidence,
    );

  assert.equal(
    evaluation.status,
    'blocked',
  );

  assert.ok(
    evaluation.reasons.includes(
      'bootstrap-divergence-observed',
    ),
  );
});

test('high conflict or outage rates block review eligibility', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 4,
  };

  for (
    let index = 0;
    index < 30;
    index += 1
  ) {
    const currentEvent =
      index < 3
        ? event(
            'unavailable',
            'unknown',
          )
        : index === 3
          ? event(
              'conflict',
              'different',
            )
          : event(
              'updated',
              'same',
            );

    evidence =
      reduceShadowParityEvidence(
        evidence,
        currentEvent,
        '2026-08-24T07:32:00.000Z',
      );
  }

  const evaluation =
    evaluateShadowCutoverEvidence(
      evidence,
    );

  assert.equal(
    evaluation.status,
    'blocked',
  );

  assert.ok(
    evaluation.reasons.includes(
      'conflict-rate-too-high',
    ),
  );

  assert.ok(
    evaluation.reasons.includes(
      'unavailable-rate-too-high',
    ),
  );
});

test('snapshot rates stay bounded and finite across synthetic evidence', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  for (
    let index = 0;
    index < 10_000;
    index += 1
  ) {
    evidence =
      reduceShadowParityEvidence(
        evidence,
        index % 3 === 0
          ? event(
              'updated',
              'same',
            )
          : index % 3 === 1
            ? event(
                'conflict',
                'different',
              )
            : event(
                'unavailable',
                'unknown',
              ),
        '2026-08-24T07:33:00.000Z',
      );
  }

  const snapshot =
    summarizeShadowParityEvidence(
      evidence,
    );

  for (const value of [
    snapshot.paritySameRate,
    snapshot.parityDifferentRate,
    snapshot.conflictRate,
    snapshot.unavailableRate,
  ]) {
    assert.ok(
      Number.isFinite(value),
    );

    assert.ok(
      value >= 0 &&
        value <= 1,
    );
  }
});
test('unknown parity observations do not dilute comparable parity success', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence =
    reduceShadowParityEvidence(
      evidence,
      event(
        'updated',
        'same',
      ),
      '2026-08-24T08:00:00.000Z',
    );

  for (
    let index = 0;
    index < 9;
    index += 1
  ) {
    evidence =
      reduceShadowParityEvidence(
        evidence,
        {
          outcome: 'skipped-unchanged',
          parity: 'unknown',
          networkAction: 'none',
          serverRevision: 1,
          durationMs: 0,
        },
        '2026-08-24T08:01:00.000Z',
      );
  }

  const snapshot =
    summarizeShadowParityEvidence(
      evidence,
    );

  assert.equal(
    snapshot.observations,
    10,
  );

  assert.equal(
    snapshot.parityComparisons,
    1,
  );

  assert.equal(
    snapshot.parityUnknown,
    9,
  );

  assert.equal(
    snapshot.paritySameRate,
    1,
  );
});

test('cutover requires enough comparable parity checks, not only total observations', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 3,
  };

  for (
    let index = 0;
    index < 24;
    index += 1
  ) {
    evidence =
      reduceShadowParityEvidence(
        evidence,
        {
          outcome: 'skipped-unchanged',
          parity: 'unknown',
          networkAction: 'none',
          serverRevision: 1,
          durationMs: 0,
        },
        '2026-08-24T08:02:00.000Z',
      );
  }

  evidence =
    reduceShadowParityEvidence(
      evidence,
      event(
        'updated',
        'same',
      ),
      '2026-08-24T08:03:00.000Z',
    );

  const evaluation =
    evaluateShadowCutoverEvidence(
      evidence,
    );

  assert.equal(
    evaluation.status,
    'blocked',
  );

  assert.ok(
    evaluation.reasons.includes(
      'insufficient-parity-comparisons',
    ),
  );

  assert.equal(
    evaluation.snapshot.paritySameRate,
    1,
  );
});
