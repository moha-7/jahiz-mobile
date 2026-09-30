import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRateToBook,
  buildCurrencyContext,
  convertFromBook,
  convertIncomeCurrencyValues,
  convertTripCurrencyValues,
  currencyPairKey,
  incomeToTrip,
  rateFromBook,
  tripToDisplay,
  tripToIncome
} from '../shared/currency-domain.js';

test('currency domain stores direct and inverse rates once', () => {
  const book = addRateToBook({}, 'AED', 'EGP', 13.6699);
  assert.equal(currencyPairKey('aed', 'egp'), 'AED_EGP');
  assert.equal(rateFromBook(book, 'AED', 'EGP'), 13.6699);
  assert.ok(Math.abs(rateFromBook(book, 'EGP', 'AED') - (1 / 13.6699)) < 1e-12);
});

test('missing cross-rate never silently copies the raw number', () => {
  assert.equal(convertFromBook(100, 'GEL', 'EUR', {}), null);
});

test('plan calculations use only the selected income-to-trip rate', () => {
  const context = buildCurrencyContext({ incomeCurrency: 'AED', tripCurrency: 'EGP', exchangeRate: 13.6699 });
  const local = incomeToTrip(1400, context);
  const back = tripToIncome(local, context);
  assert.ok(Math.abs(local - 19137.86) < 0.01);
  assert.ok(Math.abs(back - 1400) < 0.000001);
});

test('display conversion is separate from the planning rate', () => {
  let rateBook = addRateToBook({}, 'AED', 'EGP', 13.6699);
  rateBook = addRateToBook(rateBook, 'EGP', 'USD', 0.0206);
  const context = buildCurrencyContext({ incomeCurrency: 'AED', tripCurrency: 'EGP', displayCurrency: 'USD', exchangeRate: 13.6699, rateBook });
  assert.equal(context.planRate, 13.6699);
  assert.equal(context.displayCurrency, 'USD');
  assert.ok(Math.abs(tripToDisplay(10000, context) - 206) < 0.000001);
});

test('unsupported display currency safely falls back to trip currency', () => {
  const context = buildCurrencyContext({ incomeCurrency: 'AED', tripCurrency: 'EGP', displayCurrency: 'JPY', exchangeRate: 13.6699, rateBook: {} });
  assert.equal(context.displayCurrency, 'EGP');
  assert.equal(tripToDisplay(500, context), 500);
});

test('trip and income currency value conversion preserves economic value', () => {
  const tripValues = convertTripCurrencyValues({
    oldTripToNewTripRate: 0.0206,
    supportLocal: 1000,
    budget: [{ id: 'food', amountLocal: 5000 }, { id: 'hotel', amountLocal: 12000 }]
  });
  assert.equal(tripValues.supportLocal, 20.6);
  assert.equal(tripValues.budget[0].amountLocal, 103);
  assert.equal(tripValues.budget[1].amountLocal, 247.2);

  const incomeValues = convertIncomeCurrencyValues({
    oldIncomeToNewIncomeRate: 0.2723,
    startingSavingsBase: 1400,
    reserveAmountBase: 500,
    incomeSources: [{ amountBase: 3000 }],
    lifeCosts: [{ amountBase: 800 }],
    installments: [{ monthlyBase: 400 }]
  });
  assert.equal(incomeValues.startingSavingsBase, 381.22);
  assert.equal(incomeValues.reserveAmountBase, 136.15);
  assert.equal(incomeValues.incomeSources[0].amountBase, 816.9);
  assert.equal(incomeValues.lifeCosts[0].amountBase, 217.84);
  assert.equal(incomeValues.installments[0].monthlyBase, 108.92);
});

test('same-currency value migration is an identity operation', () => {
  const tripValues = convertTripCurrencyValues({ oldTripToNewTripRate: 1, supportLocal: 55.5, budget: [{ amountLocal: 10.25 }] });
  const incomeValues = convertIncomeCurrencyValues({ oldIncomeToNewIncomeRate: 1, startingSavingsBase: 500, reserveAmountBase: 20, incomeSources: [{ amountBase: 100 }], lifeCosts: [{ amountBase: 25 }], installments: [{ monthlyBase: 75 }] });
  assert.deepEqual(tripValues, { supportLocal: 55.5, budget: [{ amountLocal: 10.25 }] });
  assert.equal(incomeValues.startingSavingsBase, 500);
  assert.equal(incomeValues.installments[0].monthlyBase, 75);
});

test('round-trip migration retains economic value within money precision', () => {
  const toUsd = convertTripCurrencyValues({ oldTripToNewTripRate: 0.0206, supportLocal: 1000, budget: [{ amountLocal: 5000 }] });
  const backToEgp = convertTripCurrencyValues({ oldTripToNewTripRate: 1 / 0.0206, supportLocal: toUsd.supportLocal, budget: toUsd.budget });
  assert.ok(Math.abs(backToEgp.supportLocal - 1000) <= 0.01);
  assert.ok(Math.abs(backToEgp.budget[0].amountLocal - 5000) <= 0.25);
});
