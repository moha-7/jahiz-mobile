export type JahizMobileAuthRuntimeMode =
  | 'development'
  | 'clerk';

export type JahizMobileAuthRuntimeConfig =
  | {
      mode: 'development';
    }
  | {
      mode: 'clerk';
      publishableKey: string;
      apiUrl: string;
    };

function normalized(
  value:
    | string
    | undefined,
): string {
  return value?.trim() ?? '';
}

function normalizeApiUrl(
  value: string,
): string {
  const apiUrl =
    value.replace(/\/+$/, '');

  if (
    !/^https?:\/\/[^/\s]+/i.test(
      apiUrl,
    )
  ) {
    throw new Error(
      'EXPO_PUBLIC_JAHIZ_API_URL must be an http(s) URL.',
    );
  }

  return apiUrl;
}

export function resolveJahizMobileAuthRuntimeConfig({
  mode,
  publishableKey,
  apiUrl,
}: {
  mode?: string;
  publishableKey?: string;
  apiUrl?: string;
}): JahizMobileAuthRuntimeConfig {
  const normalizedMode =
    normalized(mode).toLowerCase();

  if (
    !normalizedMode ||
    normalizedMode ===
      'development'
  ) {
    return {
      mode: 'development',
    };
  }

  if (normalizedMode !== 'clerk') {
    throw new Error(
      `Unsupported EXPO_PUBLIC_JAHIZ_AUTH_MODE: ${normalizedMode}.`,
    );
  }

  const key =
    normalized(publishableKey);

  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is required for Clerk auth mode.',
    );
  }

  if (
    /^sk_/i.test(key)
  ) {
    throw new Error(
      'A Clerk secret key must never be exposed through EXPO_PUBLIC_*.',
    );
  }

  const normalizedApiUrl =
    normalizeApiUrl(
      normalized(apiUrl),
    );

  return {
    mode: 'clerk',
    publishableKey: key,
    apiUrl:
      normalizedApiUrl,
  };
}
