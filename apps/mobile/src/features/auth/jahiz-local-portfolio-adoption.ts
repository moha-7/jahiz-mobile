import {
  tripPortfolioSchema,
  tripWorkspaceSchema,
  type TripPortfolio,
  type TripRecord,
} from '@jahiz/api-contracts';

export type JahizPortfolioAdoptionInput = {
  isAuthenticated: boolean;
  localCandidateTripCount: number;
  remoteTripCount: number | null;
};

export type JahizPortfolioAdoptionDecision = {
  status:
    | 'blocked-not-authenticated'
    | 'awaiting-remote-truth'
    | 'nothing-local-to-adopt'
    | 'offer-local-adoption'
    | 'merge-required';
  requiresUserConfirmation: boolean;
  allowAutomaticOverwrite: false;
};

function assertCount(
  value: number,
  field: string,
) {
  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${field} must be a non-negative integer.`,
    );
  }
}

export function evaluateJahizPortfolioAdoption(
  input: JahizPortfolioAdoptionInput,
): JahizPortfolioAdoptionDecision {
  assertCount(
    input.localCandidateTripCount,
    'localCandidateTripCount',
  );

  if (input.remoteTripCount !== null) {
    assertCount(
      input.remoteTripCount,
      'remoteTripCount',
    );
  }

  if (!input.isAuthenticated) {
    return {
      status:
        'blocked-not-authenticated',
      requiresUserConfirmation: false,
      allowAutomaticOverwrite: false,
    };
  }

  if (input.remoteTripCount === null) {
    return {
      status:
        'awaiting-remote-truth',
      requiresUserConfirmation: false,
      allowAutomaticOverwrite: false,
    };
  }

  if (
    input.localCandidateTripCount === 0
  ) {
    return {
      status:
        'nothing-local-to-adopt',
      requiresUserConfirmation: false,
      allowAutomaticOverwrite: false,
    };
  }

  if (input.remoteTripCount === 0) {
    return {
      status:
        'offer-local-adoption',
      requiresUserConfirmation: true,
      allowAutomaticOverwrite: false,
    };
  }

  return {
    status: 'merge-required',
    requiresUserConfirmation: true,
    allowAutomaticOverwrite: false,
  };
}


export type JahizAnonymousPortfolioAdoptionAssessment = {
  status:
    | 'blocked-not-authenticated'
    | 'awaiting-remote-truth'
    | 'nothing-local-to-adopt'
    | 'offer-local-adoption'
    | 'merge-required';
  candidateTripCount: number;
  accountLocalTripCount: number;
  remoteTripCount: number | null;
  requiresUserConfirmation: boolean;
  allowAutomaticOverwrite: false;
};

export type JahizRemotePortfolioCountResult =
  | {
      status: 'available';
      tripCount: number;
    }
  | {
      status:
        | 'unauthorized'
        | 'unavailable'
        | 'invalid-response';
    };

export type JahizAnonymousPortfolioAdoptionService = {
  inspect: () => Promise<JahizAnonymousPortfolioAdoptionAssessment>;
  adopt: () => Promise<
    | {
        status: 'applied';
        portfolio: TripPortfolio;
        sourceCleared: boolean;
      }
    | {
        status:
          | 'blocked-not-authenticated'
          | 'awaiting-remote-truth'
          | 'nothing-local-to-adopt'
          | 'merge-required'
          | 'remote-unavailable';
      }
  >;
};

export function isJahizTripRecordMeaningful(
  recordInput: TripRecord,
): boolean {
  const record =
    recordInput;
  const workspace =
    tripWorkspaceSchema.parse(
      record.workspace,
    );
  const profile =
    workspace.profile;

  return Boolean(
    record.name?.trim() ||
    record.archivedAt ||
    workspace.currency !== 'AED' ||
    workspace.route ||
    workspace.dates.departureDate ||
    workspace.dates.returnDate ||
    workspace.dates.flexibility !==
      'fixed' ||
    (
      profile &&
      (
        profile.travelStyleConfirmed ||
        profile.travelStyle !== 'smart' ||
        profile.purpose !== 'leisure' ||
        profile.travelers.adults !== 1 ||
        profile.travelers.children !== 0
      )
    ) ||
    workspace.funds.availableNow !==
      null ||
    workspace.funds
      .expectedBeforeTravel !== 0 ||
    workspace.funds
      .expectedAfterTravel !== 0 ||
    workspace.funds.safetyReserve !==
      0 ||
    workspace.funds
      .originCommitments !== 0 ||
    workspace.moneyInReviewed ||
    workspace.moneyInItems.length > 0 ||
    workspace.commitmentsReviewed ||
    workspace.commitments.length > 0 ||
    workspace.costItems.length > 0 ||
    workspace.payments.length > 0
  );
}

export function createJahizAdoptableAnonymousPortfolio(
  portfolioInput: TripPortfolio,
): TripPortfolio | null {
  const portfolio =
    tripPortfolioSchema.parse(
      portfolioInput,
    );

  const trips =
    portfolio.trips.filter(
      isJahizTripRecordMeaningful,
    );

  if (trips.length === 0) {
    return null;
  }

  const currentActive =
    portfolio.activeTripId
      ? trips.find(
          (record) =>
            record.workspace.id ===
              portfolio.activeTripId &&
            record.archivedAt === null,
        )
      : null;

  const activeTripId =
    currentActive?.workspace.id ??
    trips.find(
      (record) =>
        record.archivedAt === null,
    )?.workspace.id ??
    null;

  return tripPortfolioSchema.parse({
    version: 1,
    activeTripId,
    trips,
  });
}

export function assessJahizAnonymousPortfolioAdoption(
  input: {
    isAuthenticated: boolean;
    anonymousPortfolio:
      TripPortfolio | null;
    accountPortfolio:
      TripPortfolio;
    remoteTripCount: number | null;
  },
): JahizAnonymousPortfolioAdoptionAssessment {
  const anonymous =
    input.anonymousPortfolio
      ? createJahizAdoptableAnonymousPortfolio(
          input.anonymousPortfolio,
        )
      : null;

  const account =
    createJahizAdoptableAnonymousPortfolio(
      input.accountPortfolio,
    );

  const candidateTripCount =
    anonymous?.trips.length ?? 0;

  const accountLocalTripCount =
    account?.trips.length ?? 0;

  if (
    input.remoteTripCount !== null
  ) {
    assertCount(
      input.remoteTripCount,
      'remoteTripCount',
    );
  }

  if (!input.isAuthenticated) {
    return {
      status:
        'blocked-not-authenticated',
      candidateTripCount,
      accountLocalTripCount,
      remoteTripCount:
        input.remoteTripCount,
      requiresUserConfirmation:
        false,
      allowAutomaticOverwrite:
        false,
    };
  }

  if (candidateTripCount === 0) {
    return {
      status:
        'nothing-local-to-adopt',
      candidateTripCount,
      accountLocalTripCount,
      remoteTripCount:
        input.remoteTripCount,
      requiresUserConfirmation:
        false,
      allowAutomaticOverwrite:
        false,
    };
  }

  if (
    input.remoteTripCount === null
  ) {
    return {
      status:
        'awaiting-remote-truth',
      candidateTripCount,
      accountLocalTripCount,
      remoteTripCount: null,
      requiresUserConfirmation:
        false,
      allowAutomaticOverwrite:
        false,
    };
  }

  if (
    input.remoteTripCount === 0 &&
    accountLocalTripCount === 0
  ) {
    return {
      status:
        'offer-local-adoption',
      candidateTripCount,
      accountLocalTripCount,
      remoteTripCount: 0,
      requiresUserConfirmation:
        true,
      allowAutomaticOverwrite:
        false,
    };
  }

  return {
    status: 'merge-required',
    candidateTripCount,
    accountLocalTripCount,
    remoteTripCount:
      input.remoteTripCount,
    requiresUserConfirmation: true,
    allowAutomaticOverwrite: false,
  };
}

export function createJahizAnonymousPortfolioAdoptionService(
  input: {
    isAuthenticated: () => boolean;
    loadAnonymousPortfolio:
      () => Promise<TripPortfolio | null>;
    getAccountPortfolio:
      () => TripPortfolio;
    getRemotePortfolioCount:
      () => Promise<JahizRemotePortfolioCountResult>;
    saveAccountPortfolio:
      (
        portfolio: TripPortfolio,
      ) => Promise<void>;
    applyAccountPortfolio:
      (
        portfolio: TripPortfolio,
      ) => void;
    clearAnonymousPortfolio:
      () => Promise<void>;
  },
): JahizAnonymousPortfolioAdoptionService {
  async function inspect() {
    const anonymousPortfolio =
      await input
        .loadAnonymousPortfolio();

    const candidate =
      anonymousPortfolio
        ? createJahizAdoptableAnonymousPortfolio(
            anonymousPortfolio,
          )
        : null;

    if (
      !input.isAuthenticated()
    ) {
      return assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: false,
        anonymousPortfolio,
        accountPortfolio:
          input.getAccountPortfolio(),
        remoteTripCount: null,
      });
    }

    if (!candidate) {
      return assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio,
        accountPortfolio:
          input.getAccountPortfolio(),
        remoteTripCount: 0,
      });
    }

    const remote =
      await input
        .getRemotePortfolioCount();

    if (
      remote.status !== 'available'
    ) {
      return assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio,
        accountPortfolio:
          input.getAccountPortfolio(),
        remoteTripCount: null,
      });
    }

    return assessJahizAnonymousPortfolioAdoption({
      isAuthenticated: true,
      anonymousPortfolio,
      accountPortfolio:
        input.getAccountPortfolio(),
      remoteTripCount:
        remote.tripCount,
    });
  }

  async function adopt() {
    const anonymousPortfolio =
      await input
        .loadAnonymousPortfolio();

    const candidate =
      anonymousPortfolio
        ? createJahizAdoptableAnonymousPortfolio(
            anonymousPortfolio,
          )
        : null;

    if (!input.isAuthenticated()) {
      return {
        status:
          'blocked-not-authenticated',
      } as const;
    }

    if (!candidate) {
      return {
        status:
          'nothing-local-to-adopt',
      } as const;
    }

    const remote =
      await input
        .getRemotePortfolioCount();

    if (
      remote.status !== 'available'
    ) {
      return {
        status:
          'remote-unavailable',
      } as const;
    }

    const assessment =
      assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio,
        accountPortfolio:
          input.getAccountPortfolio(),
        remoteTripCount:
          remote.tripCount,
      });

    if (
      assessment.status !==
        'offer-local-adoption'
    ) {
      return {
        status: assessment.status,
      } as const;
    }

    // Durably write the account copy first. Clearing the anonymous source
    // happens only after the account copy is safely persisted.
    await input.saveAccountPortfolio(
      candidate,
    );

    input.applyAccountPortfolio(
      candidate,
    );

    let sourceCleared = false;

    try {
      await input
        .clearAnonymousPortfolio();
      sourceCleared = true;
    } catch {
      // Duplicate retention is safer than deleting the only known-good copy.
      // A later inspection will fail closed as merge-required because the
      // account namespace is no longer empty.
    }

    return {
      status: 'applied',
      portfolio: candidate,
      sourceCleared,
    } as const;
  }

  return {
    inspect,
    adopt,
  };
}
