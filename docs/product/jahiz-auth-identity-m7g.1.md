# Jahiz M7G.1 - Auth and Identity Contracts

## Status

M7G.1 freezes the provider-neutral identity boundary. It does not install an
identity provider, create login routes, change server authority, or migrate any
user data.

## Invariants

1. `ownerId` is the stable Jahiz account identifier used by repositories.
2. A provider subject is external opaque identity metadata. Production code must
   resolve it to a Jahiz `ownerId`; the client never supplies repository
   authority.
3. Access and refresh tokens are provider-owned credentials. They are not part
   of the persisted Jahiz auth state.
4. Mobile obtains an access token on demand and turns it into the existing
   `Authorization: Bearer ...` transport boundary.
5. Development bearer identity remains explicit, development-only, and blocked
   in production.
6. Sign out must end the provider session later, but must not silently delete the
   local trip portfolio.
7. Anonymous/local portfolio adoption is never an automatic overwrite.

## Auth state

The mobile-facing state is intentionally small:

- `loading`
- `anonymous`
- `authenticated` with a validated identity descriptor

An authenticated identity contains:

- `ownerId`
- `provider`
- `providerSubject`
- optional `sessionId`

Email, display name, and other profile data are not authentication authority and
belong in a later account/profile model.

## Provider adapter

M7G.2 can bind Clerk or another signed-token provider behind this contract.
Provider-specific SDK objects must stay outside domain, finance, trip, and
repository layers.

The server adapter is responsible for:

1. verifying the signed token;
2. reading the provider subject from verified claims;
3. resolving that subject to an internal Jahiz `ownerId`;
4. returning a Jahiz authentication principal to the existing BFF boundary.

## Local portfolio adoption

Before any authenticated adoption, the client must know both local candidate
state and remote account state.

- unauthenticated -> blocked;
- remote truth unavailable -> wait;
- no local candidates -> nothing to adopt;
- local candidates + empty remote account -> offer adoption, require explicit
  user confirmation;
- local candidates + existing remote trips -> explicit merge flow required.

No branch permits automatic overwrite.

## Out of scope

- Clerk package installation
- production keys or secrets
- Sign up / Sign in / Sign out UI
- password recovery
- users or identity-link database tables
- remote-to-local authority cutover
- automatic portfolio migration
