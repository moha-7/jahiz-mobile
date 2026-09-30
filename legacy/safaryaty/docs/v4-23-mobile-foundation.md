# Safaryaty v4.23 — Mobile-ready Foundation

This sprint keeps the current product direction and adds the first app-readiness layer.

## Added

- PWA manifest foundation.
- SVG app icon.
- Mobile theme color and standalone metadata.
- Mobile bottom navigation behavior for existing tabs.
- Safer mobile spacing and sticky wizard actions.
- Backend API version metadata updated.

## Not added yet

No service worker/offline cache yet. This is intentional. Offline behavior should come after backend data sync is stable.

## Next sprint

Sprint 2.4.2 should continue with finance DB integration:

1. Income table integration.
2. Life costs table integration.
3. Installments table integration.
4. Trip costs table integration.
5. Expenses table integration.
6. Backend summary calculation endpoint.

## App direction

Recommended path:

1. Make it PWA-installable first.
2. Stabilize backend sync.
3. Add offline-safe drafts later.
4. Package with Capacitor only after core APIs are stable.
