# Safaryaty v4.27.3 — Trip Intent & Mode Foundation

## Product decision

Trip purpose is no longer a Wizard route field. It starts from the New Trip modal because it changes the planning logic.

## New flow

1. User clicks **New Trip**.
2. User chooses the planning intent:
   - Short Trip
   - Long Stay
   - Study Trip
   - Family Visit
   - Business Trip
   - Event Trip
   - Medical Trip
   - Relocation Trip
   - Adventure Trip
   - Couple / Honeymoon
3. User chooses travel style:
   - Survival
   - Budget
   - Balanced
   - Comfortable
   - Premium
4. Wizard opens on **Route & Dates**.

## Internal logic

The app now stores:

- `tripPurpose`
- `travelStyle`
- `tripLengthType`
- `tripMode`

Trip mode is calculated automatically:

- `SHORT_TOTAL` for normal short/medium trips.
- `LONG_MONTHLY` for long stays and extended stays.
- `HYBRID` for study, relocation, or long family/business/medical cases.

## Backend summary

The backend summary now returns a `plan` object:

```json
{
  "tripLengthDays": 90,
  "tripLengthType": "EXTENDED",
  "tripMode": "LONG_MONTHLY",
  "tripPurpose": "Study Trip",
  "travelStyle": "Budget"
}
```

## Why this matters

Future suggestions will use:

- purpose
- style
- length
- mode
- destination
- current costs
- backend summary

This prepares monthly destination costs and smarter suggestions without changing the main finance calculations yet.
