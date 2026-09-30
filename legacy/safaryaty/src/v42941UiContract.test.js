import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.js', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../backend/src/modules/external/external.routes.ts', import.meta.url), 'utf8');

test('Dashboard money snapshot distinguishes paid and upcoming outgoings', () => {
  assert.match(main, /Money snapshot/);
  assert.match(main, /Paid So Far/);
  assert.match(main, /Still To Pay/);
  assert.match(main, /Upcoming trip costs, bills, and installments/);
  assert.doesNotMatch(main.slice(main.indexOf('function Overview'), main.indexOf('function DisplayCurrencySelect')), /<TopActions/);
});

test('Decision actions clearly separate deep link from full wizard', () => {
  assert.match(main, /Recommended now/);
  assert.match(main, /Recommended fix/);
  assert.match(main, /Full plan editor/);
  assert.match(main, /Two different ways to edit/);
});

test('Plan currency is edited only from Available Money currency setup', () => {
  assert.doesNotMatch(main, /function TripCostCurrencyControl/);
  assert.match(main, /Currency setup/);
  assert.match(main, /This is the only place that changes plan currencies/);
  assert.match(main, /Currency setup/);
  assert.match(main, /suggestionCurrencyLink/);
});

test('Country cost profile endpoint exposes Low Typical High planning ranges', () => {
  assert.match(api, /getCostProfile/);
  assert.match(routes, /get\('\/cost-profile'/);
  assert.match(main, /Low/);
  assert.match(main, /Typical/);
  assert.match(main, /High/);
  assert.match(main, /confidence/);
});
