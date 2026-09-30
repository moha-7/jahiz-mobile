# Safaryaty v4.28.9 — Auth Funnel & Web Standards Polish

## Goal

Fix the first-user experience. Users should not land directly in a confusing demo or a long signup form.

## Product decisions

- First screen is now a clean entry funnel.
- Demo is an explicit CTA: `Start demo`.
- Sign in and Create account are separate screens.
- Google auth appears inside auth forms, not on the first landing state.
- Microsoft/Apple placeholders are hidden until they are real.
- Signup is shorter: name, email, password, country, preferred currency, language.
- Profile photo and advanced travel preferences are moved to Travel Profile later.

## Flow

1. User opens app.
2. If not logged in, show entry funnel.
3. User chooses:
   - Start demo
   - Create account
   - Sign in
4. Demo opens Trip Intent flow.
5. When demo trip is finished, the user is asked to create account/sign in to save it.
6. After auth, pending demo trip is migrated into the saved account.

## Core untouched

- engine.js
- payments.js
- canTravel.js
- backend schema
- installment logic
- currency logic
- API contracts

## Notes

This is a web-first polish sprint. Mobile app UX remains a later phase.
