import {
  serverTripEnvelopeSchema,
  tripPortfolioSchema,
  type ServerTripEnvelope,
  type TripPortfolio,
} from '@jahiz/api-contracts';

export type ApplyServerTripToPortfolioResult =
  | {
      status: 'applied';
      portfolio: TripPortfolio;
    }
  | {
      status: 'empty-after-delete';
      currency: string;
    }
  | {
      status: 'trip-not-found';
    };

export function applyServerTripToPortfolio(
  portfolioInput: TripPortfolio,
  tripInput: ServerTripEnvelope,
): ApplyServerTripToPortfolioResult {
  const portfolio =
    tripPortfolioSchema.parse(
      portfolioInput,
    );
  const trip =
    serverTripEnvelopeSchema.parse(
      tripInput,
    );

  const existing =
    portfolio.trips.find(
      (record) =>
        record.workspace.id ===
        trip.tripId,
    );

  if (!existing) {
    return {
      status: 'trip-not-found',
    };
  }

  if (
    trip.lifecycle.status ===
      'deleted'
  ) {
    const remaining =
      portfolio.trips.filter(
        (record) =>
          record.workspace.id !==
          trip.tripId,
      );

    if (remaining.length === 0) {
      return {
        status:
          'empty-after-delete',
        currency:
          existing.workspace
            .currency,
      };
    }

    const currentActive =
      portfolio.activeTripId &&
      portfolio.activeTripId !==
        trip.tripId
        ? remaining.find(
            (record) =>
              record.workspace.id ===
                portfolio.activeTripId &&
              record.archivedAt ===
                null,
          )?.workspace.id ??
          null
        : null;

    const nextActive =
      currentActive ??
      remaining.find(
        (record) =>
          record.archivedAt ===
            null,
      )?.workspace.id ??
      null;

    return {
      status: 'applied',
      portfolio:
        tripPortfolioSchema.parse({
          ...portfolio,
          activeTripId:
            nextActive,
          trips:
            remaining,
        }),
    };
  }

  const archivedAt =
    trip.lifecycle.status ===
      'archived'
      ? (
          trip.lifecycle
            .archivedAt ??
          trip.serverUpdatedAt
        )
      : null;

  const trips =
    portfolio.trips.map(
      (record) =>
        record.workspace.id ===
          trip.tripId
          ? {
              ...record,
              workspace:
                trip.workspace,
              archivedAt,
            }
          : record,
    );

  let activeTripId =
    portfolio.activeTripId;

  if (
    archivedAt &&
    activeTripId ===
      trip.tripId
  ) {
    activeTripId =
      trips.find(
        (record) =>
          record.archivedAt ===
            null,
      )?.workspace.id ??
      null;
  }

  if (
    !archivedAt &&
    activeTripId === null
  ) {
    activeTripId =
      trip.tripId;
  }

  return {
    status: 'applied',
    portfolio:
      tripPortfolioSchema.parse({
        ...portfolio,
        activeTripId,
        trips,
      }),
  };
}
