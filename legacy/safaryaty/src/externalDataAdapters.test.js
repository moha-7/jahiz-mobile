import test from 'node:test';
import assert from 'node:assert/strict';
import { externalProviderTypes, makeDataEnvelope, shouldRefreshEnvelope, normalizeCurrencyPair, flightEstimateKey, safeFlightEstimateFallback } from './data/externalDataAdapters.js';

test('External data envelope validates provider type and confidence', () => {
  const env = makeDataEnvelope({ type: externalProviderTypes.FX, source: 'test', data: { rate: 1 } });
  assert.equal(env.type, 'fx-rate');
  assert.equal(env.confidence, 'medium');
  assert.throws(() => makeDataEnvelope({ type: 'bad', source: 'x', data: {} }));
});

test('External data envelope refresh respects expiry and stale marker', () => {
  assert.equal(shouldRefreshEnvelope(null), true);
  assert.equal(shouldRefreshEnvelope({ stale: true }), true);
  assert.equal(shouldRefreshEnvelope({ expiresAt: '2000-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:00:00.000Z')), true);
  assert.equal(shouldRefreshEnvelope({ expiresAt: '2030-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:00:00.000Z')), false);
});

test('Provider keys normalize currency and flight estimate identity', () => {
  assert.equal(normalizeCurrencyPair('aed', 'egp'), 'AED_EGP');
  assert.equal(flightEstimateKey({ origin: 'dxb', destination: 'evn', departureDate: '2026-06-11', travelers: 2 }), 'DXB|EVN|2026-06-11||2|ECONOMY');
});

test('Flight fallback is explicitly low confidence and not live pricing', () => {
  const env = safeFlightEstimateFallback({ origin: 'DXB', destination: 'EVN', currency: 'USD', travelers: 2 });
  assert.equal(env.confidence, 'low');
  assert.equal(env.data.currency, 'USD');
  assert.ok(env.data.typical > env.data.min);
  assert.match(env.notes.join(' '), /Not a live ticket price/);
});
