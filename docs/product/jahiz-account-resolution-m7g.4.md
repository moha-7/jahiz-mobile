# Jahiz M7G.4 - Controlled Authenticated Account Resolution

## Scope

M7G.4 proves the production identity chain through the existing HTTP BFF without
turning it on in the live server runtime yet.

The controlled chain is:

1. Clerk-style Bearer token;
2. verified provider subject;
3. `ensureOwnerForIdentity()`;
4. stable internal Jahiz `ownerId`;
5. existing BFF authentication boundary;
6. existing owner-scoped trip repository.

## Why this milestone is controlled

The current device acceptance runtime still uses explicit development identity.
Replacing that runtime before the mobile Clerk provider, production keys, and
account-session UI are ready would mix authentication rollout with the existing
shadow/resilience acceptance channel.

M7G.4 therefore proves the complete production account-resolution composition in
an isolated PostgreSQL test database while leaving runtime selection unchanged.

## Security invariants

- A forged client owner header is ignored.
- Invalid provider tokens create no account.
- A disabled account is unauthorized and cannot silently re-provision.
- Repeated authentication for the same provider identity returns the same owner.
- Different provider subjects remain isolated.
- Concurrent first requests converge to one identity link and one Jahiz owner.
- Provider subject and internal Jahiz owner id stay separate.

## Authority

Trip authority remains local on mobile. No server-to-local overwrite is added.
No trip ownership foreign-key cutover occurs.

## Next

M7G.5 can add the authenticated account/session endpoint and runtime selector,
then wire the mobile Clerk provider only after real development Clerk credentials
are available.
