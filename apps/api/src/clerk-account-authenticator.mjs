import {
  createClerkBearerAuthenticator,
} from './clerk-auth-adapter.mjs';

export function createClerkAccountAuthenticator({
  identityRepository,
  ...clerkOptions
} = {}) {
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

  return createClerkBearerAuthenticator({
    ...clerkOptions,
    async resolveOwnerId(identity) {
      const result =
        await identityRepository
          .ensureOwnerForIdentity(
            identity,
          );

      if (
        result?.status !== 'active' ||
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
