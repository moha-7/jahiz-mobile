import {
  serverTripListResponseSchema,
  type ServerTripEnvelope,
} from '@jahiz/api-contracts';

export type JahizRemoteTripPortfolioRead =
  | {
      status: 'available';
      trips:
        ServerTripEnvelope[];
    }
  | {
      status:
        | 'unauthorized'
        | 'unavailable'
        | 'invalid-response';
    };

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?:
      Record<string, string>;
  },
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export function createJahizAccountTripPortfolioHttpClient(
  input: {
    baseUrl: string;
    getAuthorizationHeader:
      () => Promise<
        string | null | undefined
      >;
    fetchImpl?: FetchLike;
  },
) {
  const baseUrl =
    input.baseUrl
      .trim()
      .replace(/\/+$/, '');

  const fetchImpl =
    input.fetchImpl ??
    (globalThis.fetch as unknown as FetchLike);

  async function listTrips():
    Promise<JahizRemoteTripPortfolioRead> {
    try {
      const authorization =
        await input
          .getAuthorizationHeader();

      if (!authorization) {
        return {
          status:
            'unauthorized',
        };
      }

      const response =
        await fetchImpl(
          `${baseUrl}/v1/trips?status=all`,
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
              Authorization:
                authorization,
            },
          },
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          status:
            'unauthorized',
        };
      }

      if (
        response.status >= 500
      ) {
        return {
          status:
            'unavailable',
        };
      }

      if (
        response.status !== 200
      ) {
        return {
          status:
            'invalid-response',
        };
      }

      const parsed =
        serverTripListResponseSchema
          .safeParse(
            await response.json(),
          );

      if (!parsed.success) {
        return {
          status:
            'invalid-response',
        };
      }

      return {
        status: 'available',
        trips:
          parsed.data.data,
      };
    } catch {
      return {
        status:
          'unavailable',
      };
    }
  }

  return {
    listTrips,
  };
}
