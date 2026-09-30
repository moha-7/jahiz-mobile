import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyShadowParityEvidence,
  reduceShadowParityEvidence,
} from '../apps/mobile/src/features/sync/jahiz-shadow-parity-evidence.ts';

import {
  buildShadowDiagnosticsViewModel,
} from '../apps/mobile/src/features/sync/jahiz-shadow-diagnostics-model.ts';

test('diagnostics shows disabled reason without changing authority', () => {
  const model =
    buildShadowDiagnosticsViewModel(
      {
        enabled: false,
        reason: 'flag-off',
      },
      createEmptyShadowParityEvidence(),
    );

  assert.equal(
    model.observeStatus,
    'disabled',
  );

  assert.equal(
    model.observeReason,
    'flag-off',
  );

  assert.equal(
    model.authority,
    'local',
  );
});

test('diagnostics maps aggregate evidence into percentages only', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 3,
  };

  evidence =
    reduceShadowParityEvidence(
      evidence,
      {
        outcome: 'updated',
        parity: 'same',
        networkAction: 'update',
        serverRevision: 1,
        durationMs: 20,
      },
      '2026-08-24T07:20:00.000Z',
    );

  evidence =
    reduceShadowParityEvidence(
      evidence,
      {
        outcome: 'unavailable',
        parity: 'unknown',
        networkAction: 'update',
        serverRevision: 1,
        durationMs: 40,
      },
      '2026-08-24T07:21:00.000Z',
    );

  const model =
    buildShadowDiagnosticsViewModel(
      {
        enabled: true,
        baseUrl:
          'http://192.168.1.10:4010',
        devOwnerId:
          'device-a',
      },
      evidence,
    );

  assert.equal(
    model.sessions,
    3,
  );

  assert.equal(
    model.observations,
    2,
  );

  assert.equal(
    model.parityComparisons,
    1,
  );

  assert.equal(
    model.parityUnknown,
    1,
  );

  assert.equal(
    model.paritySamePercent,
    100,
  );

  assert.equal(
    model.unavailablePercent,
    50,
  );

  assert.equal(
    model.authority,
    'local',
  );
});

test('diagnostics view model contains no raw workspace or money fields', () => {
  const model =
    buildShadowDiagnosticsViewModel(
      {
        enabled: true,
        baseUrl:
          'http://127.0.0.1:4010',
        devOwnerId:
          'device-a',
      },
      createEmptyShadowParityEvidence(),
    );

  const serialized =
    JSON.stringify(model);

  for (const forbidden of [
    'workspace',
    'availableNow',
    'safetyReserve',
    'costItems',
    'payments',
    'commitments',
    'moneyIn',
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

test('review eligibility stays a human-review state', () => {
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
        {
          outcome: 'updated',
          parity: 'same',
          networkAction: 'update',
          serverRevision: index + 1,
          durationMs: 15,
        },
        '2026-08-24T07:22:00.000Z',
      );
  }

  const model =
    buildShadowDiagnosticsViewModel(
      {
        enabled: true,
        baseUrl:
          'http://127.0.0.1:4010',
        devOwnerId:
          'device-a',
      },
      evidence,
    );

  assert.equal(
    model.reviewStatus,
    'eligible-for-review',
  );

  assert.deepEqual(
    model.blockers,
    [],
  );

  assert.equal(
    model.authority,
    'local',
  );
});
test('diagnostics separates parity checks from unknown observations', () => {
  let evidence =
    createEmptyShadowParityEvidence();

  evidence = {
    ...evidence,
    sessions: 3,
  };

  evidence =
    reduceShadowParityEvidence(
      evidence,
      {
        outcome: 'updated',
        parity: 'same',
        networkAction: 'update',
        serverRevision: 2,
        durationMs: 20,
      },
      '2026-08-24T08:10:00.000Z',
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
          serverRevision: 2,
          durationMs: 0,
        },
        '2026-08-24T08:11:00.000Z',
      );
  }

  const model =
    buildShadowDiagnosticsViewModel(
      {
        enabled: true,
        baseUrl:
          'http://127.0.0.1:4010',
        devOwnerId:
          'device-a',
      },
      evidence,
    );

  assert.equal(
    model.observations,
    10,
  );

  assert.equal(
    model.parityComparisons,
    1,
  );

  assert.equal(
    model.parityUnknown,
    9,
  );

  assert.equal(
    model.paritySamePercent,
    100,
  );

  assert.ok(
    model.blockers.includes(
      'insufficient-parity-comparisons',
    ),
  );
});
