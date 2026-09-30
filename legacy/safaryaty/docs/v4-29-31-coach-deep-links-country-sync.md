# v4.29.31 — Coach Deep Links + Country Metadata Sync Adapter

## Coach deep links

Travel Coach actions are no longer passive text only. Each next action now carries a target:

- Add emergency → opens Trip Costs and expands the Emergency suggestion/selected card.
- Reduce flexible costs → opens Trip Costs.
- Track payments → opens Trip Payments.
- Confirm exchange rate / Add money → opens the wizard for the money/rate step.

Copy stays short and user-facing. The UI points the user directly to the next editable place.

## Country metadata sync adapter

Added backend external routes:

- `GET /api/external/countries` — local metadata envelope.
- `POST /api/external/countries/sync` — REST Countries live-sync preview with local fallback.

This does not replace the stable local metadata yet. It prepares the Docker/worker phase where country metadata can be synced into a DB/snapshot.

## Not changed

- FX conversion logic.
- Score formula.
- Payment source-of-truth.
- Prisma schema.
- Suggestion amount calculations.
