# ADR-001 — Delivery model

- **Status:** Accepted
- **Milestone:** 0.1.0-alpha.1

## Decision

Jahiz uses **Dual-Track Agile + Scrumban + weekly vertical slices**.

Discovery and Delivery run in parallel. A feature must meet Definition of Ready before coding and Definition of Done before release.

Waterfall-style gates are limited to database migrations, security decisions, API version changes, privacy/legal changes and production releases.

## Board

`Backlog → Discovery → Design → Design Review → Ready for Development → Development → Code Review → QA → Ready for Release → Done`

Work-in-progress limit for the initial team: one primary feature in Development.
