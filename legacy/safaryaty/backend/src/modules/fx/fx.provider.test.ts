import test from 'node:test';
import assert from 'node:assert/strict';
import { staticRatesForBase } from './fx.provider.js';

test('static FX fallback supports direct and pivot-derived bases', () => {
  const aed = staticRatesForBase('AED');
  assert.equal(aed?.rates.AED, 1);
  assert.ok(Number(aed?.rates.USD) > 0);

  const egp = staticRatesForBase('EGP');
  assert.equal(egp?.rates.EGP, 1);
  assert.ok(Number(egp?.rates.AED) > 0);
});
