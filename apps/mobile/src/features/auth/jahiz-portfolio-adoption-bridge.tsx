import {
  useEffect,
} from 'react';

import {
  useTripPortfolioStore,
} from '@/features/trip-workspace/trip-portfolio-store';

import {
  useJahizAuthRuntime,
} from '@/providers/jahiz-auth-runtime-provider';

import {
  createJahizAuthenticatedPortfolioAdoptionRuntime,
} from './jahiz-portfolio-adoption-runtime';

import {
  useJahizPortfolioAdoptionUiStore,
} from './jahiz-portfolio-adoption-ui-store';

export function JahizPortfolioAdoptionBridge() {
  const {
    mode,
    state,
    accountResolution,
    localOwnerId,
    getAuthorizationHeader,
  } = useJahizAuthRuntime();

  const hasHydrated =
    useTripPortfolioStore(
      (current) =>
        current.hasHydrated,
    );

  const authenticatedOwnerId =
    state.status ===
      'authenticated'
      ? state.identity.ownerId
      : null;

  useEffect(() => {
    if (
      mode !== 'clerk' ||
      accountResolution !==
        'resolved' ||
      !authenticatedOwnerId ||
      localOwnerId !==
        authenticatedOwnerId ||
      !hasHydrated
    ) {
      return;
    }

    const apiUrl =
      process.env
        .EXPO_PUBLIC_JAHIZ_API_URL
        ?.trim();

    if (!apiUrl) {
      return;
    }

    let active = true;

    const ui =
      useJahizPortfolioAdoptionUiStore
        .getState();

    // Real account sync must not start until anonymous adoption has been
    // inspected for this owner. An absent/unknown gate is fail-closed.
    ui.markChecking(
      authenticatedOwnerId,
    );

    const runtime =
      createJahizAuthenticatedPortfolioAdoptionRuntime({
        ownerId:
          authenticatedOwnerId,
        apiUrl,
        getAuthorizationHeader,
        isActive: () =>
          active,
      });

    void runtime
      .inspect()
      .then((assessment) => {
        if (!active) {
          return;
        }

        const ui =
          useJahizPortfolioAdoptionUiStore
            .getState();

        if (
          (
            assessment.status ===
              'offer-local-adoption' ||
            assessment.status ===
              'merge-required'
          ) &&
          assessment.remoteTripCount !==
            null
        ) {
          ui.setEntry({
            ownerId:
              authenticatedOwnerId,
            status:
              assessment.status,
            candidateTripCount:
              assessment
                .candidateTripCount,
            accountLocalTripCount:
              assessment
                .accountLocalTripCount,
            remoteTripCount:
              assessment
                .remoteTripCount,
          });
          return;
        }

        if (
          assessment.status ===
            'nothing-local-to-adopt'
        ) {
          ui.markClear(
            authenticatedOwnerId,
          );
        }
        // awaiting remote truth intentionally remains "checking" so account
        // sync cannot race ahead and create remote state before adoption review.
      })
      .catch(() => undefined);

    return () => {
      active = false;

      useJahizPortfolioAdoptionUiStore
        .getState()
        .clearOwner(
          authenticatedOwnerId,
        );
    };
  }, [
    accountResolution,
    authenticatedOwnerId,
    getAuthorizationHeader,
    hasHydrated,
    localOwnerId,
    mode,
  ]);

  return null;
}
