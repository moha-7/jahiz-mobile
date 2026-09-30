# Jahiz M7G.6 - Mobile Clerk Runtime and Startup Bootstrap

## Scope

M7G.6 wires the already-installed Clerk Expo SDK into the mobile provider tree
without changing trip authority or requiring real credentials for the current
development runtime.

## Runtime modes

`EXPO_PUBLIC_JAHIZ_AUTH_MODE` supports:

- `development` (default while the app remains local-first);
- `clerk`.

Clerk mode requires both:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`;
- `EXPO_PUBLIC_JAHIZ_API_URL`.

A value that looks like a Clerk secret key is rejected from the public mobile
configuration.

## Provider composition

`JahizAuthRuntimeProvider` wraps the existing provider tree. In development mode
it does not mount Clerk at all. In Clerk mode it mounts `ClerkProvider` with the
official `@clerk/expo/token-cache` SecureStore-backed token cache.

The existing theme, Tamagui, QueryClient, locale, shadow observer, diagnostics,
and navigation composition remains inside this boundary.

## Startup account bootstrap

When Clerk is enabled:

1. Clerk restores provider session state;
2. the provider session is mapped to Jahiz's provider-neutral state;
3. an access token is requested on demand;
4. `GET /v1/account/session` resolves the stable internal Jahiz owner;
5. only then does Jahiz expose an authenticated internal identity.

Unauthorized state becomes anonymous. Temporary server unavailability or a
provider/session mismatch never creates an owner and never deletes local trip
data.

## Sign out

The runtime exposes a sign-out action backed by Clerk. It changes auth state but
does not clear or reassign the local trip portfolio. Profile UI wiring remains a
later step.

## Deliberate non-cutover

- no real Clerk credential is committed;
- no sign-in/sign-up route is added;
- shadow sync still uses its existing acceptance identity;
- local trip workspace remains authoritative;
- no server-to-local overwrite is introduced;
- no commit or push is performed by the installer.
