import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tripProfileSchema,
  tripTravelStyleSchema,
  tripTravelerProfileSchema,
} from '../packages/api-contracts/src/index.ts';
import {
  calculateTripFit,
  type TripFitInput,
} from '../apps/mobile/src/features/trip-profile/trip-fit-engine.ts';
import {
  getTravelStyleProviderHints,
  TRAVEL_STYLE_ORDER,
} from '../apps/mobile/src/features/trip-profile/travel-style.ts';

test('trip profile defaults to Smart, one adult and unconfirmed style', () => {
  const profile = tripProfileSchema.parse({});

  assert.equal(
    profile.travelStyle,
    'smart',
  );
  assert.equal(
    profile.travelStyleConfirmed,
    false,
  );
  assert.equal(
    profile.travelers.adults,
    1,
  );
  assert.equal(
    profile.travelers.children,
    0,
  );
});

test('travel style accepts only the four product levels', () => {
  assert.deepEqual(
    TRAVEL_STYLE_ORDER,
    [
      'budget',
      'smart',
      'comfort',
      'premium',
    ],
  );

  assert.equal(
    tripTravelStyleSchema.safeParse(
      'ultra-luxury',
    ).success,
    false,
  );
});

test('traveler profile requires at least one adult', () => {
  assert.equal(
    tripTravelerProfileSchema.safeParse({
      adults: 0,
      children: 0,
    }).success,
    false,
  );
});

test('provider hints are categorical and never pretend to be live prices', () => {
  const budget =
    getTravelStyleProviderHints(
      'budget',
    );
  const premium =
    getTravelStyleProviderHints(
      'premium',
    );

  assert.equal(
    budget.accommodationTier,
    'hostel-basic',
  );
  assert.equal(
    premium.accommodationTier,
    'premium',
  );

  assert.equal(
    Object.values(budget).some(
      (value) =>
        typeof value === 'number',
    ),
    false,
  );
});

function baseFit(
  overrides: Partial<TripFitInput> = {},
): TripFitInput {
  return {
    preferredStyle: 'smart',
    readyMoney: 5000,
    totalCost: 3600,
    needToSave: 0,
    safetyReserve: 1000,
    overdueAmount: 0,
    bookingCoverage: 100,
    planProgress: 100,
    hasMarketStyleEstimate: false,
    ...overrides,
  };
}

test('a fully covered known plan can be Strong', () => {
  const result =
    calculateTripFit(baseFit());

  assert.equal(result.status, 'strong');
  assert.equal(result.score, 100);
});

test('funding gap and overdue obligations lower Trip Fit deterministically', () => {
  const healthy =
    calculateTripFit(baseFit());

  const pressured = calculateTripFit(
    baseFit({
      needToSave: 1200,
      overdueAmount: 625,
      bookingCoverage: 70,
    }),
  );

  assert.ok(
    pressured.score !== null &&
      healthy.score !== null &&
      pressured.score <
        healthy.score,
  );

  assert.ok(
    pressured.reasons.includes(
      'funding-gap',
    ),
  );
  assert.ok(
    pressured.reasons.includes(
      'overdue-obligation',
    ),
  );
});

test('chosen Travel Style is preserved and never silently downgraded', () => {
  const result = calculateTripFit(
    baseFit({
      preferredStyle: 'premium',
      needToSave: 1800,
    }),
  );

  assert.equal(
    result.preferredStyle,
    'premium',
  );
  assert.equal(
    result.affordableStyle,
    null,
  );
});

test('affordable style stays unknown until comparable market estimates exist', () => {
  const result =
    calculateTripFit(baseFit());

  assert.equal(
    result.affordableStyle,
    null,
  );
  assert.equal(
    result.styleAssessment,
    'pending-market-data',
  );
});

test('Trip Fit stays bounded and finite across 10,000 synthetic states', () => {
  for (let index = 0; index < 10_000; index += 1) {
    const totalCost =
      100 + (index % 9_000);
    const readyMoney =
      (index * 73) % 12_000;
    const needToSave =
      Math.max(
        0,
        totalCost - readyMoney,
      );

    const result = calculateTripFit({
      preferredStyle:
        TRAVEL_STYLE_ORDER[
          index %
            TRAVEL_STYLE_ORDER.length
        ],
      readyMoney,
      totalCost,
      needToSave,
      safetyReserve:
        (index * 17) % 2_500,
      overdueAmount:
        index % 7 === 0
          ? 625
          : 0,
      bookingCoverage:
        (index * 19) % 101,
      planProgress:
        (index * 23) % 101,
      hasMarketStyleEstimate:
        index % 2 === 0,
    });

    assert.notEqual(
      result.score,
      null,
    );

    assert.ok(
      Number.isFinite(
        result.score as number,
      ),
    );

    assert.ok(
      (result.score as number) >= 0 &&
        (result.score as number) <= 100,
    );
  }
});
