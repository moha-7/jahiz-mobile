export type JahizSyncRuntimeConfigInput = {
  enabledFlag?: string;
  killSwitchFlag?: string;
  apiUrl?: string;
  platform: string;
  allowWebFlag?: string;
};

export type JahizSyncRuntimeConfig =
  | {
      enabled: false;
      reason:
        | 'not-enabled'
        | 'killed'
        | 'missing-api-url'
        | 'web-not-allowed';
    }
  | {
      enabled: true;
      apiUrl: string;
    };

function isTrue(
  value: string | undefined,
): boolean {
  return (
    value?.trim().toLowerCase() ===
    'true'
  );
}

export function resolveJahizSyncRuntimeConfig(
  input:
    JahizSyncRuntimeConfigInput,
): JahizSyncRuntimeConfig {
  if (!isTrue(input.enabledFlag)) {
    return {
      enabled: false,
      reason: 'not-enabled',
    };
  }

  if (isTrue(input.killSwitchFlag)) {
    return {
      enabled: false,
      reason: 'killed',
    };
  }

  const apiUrl =
    input.apiUrl?.trim() ?? '';

  if (!apiUrl) {
    return {
      enabled: false,
      reason: 'missing-api-url',
    };
  }

  if (
    input.platform === 'web' &&
    !isTrue(input.allowWebFlag)
  ) {
    return {
      enabled: false,
      reason: 'web-not-allowed',
    };
  }

  return {
    enabled: true,
    apiUrl,
  };
}
