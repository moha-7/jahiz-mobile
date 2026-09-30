# Jahiz M7G.2 - Clerk Provider Adapter

## Scope

M7G.2 adds the production-provider adapter boundary for Clerk without selecting
server authority, adding account rows, creating login screens, or requiring
production credentials.

## Mobile

The Clerk-facing mobile adapter intentionally separates provider authentication
from Jahiz account ownership.

`useAuth()`-style state can provide:

- provider loading state;
- signed-out state;
- Clerk `userId` as an opaque provider subject;
- Clerk `sessionId`;
- an on-demand `getToken()` function.

A signed-in Clerk session is therefore only `provider-authenticated`. It is not a
Jahiz `authenticated` state until the server resolves that provider subject to a
stable internal `ownerId`.

The access token is requested on demand and handed to the existing Bearer
transport boundary. Jahiz does not persist the access or refresh token in its
own auth state.

## Server

The server adapter:

1. extracts the Bearer token;
2. verifies the token with Clerk;
3. reads verified `sub` and optional `sid` claims;
4. resolves `{ provider: "clerk", providerSubject: sub }` through an injected
   server-side owner resolver;
5. creates the provider-neutral Jahiz auth principal.

Client-supplied owner metadata is ignored.

## Credentials

The adapter supports Clerk verification with either:

- `CLERK_JWT_KEY` for networkless JWT verification; or
- `CLERK_SECRET_KEY`.

Production credentials are not added by this milestone.

## Next dependency

M7G.3 must create the Jahiz user / identity-link persistence model and a safe
account-resolution endpoint. Until then the Clerk adapter is deliberately not
wired as the production server authenticator.
