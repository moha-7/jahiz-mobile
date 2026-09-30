import {
  jahizAccountSessionSchema,
  type JahizAuthenticatedIdentity,
} from '@jahiz/api-contracts';

import type {
  JahizProviderSessionState,
} from './jahiz-clerk-auth-adapter';

export type JahizAccountSessionResolution =
  | {
      status: 'resolved';
      identity: JahizAuthenticatedIdentity;
    }
  | { status: 'unauthorized' }
  | { status: 'unavailable' }
  | { status: 'provider-mismatch' };

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export async function resolveJahizAccountSession({
  apiUrl,
  providerSession,
  getAuthorizationHeader,
  fetchImpl = fetch as FetchLike,
}: {
  apiUrl: string;
  providerSession: JahizProviderSessionState;
  getAuthorizationHeader:
    () => Promise<string | undefined>;
  fetchImpl?: FetchLike;
}): Promise<JahizAccountSessionResolution> {
  if (
    providerSession.status !==
      'provider-authenticated'
  ) {
    return {
      status: 'unauthorized',
    };
  }

  const base =
    apiUrl.trim().replace(/\/+$/, '');

  if (!base) {
    return {
      status: 'unavailable',
    };
  }

  const authorization =
    await getAuthorizationHeader();

  if (!authorization) {
    return {
      status: 'unauthorized',
    };
  }

  let response;

  try {
    response =
      await fetchImpl(
        `${base}/v1/account/session`,
        {
          method: 'GET',
          headers: {
            authorization,
          },
        },
      );
  }
  catch {
    return {
      status: 'unavailable',
    };
  }

  if (response.status === 401) {
    return {
      status: 'unauthorized',
    };
  }

  if (!response.ok) {
    return {
      status: 'unavailable',
    };
  }

  let body: unknown;

  try {
    body = await response.json();
  }
  catch {
    return {
      status: 'unavailable',
    };
  }

  const parsed =
    jahizAccountSessionSchema
      .safeParse(
        (
          body as {
            data?: unknown;
          }
        )?.data,
      );

  if (!parsed.success) {
    return {
      status: 'unavailable',
    };
  }

  if (
    parsed.data.provider !==
      providerSession.provider
  ) {
    return {
      status: 'provider-mismatch',
    };
  }

  if (
    parsed.data.sessionId &&
    providerSession.sessionId &&
    parsed.data.sessionId !==
      providerSession.sessionId
  ) {
    return {
      status: 'provider-mismatch',
    };
  }

  return {
    status: 'resolved',
    identity: {
      ownerId: parsed.data.ownerId,
      provider:
        providerSession.provider,
      providerSubject:
        providerSession.providerSubject,
      sessionId:
        parsed.data.sessionId ??
        providerSession.sessionId,
    },
  };
}
