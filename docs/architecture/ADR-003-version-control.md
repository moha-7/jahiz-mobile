# ADR-003 — Version control and releases

- **Status:** Accepted

## Branching

Use trunk-based development with short-lived branches:

- `feat/<scope>`
- `fix/<scope>`
- `chore/<scope>`
- `hotfix/<scope>`

`main` is protected. Changes merge through pull requests after CI succeeds.

## Commits

Use Conventional Commits, for example:

- `feat(route): add bilingual airport selection`
- `fix(currency): preserve payment marks`
- `chore(docker): add postgres healthcheck`

## Versions

Jahiz uses semantic prerelease versions:

`0.1.0-alpha.1 → 0.1.0-beta.1 → 0.1.0`

The preserved source baseline should be tagged:

`safaryaty-v4.29.52.1-postgres-stable`
