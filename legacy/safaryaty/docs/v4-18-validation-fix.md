# v4.18 — Wizard Validation Fix

## Fixed

- Step validation is now isolated per step.
- Route step no longer asks for exchange rate.
- Exchange rate validation lives in Money/Currency step only.
- Errors are attached to fields instead of a large red summary block.
- Next is blocked until current step is valid.
- When Next is blocked, the app scrolls to the first invalid field.

## Route step validates only

- Trip name
- From country
- From airport
- To country
- To airport
- Departure date
- Return date
- Return after departure
- Travelers

## Money step validates

- Income currency
- Trip currency
- Exchange rate if currencies differ
- Income sources
- One-time income dates
