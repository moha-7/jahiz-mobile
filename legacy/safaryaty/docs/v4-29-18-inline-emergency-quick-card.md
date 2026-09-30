# v4.29.18 — Inline Emergency Quick Card

## Scope

Clarifies Emergency quick add behavior inside Suggestions.

## Changes

- Removed the separate Emergency quick add strip from the Destination Budget Builder.
- Emergency now appears as the first suggestion card and behaves as an inline quick-add card.
- Emergency collapsed card includes: Recommended, 5%, 10%, Custom.
- Expanding Emergency still shows details and the same quick actions.
- Adding Emergency moves it to Your selected trip costs and auto-scrolls to it.
- Added frontend API helper methods for suggestion apply/ignore for the next sync sprint, but did not wire them to avoid creating duplicate backend trip costs in this patch.

## Not changed

- Currency API
- Score logic
- Backend contracts
- Prisma schema
- Payment logic
- Backend source-of-truth rules
