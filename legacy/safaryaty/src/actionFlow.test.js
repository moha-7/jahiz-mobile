import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('decision card keeps smart CTA separate from full Improve Plan wizard', () => {
  const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
  assert.match(main, /onNextAction\(status\.nextAction\)/);
  assert.match(main, /className="actionChoice primaryChoice"/);
  assert.match(main, /className="actionChoice fullPlanChoice" onClick=\{openWizard\}/);
  assert.match(main, /Recommended fix/);
  assert.match(main, /Full plan editor/);
});
