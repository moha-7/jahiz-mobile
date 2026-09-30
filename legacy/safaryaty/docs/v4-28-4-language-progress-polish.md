# Safaryaty v4.28.4 — Language & Progress Polish

## Scope

Web UI/UX polish only. No core calculation changes.

## Added

- Global language switcher in the web header and auth screen.
- Language preference persists in `localStorage`.
- `html lang` and `dir` update automatically.
- Arabic mode applies RTL direction to the main UI areas.
- Navigation labels now react to English / Arabic / Spanish.
- Simple/Advanced labels react to selected language.
- Main decision card now has a visible readiness progress bar.
- Wizard sidebar now has clearer step progress: `step / total`.
- Wizard live score now includes a progress bar.

## Not changed

- `engine.js`
- `payments.js`
- `canTravel.js`
- Installments logic
- To Pay logic
- Backend schema
- API contracts

## Notes

This is not a full translation pass for every sentence yet. It establishes the web language foundation and the visible progress system. Full copy translation can be handled later after the product wording stabilizes.
