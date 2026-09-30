import {
  createJahizAuthPrincipal,
} from './auth-principal.mjs';

async function preserveDevelopmentOwner({
  providerSubject,
}) {
  return providerSubject;
}

export function createDevelopmentBearerAuthenticator(
  {
    enabled =
      process.env.JAHIZ_DEV_AUTH_ENABLED === '1',
    nodeEnv =
      process.env.NODE_ENV ??
      'development',
    resolveOwnerId =
      preserveDevelopmentOwner,
  } = {},
) {
  if (enabled && nodeEnv === 'production') {
    throw new Error(
      'Development authentication cannot be enabled in production.',
    );
  }

  if (
    typeof resolveOwnerId !==
    'function'
  ) {
    throw new Error(
      'A development owner resolver is required.',
    );
  }

  return async function authenticateRequest(
    request,
  ) {
    if (!enabled) {
      return null;
    }

    const header =
      request.headers.authorization;

    if (
      typeof header !== 'string' ||
      !header.startsWith('Bearer ')
    ) {
      return null;
    }

    const token =
      header.slice('Bearer '.length);

    const match =
      /^dev:([A-Za-z0-9_-]{1,120})$/.exec(
        token,
      );

    if (!match) {
      return null;
    }

    const identity = {
      provider: 'development',
      providerSubject: match[1],
    };

    const ownerId =
      await resolveOwnerId(
        identity,
      );

    if (
      typeof ownerId !== 'string' ||
      ownerId.length === 0
    ) {
      return null;
    }

    return createJahizAuthPrincipal({
      ownerId,
      provider:
        identity.provider,
      providerSubject:
        identity.providerSubject,
      sessionId: null,
      authMode: 'development',
    });
  };
}
