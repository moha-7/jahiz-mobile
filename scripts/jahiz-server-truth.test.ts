import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyServerTripLifecycleTransition,
  applyServerTripUpdate,
  createServerTripEnvelope,
  serverTripEnvelopeSchema,
  serverTripListResponseSchema,
  serverTripMutationResultSchema,
  serverTripUpdateRequestSchema,
  tripWorkspaceSchema,
} from '../packages/api-contracts/src/index.ts';

function workspace(
  id = 'trip-server-truth-1',
) {
  return tripWorkspaceSchema.parse({
    id,
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    profile: {
      travelStyle: 'smart',
      travelStyleConfirmed: true,
      purpose: 'leisure',
      travelers: {
        adults: 1,
        children: 0,
      },
    },
    funds: {
      availableNow: 5000,
      expectedBeforeTravel: 0,
      safetyReserve: 1000,
      originCommitments: 0,
    },
    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],
    createdAt: '2026-08-24T05:00:00.000Z',
    updatedAt: '2026-08-24T05:00:00.000Z',
  });
}

test('server envelope starts at revision zero', () => {
  const trip = createServerTripEnvelope({
    ownerId: 'user-1',
    workspace: workspace(),
    serverUpdatedAt:
      '2026-08-24T05:01:00.000Z',
  });

  assert.equal(trip.revision, 0);
  assert.equal(
    trip.tripId,
    'trip-server-truth-1',
  );
});

test('server trip list response accepts account-scoped canonical envelopes', () => {
  const one =
    createServerTripEnvelope({
      ownerId: 'user-list-1',
      workspace:
        workspace('trip-list-a'),
      serverUpdatedAt:
        '2026-08-24T05:01:00.000Z',
    });

  const two =
    createServerTripEnvelope({
      ownerId: 'user-list-1',
      workspace:
        workspace('trip-list-b'),
      serverUpdatedAt:
        '2026-08-24T05:02:00.000Z',
    });

  const parsed =
    serverTripListResponseSchema.parse({
      data: [
        two,
        one,
      ],
    });

  assert.equal(
    parsed.data.length,
    2,
  );

  assert.deepEqual(
    parsed.data.map(
      (trip) => trip.tripId,
    ),
    [
      'trip-list-b',
      'trip-list-a',
    ],
  );
});

test('server trip list response rejects malformed trip envelopes', () => {
  assert.equal(
    serverTripListResponseSchema.safeParse({
      data: [
        {
          tripId: 'broken',
        },
      ],
    }).success,
    false,
  );
});

test('matching expected revision applies exactly once', () => {
  const current =
    createServerTripEnvelope({
      ownerId: 'user-1',
      workspace: workspace(),
      serverUpdatedAt:
        '2026-08-24T05:01:00.000Z',
    });

  const changed = workspace();
  changed.funds.availableNow = 6200;

  const result = applyServerTripUpdate(
    current,
    {
      clientMutationId:
        'mutation-0001',
      expectedRevision: 0,
      workspace: changed,
    },
    '2026-08-24T05:02:00.000Z',
  );

  assert.equal(result.status, 'applied');

  if (result.status !== 'applied') {
    return;
  }

  assert.equal(result.trip.revision, 1);
  assert.equal(
    result.trip.workspace.funds
      .availableNow,
    6200,
  );
});

test('stale expected revision returns the canonical server trip', () => {
  const current =
    createServerTripEnvelope({
      ownerId: 'user-1',
      workspace: workspace(),
      serverUpdatedAt:
        '2026-08-24T05:01:00.000Z',
    });

  const first = applyServerTripUpdate(
    current,
    {
      clientMutationId:
        'mutation-0002',
      expectedRevision: 0,
      workspace: workspace(),
    },
    '2026-08-24T05:02:00.000Z',
  );

  assert.equal(first.status, 'applied');

  if (first.status !== 'applied') {
    return;
  }

  const stale = applyServerTripUpdate(
    first.trip,
    {
      clientMutationId:
        'mutation-0003',
      expectedRevision: 0,
      workspace: workspace(),
    },
    '2026-08-24T05:03:00.000Z',
  );

  assert.equal(stale.status, 'conflict');

  if (stale.status !== 'conflict') {
    return;
  }

  assert.equal(
    stale.trip.revision,
    1,
  );
  assert.equal(
    stale.expectedRevision,
    0,
  );
});

