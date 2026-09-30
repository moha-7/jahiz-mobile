import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('Available Money keeps core money visible and currency details collapsible', () => {
  assert.match(main, /className="wizardMoneyLayout"/);
  assert.match(main, /className="moneyCoreCard"/);
  assert.match(main, /className=\{`currencyAdvancedPanel/);
  assert.match(main, /Currency setup/);
});

test('Comfort level belongs to Trip Details instead of MoneyBasics', () => {
  const routeStart = main.indexOf('function StepRoute');
  const currencyStart = main.indexOf('function CurrencyMetadataHint');
  const moneyStart = main.indexOf('function MoneyBasics');
  const reviewStart = main.indexOf('function Review');
  assert.ok(main.slice(routeStart, currencyStart).includes('Comfort Level'));
  assert.ok(!main.slice(moneyStart, reviewStart).includes('Comfort Level'));
});

test('Wizard manager hides long help behind a details disclosure', () => {
  assert.match(main, /className="wizardInlineHelp"/);
  assert.match(main, /What counts here\?/);
});
