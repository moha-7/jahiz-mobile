# Safaryaty QA Center

This folder is the release gate for the web MVP.

## Order

1. Run automated checks:

```bash
npm run qa:release
```

2. Execute the manual scenario matrix:

- `v4-29-37-full-mvp-scenario-matrix.md`

3. Record results in:

- `release-signoff-template.md`

## Severity rule

- **P0 / Critical:** wrong money truth, lost paid state, saved-trip corruption, auth/security failure. Release blocked.
- **P1 / High:** core flow unavailable or misleading decision/action. Release blocked unless explicitly waived.
- **P2 / Medium:** confusing UX with a working workaround. May ship with a documented follow-up.
- **P3 / Low:** polish only.