test('server update never mutates the current envelope or request workspace', () => {
  const current =
    createServerTripEnvelope({
      ownerId: 'user-1',
      workspace: workspace(),
      serverUpdatedAt:
        '2026-08-24T05:01:00.000Z',
    });

  const requestWorkspace = workspace();
  const beforeCurrent =
    JSON.stringify(current);
  const beforeRequest =
    JSON.stringify(requestWorkspace);

  applyServerTripUpdate(
    current,
    {
      clientMutationId:
        'mutation-0004',
      expectedRevision: 0,
      workspace: requestWorkspace,
    },
    '2026-08-24T05:02:00.000Z',
  );

  assert.equal(
    JSON.stringify(current),
    beforeCurrent,
  );
  assert.equal(
    JSON.stringify(requestWorkspace),
    beforeRequest,
  );
});

test('negative revisions fail closed', () => {
  assert.equal(
    serverTripUpdateRequestSchema.safeParse({
      clientMutationId:
        'mutation-0005',
      expectedRevision: -1,
      workspace: workspace(),
    }).success,
    false,
  );
});

test('short mutation ids fail closed', () => {
  assert.equal(
    serverTripUpdateRequestSchema.safeParse({
      clientMutationId: 'short',
      expectedRevision: 0,
      workspace: workspace(),
    }).success,
    false,
  );
});

test('server result schema rejects an impossible status', () => {
  assert.equal(
    serverTripMutationResultSchema.safeParse({
      status: 'overwritten',
    }).success,
    false,
  );
});

test('server envelope keeps the owner outside client-controlled workspace data', () => {
  const trip =
    createServerTripEnvelope({
      ownerId: 'user-77',
      workspace: workspace(),
      serverUpdatedAt:
        '2026-08-24T05:01:00.000Z',
    });

  const parsed =
    serverTripEnvelopeSchema.parse(trip);

  assert.equal(
    parsed.ownerId,
    'user-77',
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      parsed.workspace,
      'ownerId',
    ),
    false,
  );
});

test('revision remains finite across 10,000 sequential updates', () => {
  let current =
    createServerTripEnvelope({
      ownerId: 'stress-user',
      workspace: workspace('stress-trip'),
      serverUpdatedAt:
        '2026-08-24T05:00:00.000Z',
    });

  for (
    let index = 0;
    index < 10_000;
    index += 1
  ) {
    const result = applyServerTripUpdate(
      current,
      {
        clientMutationId:
          `stress-mutation-${String(index).padStart(5, '0')}`,
        expectedRevision:
          current.revision,
        workspace:
          current.workspace,
      },
      '2026-08-24T05:00:00.000Z',
    );

    assert.equal(
      result.status,
      'applied',
    );

    if (result.status !== 'applied') {
      throw new Error(
        'Unexpected conflict in sequential stress test.',
      );
    }

    current = result.trip;
  }

  assert.equal(
    current.revision,
    10_000,
  );
  assert.ok(
    Number.isFinite(current.revision),
  );
});

