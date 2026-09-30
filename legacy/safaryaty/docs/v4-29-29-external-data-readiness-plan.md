# Safaryaty v4.29.29 — External Data Readiness Plan

## Goal

Prepare the project for external data without coupling UI components directly to APIs.

## Rule

Frontend should not call external travel APIs directly. Use backend adapters, cache, and normalized responses.

## Layers

External provider → Backend adapter → Cache/DB snapshot → Recommendation/Suggestion Engine → Frontend UI

## Modules to add later

### 1. Country metadata service

- Countries
- Currencies
- Flags
- Regions
- Time zones
- Default destination currency
- Supported airport/city mapping

### 2. FX provider service

- Primary FX provider
- Fallback provider
- Manual override
- Last known rate
- nextUpdateAt / cache TTL

### 3. Cost profile service

- Food daily ranges
- Local transport ranges
- Accommodation ranges
- Activities ranges
- Emergency buffer rules
- Comfort multipliers
- Country/tier fallback

### 4. Flight estimate adapter

- Provider-ready interface
- Route/month estimate
- Confidence label
- Cache by route/date window
- Fallback manual estimate

### 5. Recommendation engine

Start rule-based. Prepare data structures for later learning.

Inputs:
- user profile
- trip destination
- duration
- travelers
- comfort level
- saved trip history
- external estimates

Outputs:
- suggested costs
- confidence
- reasons
- next best action

## What not to do now

- Do not add live booking flows.
- Do not expose API keys in frontend.
- Do not block the wizard if providers fail.
- Do not use salary/savings to generate trip costs.
- Do not call APIs on every render.

## MVP principle

External data should improve estimates, not control the user experience.
