import type {
  JahizAuthTokenSource,
} from './jahiz-auth-session';

export type ClerkLikeAuthSnapshot = {
  isLoaded: boolean;
  isSignedIn:
    | boolean
    | undefined;
  userId:
    | string
    | null
    | undefined;
  sessionId:
    | string
    | null
    | undefined;
  getToken:
    () => Promise<string | null>;
};

export type JahizProviderSessionState =
  | {
      status: 'loading';
    }
  | {
      status: 'anonymous';
    }
  | {
      status:
        'provider-authenticated';
      provider: 'clerk';
      providerSubject: string;
      sessionId: string | null;
    };

export function mapClerkProviderSession(
  snapshot: ClerkLikeAuthSnapshot,
): JahizProviderSessionState {
  if (!snapshot.isLoaded) {
    return {
      status: 'loading',
    };
  }

  if (
    !snapshot.isSignedIn ||
    typeof snapshot.userId !==
      'string' ||
    snapshot.userId.trim().length ===
      0
  ) {
    return {
      status: 'anonymous',
    };
  }

  return {
    status:
      'provider-authenticated',
    provider: 'clerk',
    providerSubject:
      snapshot.userId.trim(),
    sessionId:
      typeof snapshot.sessionId ===
        'string' &&
      snapshot.sessionId.trim().length >
        0
        ? snapshot.sessionId.trim()
        : null,
  };
}

export function createClerkTokenSource(
  getToken:
    ClerkLikeAuthSnapshot['getToken'],
): JahizAuthTokenSource {
  return {
    async getAccessToken() {
      return getToken();
    },
  };
}