test(
  'new server trips default to active lifecycle',
  () => {
    const trip =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-1',
        workspace:
          workspace(
            'lifecycle-default',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    assert.deepEqual(
      trip.lifecycle,
      {
        status: 'active',
        archivedAt: null,
      },
    );
  },
);

test(
  'archived lifecycle requires an archived timestamp',
  () => {
    const trip =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-2',
        workspace:
          workspace(
            'lifecycle-invalid',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    assert.equal(
      serverTripEnvelopeSchema
        .safeParse({
          ...trip,
          lifecycle: {
            status:
              'archived',
            archivedAt:
              null,
          },
        })
        .success,
      false,
    );
  },
);

test(
  'archive transition increments revision and preserves workspace',
  () => {
    const current =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-3',
        workspace:
          workspace(
            'lifecycle-archive',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    const result =
      applyServerTripLifecycleTransition(
        current,
        {
          clientMutationId:
            'lifecycle-archive-0001',
          expectedRevision:
            0,
          targetStatus:
            'archived',
        },
        '2026-08-31T07:01:00.000Z',
      );

    assert.equal(
      result.status,
      'applied',
    );

    if (
      result.status !==
      'applied'
    ) {
      return;
    }

    assert.equal(
      result.trip.revision,
      1,
    );

    assert.deepEqual(
      result.trip.lifecycle,
      {
        status:
          'archived',
        archivedAt:
          '2026-08-31T07:01:00.000Z',
      },
    );

    assert.deepEqual(
      result.trip.workspace,
      current.workspace,
    );
  },
);

test(
  'restore transition returns archived trip to active state',
  () => {
    const active =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-4',
        workspace:
          workspace(
            'lifecycle-restore',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    const archived =
      applyServerTripLifecycleTransition(
        active,
        {
          clientMutationId:
            'lifecycle-archive-0002',
          expectedRevision:
            0,
          targetStatus:
            'archived',
        },
        '2026-08-31T07:01:00.000Z',
      );

    assert.equal(
      archived.status,
      'applied',
    );

    if (
      archived.status !==
      'applied'
    ) {
      return;
    }

    const restored =
      applyServerTripLifecycleTransition(
        archived.trip,
        {
          clientMutationId:
            'lifecycle-restore-0001',
          expectedRevision:
            1,
          targetStatus:
            'active',
        },
        '2026-08-31T07:02:00.000Z',
      );

    assert.equal(
      restored.status,
      'applied',
    );

    if (
      restored.status !==
      'applied'
    ) {
      return;
    }

    assert.equal(
      restored.trip.revision,
      2,
    );

    assert.deepEqual(
      restored.trip.lifecycle,
      {
        status:
          'active',
        archivedAt:
          null,
      },
    );
  },
);

test(
  'lifecycle transition rejects a repeated target state',
  () => {
    const current =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-5',
        workspace:
          workspace(
            'lifecycle-repeat',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    const result =
      applyServerTripLifecycleTransition(
        current,
        {
          clientMutationId:
            'lifecycle-repeat-0001',
          expectedRevision:
            0,
          targetStatus:
            'active',
        },
        '2026-08-31T07:01:00.000Z',
      );

    assert.equal(
      result.status,
      'invalid_transition',
    );

    assert.equal(
      result.trip.revision,
      0,
    );
  },
);

test(
  'stale lifecycle mutation returns canonical current trip',
  () => {
    const current =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-6',
        workspace:
          workspace(
            'lifecycle-stale',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    const result =
      applyServerTripLifecycleTransition(
        current,
        {
          clientMutationId:
            'lifecycle-stale-0001',
          expectedRevision:
            8,
          targetStatus:
            'archived',
        },
        '2026-08-31T07:01:00.000Z',
      );

    assert.equal(
      result.status,
      'conflict',
    );

    if (
      result.status !==
      'conflict'
    ) {
      return;
    }

    assert.equal(
      result.expectedRevision,
      8,
    );

    assert.equal(
      result.trip.revision,
      0,
    );
  },
);

test(
  'workspace mutation rejects archived lifecycle with canonical conflict',
  () => {
    const active =
      createServerTripEnvelope({
        ownerId:
          'lifecycle-user-7',
        workspace:
          workspace(
            'lifecycle-workspace',
          ),
        serverUpdatedAt:
          '2026-08-31T07:00:00.000Z',
      });

    const archived =
      applyServerTripLifecycleTransition(
        active,
        {
          clientMutationId:
            'lifecycle-archive-0003',
          expectedRevision:
            0,
          targetStatus:
            'archived',
        },
        '2026-08-31T07:01:00.000Z',
      );

    assert.equal(
      archived.status,
      'applied',
    );

    if (
      archived.status !==
      'applied'
    ) {
      return;
    }

    const changed =
      workspace(
        'lifecycle-workspace',
      );

    changed.funds.availableNow =
      9100;

    const updated =
      applyServerTripUpdate(
        archived.trip,
        {
          clientMutationId:
            'lifecycle-workspace-0001',
          expectedRevision:
            1,
          workspace:
            changed,
        },
        '2026-08-31T07:02:00.000Z',
      );

    assert.equal(
      updated.status,
      'conflict',
    );

    if (
      updated.status !==
      'conflict'
    ) {
      return;
    }

    assert.equal(
      updated.trip.revision,
      archived.trip.revision,
    );

    assert.deepEqual(
      updated.trip.lifecycle,
      archived.trip.lifecycle,
    );

    assert.deepEqual(
      updated.trip.workspace,
      archived.trip.workspace,
    );
  },
);

test(
  'deleting an active trip produces a terminal tombstone',
  () => {
    const current =
      createServerTripEnvelope({
        ownerId:
          'tombstone-pure-owner-1',
        workspace:
          workspace(
            'tombstone-pure-1',
          ),
        serverUpdatedAt:
          '2026-08-31T10:00:00.000Z',
      });

    const result =
      applyServerTripLifecycleTransition(
        current,
        {
          clientMutationId:
            'tombstone-pure-delete-0001',
          expectedRevision:
            0,
          targetStatus:
            'deleted',
        },
        '2026-08-31T10:01:00.000Z',
      );

    assert.equal(
      result.status,
      'applied',
    );

    if (
      result.status !==
      'applied'
    ) {
      return;
    }

    assert.equal(
      result.trip.revision,
      1,
    );

    assert.deepEqual(
      result.trip.lifecycle,
      {
        status:
          'deleted',
        archivedAt:
          null,
        deletedAt:
          '2026-08-31T10:01:00.000Z',
      },
    );
  },
);

test(
  'archived trip can become a deleted tombstone',
  () => {
    const active =
      createServerTripEnvelope({
        ownerId:
          'tombstone-pure-owner-2',
        workspace:
          workspace(
            'tombstone-pure-2',
          ),
        serverUpdatedAt:
          '2026-08-31T10:00:00.000Z',
      });

    const archived =
      applyServerTripLifecycleTransition(
        active,
        {
          clientMutationId:
            'tombstone-pure-archive-0001',
          expectedRevision:
            0,
          targetStatus:
            'archived',
        },
        '2026-08-31T10:01:00.000Z',
      );

    assert.equal(
      archived.status,
      'applied',
    );

    if (
      archived.status !==
      'applied'
    ) {
      return;
    }

    const deleted =
      applyServerTripLifecycleTransition(
        archived.trip,
        {
          clientMutationId:
            'tombstone-pure-delete-0002',
          expectedRevision:
            1,
          targetStatus:
            'deleted',
        },
        '2026-08-31T10:02:00.000Z',
      );

    assert.equal(
      deleted.status,
      'applied',
    );

    if (
      deleted.status !==
      'applied'
    ) {
      return;
    }

    assert.deepEqual(
      deleted.trip.lifecycle,
      {
        status:
          'deleted',
        archivedAt:
          null,
        deletedAt:
          '2026-08-31T10:02:00.000Z',
      },
    );
  },
);

test(
  'deleted tombstone cannot be restored by lifecycle transition',
  () => {
    const active =
      createServerTripEnvelope({
        ownerId:
          'tombstone-pure-owner-3',
        workspace:
          workspace(
            'tombstone-pure-3',
          ),
        serverUpdatedAt:
          '2026-08-31T10:00:00.000Z',
      });

    const deleted =
      applyServerTripLifecycleTransition(
        active,
        {
          clientMutationId:
            'tombstone-pure-delete-0003',
          expectedRevision:
            0,
          targetStatus:
            'deleted',
        },
        '2026-08-31T10:01:00.000Z',
      );

    assert.equal(
      deleted.status,
      'applied',
    );

    if (
      deleted.status !==
      'applied'
    ) {
      return;
    }

    const attemptedRestore =
      applyServerTripLifecycleTransition(
        deleted.trip,
        {
          clientMutationId:
            'tombstone-pure-restore-0001',
          expectedRevision:
            1,
          targetStatus:
            'active',
        },
        '2026-08-31T10:02:00.000Z',
      );

    assert.equal(
      attemptedRestore.status,
      'invalid_transition',
    );

    assert.equal(
      attemptedRestore.trip.revision,
      1,
    );

    assert.equal(
      attemptedRestore.trip.lifecycle.status,
      'deleted',
    );
  },
);

test(
  'workspace mutation rejects deleted tombstone with canonical conflict',
  () => {
    const active =
      createServerTripEnvelope({
        ownerId:
          'm94-contract-owner-1',
        workspace:
          workspace(
            'm94-contract-deleted',
          ),
        serverUpdatedAt:
          '2026-08-31T11:30:00.000Z',
      });

    const deleted =
      applyServerTripLifecycleTransition(
        active,
        {
          clientMutationId:
            'm94-contract-delete-0001',
          expectedRevision:
            0,
          targetStatus:
            'deleted',
        },
        '2026-08-31T11:31:00.000Z',
      );

    assert.equal(
      deleted.status,
      'applied',
    );

    if (
      deleted.status !==
      'applied'
    ) {
      return;
    }

    const changed =
      workspace(
        'm94-contract-deleted',
      );

    changed.funds.availableNow =
      9900;

    const attempted =
      applyServerTripUpdate(
        deleted.trip,
        {
          clientMutationId:
            'm94-contract-update-0001',
          expectedRevision:
            1,
          workspace:
            changed,
        },
        '2026-08-31T11:32:00.000Z',
      );

    assert.equal(
      attempted.status,
      'conflict',
    );

    if (
      attempted.status !==
      'conflict'
    ) {
      return;
    }

    assert.equal(
      attempted.expectedRevision,
      1,
    );

    assert.equal(
      attempted.trip.revision,
      deleted.trip.revision,
    );

    assert.deepEqual(
      attempted.trip.lifecycle,
      deleted.trip.lifecycle,
    );

    assert.deepEqual(
      attempted.trip.workspace,
      deleted.trip.workspace,
    );

    assert.equal(
      attempted.trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);
