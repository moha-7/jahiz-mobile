import {
  jahizAuthenticatedIdentitySchema,
  type JahizAuthenticatedIdentity,
  type JahizAuthState,
} from '@jahiz/api-contracts';

export type JahizAuthTokenSource = {
  getAccessToken:
    () => Promise<string | null>;
};

export function createLoadingJahizAuthState():
  JahizAuthState {
  return {
    status: 'loading',
  };
}

export function createAnonymousJahizAuthState():
  JahizAuthState {
  return {
    status: 'anonymous',
  };
}

export function createAuthenticatedJahizAuthState(
  identity: JahizAuthenticatedIdentity,
): JahizAuthState {
  return {
    status: 'authenticated',
    identity:
      jahizAuthenticatedIdentitySchema.parse(
        identity,
      ),
  };
}

export async function buildJahizAuthorizationHeader(
  source: JahizAuthTokenSource,
): Promise<string | undefined> {
  const token =
    (
      await source.getAccessToken()
    )?.trim() ?? '';

  if (!token) {
    return undefined;
  }

  return `Bearer ${token}`;
}
