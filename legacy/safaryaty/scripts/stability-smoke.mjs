import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculate } from '../src/engine.js';
import { buildPaymentSchedule, splitPayments } from '../src/payments.js';
import { canTravel } from '../src/canTravel.js';

const requiredFiles = [
  'src/main.jsx',
  'src/engine.js',
  'src/payments.js',
  'src/canTravel.js',
  'src/api.js',
  'backend/src/app.ts',
  'backend/prisma/schema.prisma',
  'scripts/run-backend-windows.ps1',
  'scripts/run-frontend-windows.ps1',
  'scripts/run-backend-mac.sh',
  'scripts/run-frontend-mac.sh'
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(file), `Missing required file: ${file}`);
}

const studyTrip = {
  name: 'Study Smoke Test',
  tripPurpose: 'Study Trip',
  tripType: 'Study Trip',
  travelStyle: 'Budget',
  startDate: '2026-09-01',
  endDate: '2027-02-28',
  baseCurrency: 'AED',
  tripCurrency: 'EUR',
  displayCurrency: 'EUR',
  exchangeRate: 0.25,
  rateNeedsReview: false,
  startingSavingsBase: 10000,
  supportLocal: 0,
  scenario: { reserveAfterTripBase: true, reserveAmountBase: 1000 },
  incomeSources: [],
  lifeCosts: [{ id: 'family', enabled: true, name: 'Family Support', amountBase: 500, frequency: 'monthly', nextDate: '2026-09-01', untilDate: '2027-02-28' }],
  installments: [{ id: 'tabby', enabled: true, name: 'Tabby', monthlyBase: 250, frequency: 'monthly', remainingMonths: 3, nextDate: '2026-09-01' }],
  budget: [
    { id: 'rent', name: 'Student Accommodation / Month', amountLocal: 600, frequency: 'monthly', costType: 'MONTHLY', priority: 'Must' },
    { id: 'food', name: 'Food / Month', amountLocal: 300, frequency: 'monthly', costType: 'MONTHLY', priority: 'Must' },
    { id: 'visa', name: 'Visa & Documents', amountLocal: 250, frequency: 'one-time', costType: 'ONE_TIME', priority: 'Must' }
  ],
  paidPayments: { 'cost-rent-0': true }
};

const calc = calculate(studyTrip);
assert.equal(calc.plannedLocal, (600 * 6) + (300 * 6) + 250, 'Monthly study costs must multiply by months');
assert.equal(calc.paidTripLocal, 600, 'One paid rent occurrence should count once');

const schedule = splitPayments(buildPaymentSchedule(studyTrip));
assert.ok(schedule.upcoming.some(row => row.group === 'installment'), 'Installments must remain in To Pay schedule');
assert.ok(schedule.paid.some(row => row.id === 'cost-rent-0'), 'Paid occurrence must appear in paid schedule');

const verdict = canTravel(studyTrip, calc);
assert.ok(['READY','ALMOST','TIGHT','RISKY','BLOCKED'].includes(verdict.verdict), 'Can Travel must return a valid verdict');

console.log('✅ Stability smoke passed');
console.log(JSON.stringify({ readiness: calc.readiness, verdict: verdict.verdict, plannedLocal: calc.plannedLocal, paidTripLocal: calc.paidTripLocal, upcoming: schedule.upcoming.length, paid: schedule.paid.length }, null, 2));
