const providerPattern =
  /^[a-z0-9][a-z0-9._-]*$/;

function requireText(
  value,
  field,
  maxLength,
) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new Error(
      `Invalid authentication principal ${field}.`,
    );
  }

  return value.trim();
}

export function createJahizAuthPrincipal({
  ownerId,
  provider,
  providerSubject,
  sessionId = null,
  authMode,
}) {
  const normalizedOwnerId =
    requireText(
      ownerId,
      'ownerId',
      160,
    );

  const normalizedProvider =
    requireText(
      provider,
      'provider',
      80,
    );

  if (
    !providerPattern.test(
      normalizedProvider,
    )
  ) {
    throw new Error(
      'Invalid authentication principal provider.',
    );
  }

  const normalizedSubject =
    requireText(
      providerSubject,
      'providerSubject',
      255,
    );

  const normalizedSessionId =
    sessionId === null
      ? null
      : requireText(
          sessionId,
          'sessionId',
          255,
        );

  if (
    authMode !== 'development' &&
    authMode !== 'production'
  ) {
    throw new Error(
      'Invalid authentication principal authMode.',
    );
  }

  return Object.freeze({
    ownerId: normalizedOwnerId,
    provider: normalizedProvider,
    providerSubject:
      normalizedSubject,
    sessionId:
      normalizedSessionId,
    authMode,
  });
}
