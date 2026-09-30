# External API Adapter QA

## Must pass

- UI does not import live external provider code.
- Every external value has source + confidence.
- Flight fallback says it is not live ticket price.
- Cost profile estimates never use salary/savings/support/available cash.
- FX stays one selected rate.

## Manual checks later

- Flight estimate visible as estimate, not booking price.
- Country profile source visible in advanced mode.
- Failed provider falls back to cached/stale data.
- User can continue planning offline/without provider.
