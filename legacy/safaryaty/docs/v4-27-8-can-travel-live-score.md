# Safaryaty v4.27.8 — Can Travel + Live Score

## Goal

Turn the calculation engine into a clear user-facing decision:

- Can you travel?
- What is your score?
- What is missing?
- What should you do next?

## Added

- `src/canTravel.js`
- `src/canTravel.test.js`
- `CanTravelSummary` in overview
- `WizardScore` live inside the wizard sidebar
- Review screen now shows the verdict + next action

## Verdicts

- `READY`
- `ALMOST`
- `TIGHT`
- `RISKY`
- `BLOCKED`

## Next action examples

- Confirm exchange rate
- Complete required costs
- Reduce flexible costs
- Add savings or support
- Add emergency reserve
- Track payments until travel

## Product rule

One visible decision layer only. The user does not need to understand tripMode, cashflow, event management, payment rows, or cost type. The app translates all of that into readiness + next action.

## Tests

```bash
npm run test:core
npm run build
```

Current expected result:

- engine tests passing
- payments tests passing
- canTravel tests passing
- frontend build passing
