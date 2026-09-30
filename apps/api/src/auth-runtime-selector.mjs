import {
  createDevelopmentBearerAuthenticator,
} from './auth.mjs';
import {
  createClerkAccountAuthenticator,
} from './clerk-account-authenticator.mjs';

export function resolveJahizAuthMode({
  mode = process.env.JAHIZ_AUTH_MODE,
  nodeEnv = process.env.NODE_ENV ?? 'development',
} = {}) {
  const normalized =
    typeof mode === 'string'
      ? mode.trim().toLowerCase()
      : '';

  if (!normalized) {
    if (nodeEnv === 'production') {
      throw new Error(
        'JAHIZ_AUTH_MODE must be explicit in production.',
      );
    }

    return 'development';
  }

  if (normalized === 'development') {
    if (nodeEnv === 'production') {
      throw new Error(
        'Development authentication mode is forbidden in production.',
      );
    }

    return 'development';
  }

  if (normalized === 'clerk') {
    return 'clerk';
  }

  throw new Error(
    `Unsupported JAHIZ_AUTH_MODE: ${normalized}.`,
  );
}

export function createJahizRuntimeAuthenticator({
  mode = process.env.JAHIZ_AUTH_MODE,
  nodeEnv = process.env.NODE_ENV ?? 'development',
  identityRepository,
  developmentOptions = {},
  clerkOptions = {},
} = {}) {
  const resolved =
    resolveJahizAuthMode({
      mode,
      nodeEnv,
    });

  if (resolved === 'development') {
    if (
      !identityRepository ||
      typeof identityRepository
        .ensureOwnerForIdentity !==
        'function'
    ) {
      throw new Error(
        'A Jahiz identity repository is required.',
      );
    }

    return createDevelopmentBearerAuthenticator({
      ...developmentOptions,
      nodeEnv,

      async resolveOwnerId(
        identity,
      ) {
        const result =
          await identityRepository
            .ensureOwnerForIdentity(
              identity,
            );

        if (
          result?.status !==
            'active' ||
          typeof result.ownerId !==
            'string' ||
          result.ownerId.length === 0
        ) {
          return null;
        }

        return result.ownerId;
      },
    });
  }

  return createClerkAccountAuthenticator({
    identityRepository,
    ...clerkOptions,
  });
}
