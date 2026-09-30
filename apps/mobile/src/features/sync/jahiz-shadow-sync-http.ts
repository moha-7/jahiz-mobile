import {
  serverTripConflictSchema,
  serverTripEnvelopeSchema,
  serverTripLifecycleInvalidTransitionSchema,
  type ServerTripCreateRequest,
  type ServerTripUpdateRequest,
  type ServerTripLifecycleMutationRequest,
} from '@jahiz/api-contracts';

import type {
  ShadowSyncRemoteLifecycleMutation,
  ShadowSyncRemoteMutation,
  ShadowSyncRemoteRead,
  ShadowSyncFullTransport,
} from './jahiz-shadow-sync';

type FetchResponseLike = {
  status: number;
  json: () => Promise<unknown>;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

type CreateShadowSyncHttpTransportInput = {
  baseUrl: string;
  getAuthorizationHeader: () =>
    Promise<string | null>;
  fetchImpl?: FetchLike;
};

function trimTrailingSlash(
  value: string,
): string {
  return value.replace(/\/+$/, '');
}

async function readJson(
  response: FetchResponseLike,
): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapCommonStatus(
  status: number,
):
  | 'unauthorized'
  | 'not-found'
  | 'unavailable'
  | null {
  if (
    status === 401 ||
    status === 403
  ) {
    return 'unauthorized';
  }

  if (status === 404) {
    return 'not-found';
  }

  if (status >= 500) {
    return 'unavailable';
  }

  return null;
}

export function createShadowSyncHttpTransport(
  input: CreateShadowSyncHttpTransportInput,
): ShadowSyncFullTransport {
  const baseUrl =
    trimTrailingSlash(
      input.baseUrl,
    );

  const fetchImpl =
    input.fetchImpl ??
    (globalThis.fetch as unknown as FetchLike);

  async function headers() {
    const authorization =
      await input.getAuthorizationHeader();

    return {
      'content-type':
        'application/json',
      ...(authorization
        ? { authorization }
        : {}),
    };
  }

  async function getTrip(
    tripId: string,
  ): Promise<ShadowSyncRemoteRead> {
    try {
      const response =
        await fetchImpl(
          `${baseUrl}/v1/trips/${encodeURIComponent(
            tripId,
          )}`,
          {
            method: 'GET',
            headers: await headers(),
          },
        );

      const mapped =
        mapCommonStatus(
          response.status,
        );

      if (mapped) {
        return {
          status: mapped,
        };
      }

      if (response.status !== 200) {
        return {
          status: 'invalid-response',
        };
      }

      const body =
        await readJson(response);

      const parsed =
        serverTripEnvelopeSchema.safeParse(
          (
            body as {
              data?: unknown;
            } | null
          )?.data,
        );

      return parsed.success
        ? {
            status: 'found',
            trip: parsed.data,
          }
        : {
            status:
              'invalid-response',
          };
    } catch {
      return {
        status: 'unavailable',
      };
    }
  }

  async function createTrip(
    request: ServerTripCreateRequest,
  ): Promise<ShadowSyncRemoteMutation> {
    try {
      const response =
        await fetchImpl(
          `${baseUrl}/v1/trips`,
          {
            method: 'POST',
            headers: await headers(),
            body: JSON.stringify(
              request,
            ),
          },
        );

      const mapped =
        mapCommonStatus(
          response.status,
        );

      if (mapped) {
        return {
          status: mapped,
        };
      }

      const body =
        await readJson(response);

      if (response.status === 409) {
        const candidate =
          body as {
            status?: unknown;
            trip?: unknown;
          } | null;

        const parsedTrip =
          serverTripEnvelopeSchema.safeParse(
            candidate?.trip,
          );

        return (
          candidate?.status ===
            'conflict' &&
          parsedTrip.success
        )
          ? {
              status: 'conflict',
              trip: parsedTrip.data,
              expectedRevision: null,
            }
          : {
              status:
                'invalid-response',
            };
      }

      if (
        response.status !== 200 &&
        response.status !== 201
      ) {
        return {
          status: 'invalid-response',
        };
      }

      const parsed =
        serverTripEnvelopeSchema.safeParse(
          (
            body as {
              data?: unknown;
            } | null
          )?.data,
        );

      if (!parsed.success) {
        return {
          status: 'invalid-response',
        };
      }

      return {
        status: 'applied',
        trip: parsed.data,
        idempotentReplay:
          Boolean(
            (
              body as {
                meta?: {
                  idempotentReplay?: unknown;
                };
              } | null
            )?.meta?.idempotentReplay,
          ),
      };
    } catch {
      return {
        status: 'unavailable',
      };
    }
  }

  async function updateTrip(
    tripId: string,
    request: ServerTripUpdateRequest,
  ): Promise<ShadowSyncRemoteMutation> {
    try {
      const response =
        await fetchImpl(
          `${baseUrl}/v1/trips/${encodeURIComponent(
            tripId,
          )}`,
          {
            method: 'PUT',
            headers: await headers(),
            body: JSON.stringify(
              request,
            ),
          },
        );

      const mapped =
        mapCommonStatus(
          response.status,
        );

      if (mapped) {
        return {
          status: mapped,
        };
      }

      const body =
        await readJson(response);

      if (response.status === 409) {
        const parsed =
          serverTripConflictSchema.safeParse(
            body,
          );

        return parsed.success
          ? {
              status: 'conflict',
              trip: parsed.data.trip,
              expectedRevision:
                parsed.data
                  .expectedRevision,
            }
          : {
              status:
                'invalid-response',
            };
      }

      if (response.status !== 200) {
        return {
          status: 'invalid-response',
        };
      }

      const parsed =
        serverTripEnvelopeSchema.safeParse(
          (
            body as {
              data?: unknown;
            } | null
          )?.data,
        );

      if (!parsed.success) {
        return {
          status: 'invalid-response',
        };
      }

      return {
        status: 'applied',
        trip: parsed.data,
        idempotentReplay:
          Boolean(
            (
              body as {
                meta?: {
                  idempotentReplay?: unknown;
                };
              } | null
            )?.meta?.idempotentReplay,
          ),
      };
    } catch {
      return {
        status: 'unavailable',
      };
    }
  }

  async function transitionTripLifecycle(
    tripId: string,
    request:
      ServerTripLifecycleMutationRequest,
  ): Promise<ShadowSyncRemoteLifecycleMutation> {
    try {
      const response =
        await fetchImpl(
          `${baseUrl}/v1/trips/${encodeURIComponent(
            tripId,
          )}/lifecycle`,
          {
            method: 'PATCH',
            headers: await headers(),
            body: JSON.stringify(
              request,
            ),
          },
        );

      const mapped =
        mapCommonStatus(
          response.status,
        );

      if (mapped) {
        return {
          status: mapped,
        };
      }

      const body =
        await readJson(response);

      if (response.status === 409) {
        const conflict =
          serverTripConflictSchema
            .safeParse(body);

        if (conflict.success) {
          return {
            status: 'conflict',
            trip: conflict.data.trip,
            expectedRevision:
              conflict.data
                .expectedRevision,
          };
        }

        const invalidTransition =
          serverTripLifecycleInvalidTransitionSchema
            .safeParse(body);

        return invalidTransition.success
          ? {
              status:
                'invalid-transition',
              trip:
                invalidTransition
                  .data.trip,
            }
          : {
              status:
                'invalid-response',
            };
      }

      if (response.status !== 200) {
        return {
          status: 'invalid-response',
        };
      }

      const parsed =
        serverTripEnvelopeSchema.safeParse(
          (
            body as {
              data?: unknown;
            } | null
          )?.data,
        );

      if (!parsed.success) {
        return {
          status: 'invalid-response',
        };
      }

      return {
        status: 'applied',
        trip: parsed.data,
        idempotentReplay:
          Boolean(
            (
              body as {
                meta?: {
                  idempotentReplay?: unknown;
                };
              } | null
            )?.meta
              ?.idempotentReplay,
          ),
      };
    } catch {
      return {
        status: 'unavailable',
      };
    }
  }

  return {
    getTrip,
    createTrip,
    updateTrip,
    transitionTripLifecycle,
  };
}
