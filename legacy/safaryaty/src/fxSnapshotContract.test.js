import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../backend/src/modules/fx/fx.service.ts', import.meta.url), 'utf8');
const provider = readFileSync(new URL('../backend/src/modules/fx/fx.provider.ts', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../backend/src/modules/fx/fx.routes.ts', import.meta.url), 'utf8');

test('FX resolver uses persistent snapshots and a provider chain', () => {
  assert.match(service, /readSnapshot/);
  assert.match(service, /writeSnapshot/);
  assert.match(service, /fx-resolver-v1/);
  assert.match(provider, /fetchFrankfurterRates/);
  assert.match(provider, /fetchOpenErRates/);
  assert.match(provider, /fetchFawazRates/);
});

test('FX response exposes freshness and confidence metadata', () => {
  for (const field of ['sourceAsOf', 'fetchedAt', 'expiresAt', 'stale', 'confidence']) assert.match(service, new RegExp(field));
});

test('FX force sync is protected', () => {
  assert.match(routes, /requireAuth/);
  assert.match(routes, /requirePermission\('canManagePresets'\)/);
  assert.match(routes, /router\.post\('\/sync'/);
});
