# ADR-004 — Docker boundaries

- **Status:** Accepted

## Decision

Docker is mandatory for database and server reproducibility. Expo runs directly on the host/device because containerizing the emulator adds networking complexity without improving product reproducibility.

## Current services

- PostgreSQL 16 with persistent volume and health check.
- Receipt-gated legacy API behind the `legacy-staging` Compose profile.

## Commands

```bash
docker compose up -d postgres
docker compose --profile legacy-staging up --build legacy-api
```

The second command only succeeds when the existing PostgreSQL migration verification receipt and acknowledgement are supplied. This is deliberate.
