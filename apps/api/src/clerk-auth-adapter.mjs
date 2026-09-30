import {
  verifyToken,
} from '@clerk/backend';

import {
  createJahizAuthPrincipal,
} from './auth-principal.mjs';

function bearerTokenFromRequest(request) {
  const header =
    request?.headers?.authorization;

  if (
    typeof header !== 'string' ||
    !header.startsWith('Bearer ')
  ) {
    return null;
  }

  const token =
    header.slice('Bearer '.length).trim();

  return token.length > 0
    ? token
    : null;
}

function requireResolver(resolveOwnerId) {
  if (
    typeof resolveOwnerId !== 'function'
  ) {
    throw new Error(
      'A Clerk identity-to-owner resolver is required.',
    );
  }

  return resolveOwnerId;
}

function requireVerificationKey({
  jwtKey,
  secretKey,
}) {
  if (
    !jwtKey &&
    !secretKey
  ) {
    throw new Error(
      'Clerk authentication requires CLERK_JWT_KEY or CLERK_SECRET_KEY.',
    );
  }
}

export function createClerkBearerAuthenticator({
  jwtKey =
    process.env.CLERK_JWT_KEY,
  secretKey =
    process.env.CLERK_SECRET_KEY,
  authorizedParties,
  resolveOwnerId,
  verifyTokenFn = verifyToken,
} = {}) {
  requireVerificationKey({
    jwtKey,
    secretKey,
  });

  const resolve =
    requireResolver(resolveOwnerId);

  if (
    typeof verifyTokenFn !== 'function'
  ) {
    throw new Error(
      'A Clerk token verifier is required.',
    );
  }

  return async function authenticateRequest(
    request,
  ) {
    const token =
      bearerTokenFromRequest(request);

    if (!token) {
      return null;
    }

    let payload;

    try {
      payload =
        await verifyTokenFn(
          token,
          {
            ...(jwtKey
              ? { jwtKey }
              : {}),
            ...(secretKey
              ? { secretKey }
              : {}),
            ...(Array.isArray(
              authorizedParties,
            ) &&
            authorizedParties.length > 0
              ? {
                  authorizedParties,
                }
              : {}),
          },
        );
    }
    catch {
      return null;
    }

    const providerSubject =
      typeof payload?.sub === 'string'
        ? payload.sub.trim()
        : '';

    if (!providerSubject) {
      return null;
    }

    const sessionId =
      typeof payload?.sid === 'string' &&
      payload.sid.trim().length > 0
        ? payload.sid.trim()
        : null;

    const ownerId =
      await resolve({
        provider: 'clerk',
        providerSubject,
      });

    if (
      typeof ownerId !== 'string' ||
      ownerId.trim().length === 0
    ) {
      return null;
    }

    return createJahizAuthPrincipal({
      ownerId: ownerId.trim(),
      provider: 'clerk',
      providerSubject,
      sessionId,
      authMode: 'production',
    });
  };
}
