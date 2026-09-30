import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const fx = readFileSync(new URL('./fx.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.js', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../backend/src/modules/trips/trips.routes.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../backend/src/modules/finance/currency-context.service.ts', import.meta.url), 'utf8');
const backendCurrency = readFileSync(new URL('../backend/src/modules/finance/currency.ts', import.meta.url), 'utf8');

test('plan currency has one editor and Trip Costs only shows a notice', () => {
  const editorCount = (main.match(/<CurrencyQuickOptions/g) || []).length;
  assert.equal(editorCount, 1);
  assert.doesNotMatch(main, /function TripCostCurrencyControl/);
  assert.match(main, /DestinationCurrencyNotice trip=\{trip\} onOpenCurrencySetup=\{onOpenCurrencySetup\}/);
  assert.match(main, /data-currency-setup="true"/);
});

test('display currency is dashboard-only and restricted to four clear options', () => {
  const displayComponent = main.slice(main.indexOf('function DisplayCurrencySelect'), main.indexOf('function PlanQuickEditCard'));
  assert.match(displayComponent, /trip\.tripCurrency/);
  assert.match(displayComponent, /trip\.baseCurrency/);
  assert.match(displayComponent, /"USD"/);
  assert.match(displayComponent, /"EUR"/);
  const moneyBasics = main.slice(main.indexOf('function MoneyBasics'), main.indexOf('function Review'));
  assert.doesNotMatch(moneyBasics, /<DisplayCurrencySelect/);
});

test('frontend currency helpers have no hand-copied fallback rate table', () => {
  assert.doesNotMatch(fx, /fallbackFxRates/);
  assert.doesNotMatch(fx, /static-emergency-fallback/);
});

test('currency changes go through one backend endpoint and preserve payment marks', () => {
  assert.match(api, /updateTripCurrencyContext/);
  assert.match(routes, /currency-context/);
  assert.match(service, /getRate\(nextIncome, nextTrip\)/);
  assert.match(service, /paymentMarksPreserved: true/);
  assert.doesNotMatch(service, /paymentMark\.(delete|deleteMany)/);
  assert.match(service, /prisma\.\$transaction/);
});

test('backend display conversion consumes normalized/fallback rateBook and no duplicate static table', () => {
  assert.match(backendCurrency, /readFinanceSettingsFromTripRow/);
  assert.match(backendCurrency, /rateBook/);
  assert.doesNotMatch(backendCurrency, /fallbackFxRates/);
});

test('route changes use the same atomic currency context flow', () => {
  assert.match(main, /update\("routeOrigin"/);
  assert.match(main, /update\("routeDestination"/);
  assert.match(main, /changeCurrencyContext/);
});

test('display and automatic-rate refresh use metadata-only sync', () => {
  const displayStart = main.indexOf('const updateDisplayCurrencyOnly');
  const planningStart = main.indexOf('const updatePlanningRateOnly');
  const contextStart = main.indexOf('const changeCurrencyContext');
  assert.ok(displayStart > 0 && planningStart > displayStart && contextStart > planningStart);
  const displayBlock = main.slice(displayStart, planningStart);
  const planningBlock = main.slice(planningStart, contextStart);
  assert.match(displayBlock, /queueTripMetadataSync/);
  assert.doesNotMatch(displayBlock, /queueTripSync\(/);
  assert.match(planningBlock, /queueTripMetadataSync/);
  assert.doesNotMatch(planningBlock, /queueTripSync\(/);
});

test('actual plan-currency changes do not use snapshot finance sync', () => {
  const contextStart = main.indexOf('const changeCurrencyContext');
  const updateTripStart = main.indexOf('const updateTrip =', contextStart);
  const block = main.slice(contextStart, updateTripStart);
  assert.match(block, /updateTripCurrencyContext/);
  assert.doesNotMatch(block, /saveClientTrip|sync-client-snapshot|queueTripSync\(/);
});
