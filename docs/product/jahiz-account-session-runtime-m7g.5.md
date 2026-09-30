# Jahiz M7G.5 - Account Session and Auth Runtime Selector

M7G.5 adds a protected account/session endpoint and an explicit server
authentication runtime selector.

`JAHIZ_AUTH_MODE` supports `development` and `clerk`.

Rules:

- non-production may default to development;
- production must set the mode explicitly;
- development mode is forbidden in production;
- unknown modes fail closed.

`GET /v1/account/session` returns only authenticated status, internal Jahiz
ownerId, provider, and provider session id when present. Provider subject is not
echoed.

Mobile combines its provider-authenticated session with this server-resolved
ownerId and fails closed on provider/session mismatch.

No production Clerk keys, ClerkProvider, auth UI, trip authority cutover,
commit, or push are included.
