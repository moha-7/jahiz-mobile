import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryMetadataEnvelope, LocalCountryMetadataProvider } from './countryMetadata.adapter.js';

test('local country fallback returns normalized, currency-aware rows', async () => {
  const result = await getCountryMetadataEnvelope(new LocalCountryMetadataProvider());
  assert.equal(result.type, 'country-metadata');
  assert.equal(result.stale, false);
  const uae = result.data.find((country) => country.code === 'AE');
  assert.equal(uae?.currency, 'AED');
  assert.ok(result.data.every((country) => country.code && country.name && country.currency));
});
