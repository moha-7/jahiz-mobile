# Jahiz M7G.3 - User and Identity-Link Persistence

## Scope

M7G.3 introduces the first production-capable Jahiz account identity model.

It does not wire Clerk as the live server authenticator, add login UI, move trip
authority to the server, or adopt existing local trips.

## Stable owner model

`jahiz_user.id` is the stable internal owner identifier used by Jahiz.

`jahiz_identity_link` maps:

- provider;
- provider subject;
- Jahiz user id.

The provider subject remains opaque external identity and is never repository
authority by itself.

## Account states

The current account status model is intentionally small:

- `active`
- `disabled`
- `deleted`

An identity linked to a disabled or deleted user cannot silently create a new
replacement account.

## Provisioning rule

The repository supports an idempotent `ensureOwnerForIdentity()` operation.

For a new verified identity it creates exactly one Jahiz user and identity link.
For an existing identity it returns the existing owner. A unique provider /
subject key protects against duplicate ownership.

## Deliberate non-cutover

`jahiz_trip.owner_id` remains its existing text field and receives no foreign
key in M7G.3.

That is deliberate because current development and device-acceptance identities
still exist while production identity is being introduced. Adding a foreign key
now would turn an identity milestone into an authority/data migration.

## Next

M7G.4 can wire the Clerk verifier to the identity repository and expose a safe
authenticated account/session resolution boundary. Only after that should the
mobile auth provider and Sign in / Sign out experience be wired.
