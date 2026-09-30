import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../backend/src/modules/external/costProfile.adapter.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../backend/src/modules/suggestions/suggestions.routes.ts', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../backend/src/modules/suggestions/suggestions.engine.ts', import.meta.url), 'utf8');

 test('frontend clears stale backend values when trip currency changes', () => {
  assert.match(main, /setBackendSuggestions\(null\)/);
  assert.match(main, /setBackendRangeProfile\(null\)/);
  assert.match(main, /normalizeBackendSuggestions/);
  assert.match(main, /normalizeBackendRangeProfile/);
});

test('backend cost profile never uses a generic target-currency relabel fallback', () => {
  assert.doesNotMatch(adapter, /generic .* fallback was used/i);
  assert.match(adapter, /Native estimates were returned without relabelling them/);
  assert.match(adapter, /trip-rate-book/);
});

test('backend suggestion generation consumes converted category estimates', () => {
  assert.match(route, /getCostProfileEnvelope/);
  assert.match(route, /estimatedCategories/);
  assert.match(engine, /estimatedCategories\?: Record<string, number>/);
});
