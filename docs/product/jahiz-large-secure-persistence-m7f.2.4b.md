# Jahiz M7F.2.4B — Large Secure Workspace Persistence

## Problem

The real-device acceptance run exposed repeated native warnings that the persisted trip workspace exceeded the practical SecureStore value limit.

The workspace/portfolio can legitimately grow as users add:

- multiple trips
- cost items
- commitments
- payments
- Money In
- notes and metadata

A single encrypted SecureStore value is therefore not a reliable persistence format for the canonical local workspace.

## Decision

Keep the local workspace encrypted in SecureStore, but store it as an atomic generation of small encrypted chunks.

This milestone intentionally does **not** move financial data to unencrypted AsyncStorage or a plaintext file.

## Layout

For a storage name such as:

`jahiz.trip-portfolio.v2`

the adapter stores:

```text
jahiz.trip-portfolio.v2.manifest
jahiz.trip-portfolio.v2.chunk.<generation>.0
jahiz.trip-portfolio.v2.chunk.<generation>.1
...
```

Each payload chunk is at most 1500 UTF-8 bytes.

The manifest is committed last and contains only:

- format version
- generation id
- chunk count
- original byte count
- checksum

## Atomicity

A new generation is written before the manifest changes.

If any chunk write fails:

- the new partial generation is cleaned up best-effort
- the previous manifest remains authoritative
- the previous workspace remains readable

After a successful manifest commit, the old generation and legacy single value are cleaned up.

## Legacy migration

If no chunk manifest exists, reads fall back to the existing monolithic SecureStore key.

The next normal persistence write automatically converts that value to the chunked format.

No manual user-data migration step is required.

## Web

The existing web localStorage branch is unchanged.

Chunking applies only to the native SecureStore branch.

## Authority

This changes only local persistence transport.

It does not change:

- financial truth
- multi-trip semantics
- Shadow Sync authority
- server authority
- API contracts

Local state remains authoritative.
