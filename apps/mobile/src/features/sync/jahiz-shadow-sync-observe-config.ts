export type ShadowObserveConfigInput = {
  isDevelopment: boolean;
  platform: string;
  enabledFlag?: string;
  baseUrl?: string;
  devOwnerId?: string;
};

export type ShadowObserveConfig =
  | {
      enabled: false;
      reason:
        | 'flag-off'
        | 'production'
        | 'web-disabled'
        | 'missing-api-url'
        | 'missing-dev-owner';
    }
  | {
      enabled: true;
      baseUrl: string;
      devOwnerId: string;
    };

function normalize(
  value: string | undefined,
): string {
  return value?.trim() ?? '';
}

export function resolveShadowObserveConfig(
  input: ShadowObserveConfigInput,
): ShadowObserveConfig {
  if (
    normalize(input.enabledFlag) !==
    '1'
  ) {
    return {
      enabled: false,
      reason: 'flag-off',
    };
  }

  if (!input.isDevelopment) {
    return {
      enabled: false,
      reason: 'production',
    };
  }

  if (input.platform === 'web') {
    return {
      enabled: false,
      reason: 'web-disabled',
    };
  }

  const baseUrl =
    normalize(input.baseUrl);

  if (!baseUrl) {
    return {
      enabled: false,
      reason: 'missing-api-url',
    };
  }

  const devOwnerId =
    normalize(input.devOwnerId);

  if (!devOwnerId) {
    return {
      enabled: false,
      reason:
        'missing-dev-owner',
    };
  }

  return {
    enabled: true,
    baseUrl:
      baseUrl.replace(/\/+$/, ''),
    devOwnerId,
  };
}
