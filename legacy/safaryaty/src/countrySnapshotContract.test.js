import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('country metadata has a persistent snapshot model and protected sync route', () => {
  const schema = read('backend/prisma/schema.prisma');
  const routes = read('backend/src/modules/external/external.routes.ts');
  const service = read('backend/src/modules/external/countryMetadata.service.ts');
  assert.match(schema, /model ExternalDataSnapshot/);
  assert.match(schema, /@@unique\(\[provider, resourceType, resourceKey\]\)/);
  assert.match(routes, /post\('\/countries\/sync', requireAuth, requirePermission\('canManagePresets'\)/);
  assert.match(service, /last known good snapshot/i);
  assert.match(service, /local-country-fallback/);
});
