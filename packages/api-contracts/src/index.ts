import { z } from 'zod';

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const airportCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);

export const airportDirectoryItemSchema = z.object({
  countryCode: countryCodeSchema,
  countryName: z.string().min(1),
  countryNameAr: z.string().min(1),
  cityName: z.string().min(1),
  cityNameAr: z.string().min(1),
  airportCode: airportCodeSchema,
  airportName: z.string().min(1),
  airportNameAr: z.string().min(1),
  currency: currencyCodeSchema,
});

export const airportDirectorySchema = z.array(airportDirectoryItemSchema).min(1);

export const locationSelectionSchema = z.object({
  countryCode: countryCodeSchema,
  countryName: z.string().min(1),
  cityName: z.string().min(1),
  airportCode: airportCodeSchema,
  airportName: z.string().min(1),
  currency: currencyCodeSchema,
});

export const createTripRouteRequestSchema = z
  .object({
    origin: locationSelectionSchema,
    destination: locationSelectionSchema,
  })
  .superRefine((value, context) => {
    if (value.origin.airportCode === value.destination.airportCode) {
      context.addIssue({
        code: 'custom',
        path: ['destination', 'airportCode'],
        message: 'Origin and destination must be different.',
      });
    }
  });

export const createTripRouteResponseSchema = z.object({
  tripId: z.string().min(1),
  route: createTripRouteRequestSchema,
  detectedCurrencies: z.object({
    origin: currencyCodeSchema,
    destination: currencyCodeSchema,
  }),
  savedAt: z.string().datetime(),
});

export const externalEstimateSchema = z.object({
  value: z.number().nonnegative(),
  currency: currencyCodeSchema,
  source: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  fetchedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  range: z
    .object({
      low: z.number().nonnegative(),
      typical: z.number().nonnegative(),
      high: z.number().nonnegative(),
    })
    .optional(),
});

export type AirportDirectoryItem = z.infer<typeof airportDirectoryItemSchema>;
export type LocationSelection = z.infer<typeof locationSelectionSchema>;
export type CreateTripRouteRequest = z.infer<typeof createTripRouteRequestSchema>;
export type CreateTripRouteResponse = z.infer<typeof createTripRouteResponseSchema>;
export type ExternalEstimate = z.infer<typeof externalEstimateSchema>;

// -----------------------------------------------------------------------------
// Jahiz alpha.5 — Trip Workspace Foundation
// All monetary values are normalized to the workspace currency before storage.
// -----------------------------------------------------------------------------

export const tripWorkspaceVersionSchema = z.literal(1);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Expected a valid ISO calendar date.');

export const moneyAmountSchema = z
  .number()
  .finite()
  .nonnegative()
  .multipleOf(0.01);

export const tripStepKeySchema = z.enum([
  'route',
  'dates',
  'funds',
  'commitments',
  'costs',
  'payments',
  'review',
]);

export const tripStepStatusSchema = z.enum([
  'complete',
  'incomplete',
  'needs_review',
  'optional',
  'attention',
]);

export const tripCostCategoryIdSchema = z.enum([
  'cat-flight',
  'cat-accommodation',
  'cat-visa',
  'cat-transport',
  'cat-food',
  'cat-car',
  'cat-insurance',
  'cat-activities',
  'cat-shopping',
  'cat-emergency',
  'cat-other-trip',
]);

export const tripCostStatusSchema = z.enum([
  'estimated',
  'confirmed',
]);

export const tripPaymentStatusSchema = z.enum([
  'paid',
  'scheduled',
  'cancelled',
]);


export const tripTravelStyleSchema = z.enum([
  'budget',
  'smart',
  'comfort',
  'premium',
]);

export const tripPurposeSchema = z.enum([
  'leisure',
  'business',
  'family-visit',
  'event',
  'other',
]);

export const tripTravelerProfileSchema = z.object({
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(9),
});

export const tripProfileSchema = z.object({
  travelStyle: tripTravelStyleSchema.default('smart'),
  travelStyleConfirmed: z.boolean().default(false),
  purpose: tripPurposeSchema.default('leisure'),
  travelers: tripTravelerProfileSchema.default({
    adults: 1,
    children: 0,
  }),
});
export const tripDatesSchema = z
  .object({
    departureDate: isoDateSchema.nullable(),
    returnDate: isoDateSchema.nullable(),
    flexibility: z.enum(['fixed', 'flexible']),
  })
  .superRefine((value, context) => {
    if (
      value.departureDate &&
      value.returnDate &&
      value.returnDate < value.departureDate
    ) {
      context.addIssue({
        code: 'custom',
        path: ['returnDate'],
        message: 'Return date must be on or after departure date.',
      });
    }
  });

export const tripFundsSchema = z.object({
  availableNow: moneyAmountSchema.nullable(),
  expectedBeforeTravel: moneyAmountSchema,
  expectedAfterTravel: moneyAmountSchema.default(0),
  safetyReserve: moneyAmountSchema,
  originCommitments: moneyAmountSchema,
});

export const tripMoneyInCategoryIdSchema = z.enum([
  'money-in-savings',
  'money-in-salary',
  'money-in-freelance-business',
  'money-in-family-support',
  'money-in-bonus-commission',
  'money-in-refund',
  'money-in-asset-sale',
  'money-in-other',
]);

export const tripMoneyInAvailabilitySchema = z.enum([
  'available-now',
  'expected',
]);

export const tripMoneyInExpectedTimingSchema = z.enum([
  'before-travel',
  'after-travel',
]);

export const tripMoneyInCertaintySchema = z.enum([
  'guaranteed',
  'non-guaranteed',
]);

// Optional recurring salary metadata.
// Alpha keeps recurrence intentionally narrow: monthly salary only.
// This is enough for deterministic trip-date scenarios without turning
// Money In into a general budgeting engine.
export const tripMoneyInMonthlyRecurrenceSchema = z.object({
  cadence: z.literal('monthly'),
  nextDate: isoDateSchema,
});

export const tripMoneyInItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    categoryId: tripMoneyInCategoryIdSchema,
    amount: moneyAmountSchema.positive(),
    currency: currencyCodeSchema,
    availability: tripMoneyInAvailabilitySchema,
    expectedTiming: tripMoneyInExpectedTimingSchema.nullable(),
    expectedDate: isoDateSchema.nullable(),
    certainty: tripMoneyInCertaintySchema,
    recurrence:
      tripMoneyInMonthlyRecurrenceSchema.optional(),
    includeInReadiness: z.boolean(),
    notes: z.string().trim().max(500).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    const recurrence =
      value.recurrence;

    if (
      recurrence !== undefined &&
      value.categoryId !== 'money-in-salary'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['recurrence'],
        message:
          'Monthly recurrence is currently supported only for salary.',
      });
    }

    if (
      recurrence !== undefined &&
      value.expectedDate !== null &&
      value.expectedDate !== recurrence.nextDate
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expectedDate'],
        message:
          'Expected date must match the recurring salary next date.',
      });
    }

    if (value.availability === 'available-now') {
      if (value.expectedTiming !== null) {
        context.addIssue({
          code: 'custom',
          path: ['expectedTiming'],
          message: 'Available money cannot have expected timing.',
        });
      }

      if (value.expectedDate !== null) {
        context.addIssue({
          code: 'custom',
          path: ['expectedDate'],
          message: 'Available money cannot have an expected date.',
        });
      }
    }

    if (
      value.availability === 'expected' &&
      value.expectedTiming === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expectedTiming'],
        message: 'Expected money requires before- or after-travel timing.',
      });
    }
  });

export const tripCommitmentCategoryIdSchema = z.enum([
  'commitment-rent',
  'commitment-car-installment',
  'commitment-credit-card',
  'commitment-bills',
  'commitment-family',
  'commitment-other',
]);

export const tripCommitmentStatusSchema = z.enum([
  'unpaid',
  'paid',
]);

export const tripCommitmentInstallmentCadenceSchema = z.enum([
  'monthly',
  'biweekly',
]);

// A recurring commitment is a logical obligation plan.
// It is intentionally separate from finite installment plans.
export const tripCommitmentMonthlyRecurrenceSchema =
  z.object({
    cadence: z.literal('monthly'),
    firstDueDate: isoDateSchema,

    // null means this monthly obligation is ongoing.
    // A known date stops future scheduled occurrences.
    endDate:
      isoDateSchema
        .nullable()
        .default(null),
  });

// Presence in paidOccurrences means that exact occurrence was paid.
// Cash truth remains conservative until Money reflection is explicit.
export const tripRecurringCommitmentPaidOccurrenceSchema =
  z.object({
    dueDate: isoDateSchema,

    // Snapshot the amount for this exact occurrence.
    // Later edits to the recurring plan must never
    // rewrite historical paid cash truth.
    amount: moneyAmountSchema.positive(),

    paidAmountReflectedInMoney:
      z.boolean().default(false),
  });

export const tripRecurringCommitmentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    categoryId: tripCommitmentCategoryIdSchema,
    amount: moneyAmountSchema.positive(),
    currency: currencyCodeSchema,
    recurrence:
      tripCommitmentMonthlyRecurrenceSchema,
    paidOccurrences: z
      .array(
        tripRecurringCommitmentPaidOccurrenceSchema,
      )
      .default([]),
    notes: z.string().trim().max(500).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    const paidDates = new Set();

    if (
      value.recurrence.endDate !== null &&
      value.recurrence.endDate <
        value.recurrence.firstDueDate
    ) {
      context.addIssue({
        code: 'custom',
        path: [
          'recurrence',
          'endDate',
        ],
        message:
          'Recurring commitment end date cannot be before the first due date.',
      });
    }

    value.paidOccurrences.forEach(
      (occurrence, index) => {
        if (paidDates.has(occurrence.dueDate)) {
          context.addIssue({
            code: 'custom',
            path: [
              'paidOccurrences',
              index,
              'dueDate',
            ],
            message:
              'Recurring commitment paid occurrence dates must be unique.',
          });
        }

        paidDates.add(occurrence.dueDate);

        if (
          value.recurrence.endDate !== null &&
          occurrence.dueDate >
            value.recurrence.endDate
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'paidOccurrences',
              index,
              'dueDate',
            ],
            message:
              'Paid occurrence cannot be after the recurring commitment end date.',
          });
        }

        if (
          !isMonthlyOccurrenceDate(
            value.recurrence.firstDueDate,
            occurrence.dueDate,
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'paidOccurrences',
              index,
              'dueDate',
            ],
            message:
              'Paid occurrence date must belong to the recurring monthly schedule.',
          });
        }
      },
    );
  });

export const tripCommitmentItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(120),
    categoryId: tripCommitmentCategoryIdSchema,
    amount: moneyAmountSchema.positive(),
    currency: currencyCodeSchema,
    dueDate: isoDateSchema.nullable(),
    dueBeforeTravel: z.boolean(),
    status: tripCommitmentStatusSchema,
    paidAmountReflectedInMoney: z.boolean().optional(),
    notes: z.string().trim().max(500).nullable(),
    installmentPlanId: z.string().min(1).optional(),
    installmentCadence:
      tripCommitmentInstallmentCadenceSchema.optional(),
    installmentNumber: z.number().int().min(1).optional(),
    installmentCount: z.number().int().min(2).max(24).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    const installmentValues = [
      value.installmentPlanId,
      value.installmentCadence,
      value.installmentNumber,
      value.installmentCount,
    ];
    const hasAnyInstallmentValue =
      installmentValues.some(
        (entry) => entry !== undefined,
      );
    const hasAllInstallmentValues =
      installmentValues.every(
        (entry) => entry !== undefined,
      );

    if (
      value.status === 'unpaid' &&
      value.paidAmountReflectedInMoney === true
    ) {
      context.addIssue({
        code: 'custom',
        path: ['paidAmountReflectedInMoney'],
        message:
          'Only paid commitments can mark their paid amount as reflected in Money.',
      });
    }

    if (
      hasAnyInstallmentValue &&
      !hasAllInstallmentValues
    ) {
      context.addIssue({
        code: 'custom',
        path: ['installmentPlanId'],
        message:
          'Commitment installment metadata must be complete.',
      });
    }

    if (
      value.installmentNumber !== undefined &&
      value.installmentCount !== undefined &&
      value.installmentNumber >
        value.installmentCount
    ) {
      context.addIssue({
        code: 'custom',
        path: ['installmentNumber'],
        message:
          'Installment number cannot exceed installment count.',
      });
    }
  });

export const tripCostItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  categoryId: tripCostCategoryIdSchema,
  amount: moneyAmountSchema.positive(),
  currency: currencyCodeSchema,
  status: tripCostStatusSchema,
  dueDate: isoDateSchema.nullable(),
  notes: z.string().trim().max(500).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tripPaymentSchema = z
  .object({
    id: z.string().min(1),
    costItemId: z.string().min(1),
    amount: moneyAmountSchema.positive(),
    currency: currencyCodeSchema,
    status: tripPaymentStatusSchema,
    paidAt: z.string().datetime().nullable(),
    dueDate: isoDateSchema.nullable(),
    method: z.string().trim().max(80).nullable(),
    notes: z.string().trim().max(500).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (value.status === 'paid' && !value.paidAt) {
      context.addIssue({
        code: 'custom',
        path: ['paidAt'],
        message: 'Paid payments require a paidAt timestamp.',
      });
    }

    if (value.status === 'scheduled' && !value.dueDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Scheduled payments require a due date.',
      });
    }
  });

export const tripWorkspaceSchema = z
  .object({
    id: z.string().min(1),
    version: tripWorkspaceVersionSchema,
    currency: currencyCodeSchema,
    route: createTripRouteRequestSchema.nullable(),
    dates: tripDatesSchema,
    profile: tripProfileSchema.optional(),
    funds: tripFundsSchema,
    moneyInItems: z.array(tripMoneyInItemSchema).default([]),
    moneyInReviewed: z.boolean().default(false),
    commitments: z.array(tripCommitmentItemSchema).default([]),
    recurringCommitments: z
      .array(tripRecurringCommitmentSchema)
      .default([]),
    commitmentsReviewed: z.boolean().default(false),
    // Optional for backward compatibility; anything except true is unreviewed.
    costsReviewed: z.boolean().optional(),
    costItems: z.array(tripCostItemSchema),
    payments: z.array(tripPaymentSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    const moneyInIds = new Set<string>();
    const commitmentIds = new Set<string>();
    const recurringCommitmentIds = new Set<string>();
    const costIds = new Set<string>();
    const paymentIds = new Set<string>();
    const costsById = new Map(
      value.costItems.map((item) => [item.id, item]),
    );
    const paidByCostId = new Map<string, number>();

    value.moneyInItems.forEach((item, index) => {
      if (moneyInIds.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['moneyInItems', index, 'id'],
          message: 'Money In item ids must be unique.',
        });
      }
      moneyInIds.add(item.id);

      if (item.currency !== value.currency) {
        context.addIssue({
          code: 'custom',
          path: ['moneyInItems', index, 'currency'],
          message: 'Money In items must use the workspace currency.',
        });
      }
    });

    value.commitments.forEach((item, index) => {
      if (commitmentIds.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['commitments', index, 'id'],
          message: 'Commitment item ids must be unique.',
        });
      }
      commitmentIds.add(item.id);

      if (item.currency !== value.currency) {
        context.addIssue({
          code: 'custom',
          path: ['commitments', index, 'currency'],
          message: 'Commitments must use the workspace currency.',
        });
      }
    });

    value.recurringCommitments.forEach(
      (item, index) => {
        if (
          recurringCommitmentIds.has(item.id)
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'recurringCommitments',
              index,
              'id',
            ],
            message:
              'Recurring commitment ids must be unique.',
          });
        }

        if (commitmentIds.has(item.id)) {
          context.addIssue({
            code: 'custom',
            path: [
              'recurringCommitments',
              index,
              'id',
            ],
            message:
              'Recurring and regular commitment ids must not collide.',
          });
        }

        recurringCommitmentIds.add(item.id);

        if (item.currency !== value.currency) {
          context.addIssue({
            code: 'custom',
            path: [
              'recurringCommitments',
              index,
              'currency',
            ],
            message:
              'Recurring commitments must use the workspace currency.',
          });
        }
      },
    );

    value.costItems.forEach((item, index) => {
      if (costIds.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['costItems', index, 'id'],
          message: 'Cost item ids must be unique.',
        });
      }
      costIds.add(item.id);

      if (item.currency !== value.currency) {
        context.addIssue({
          code: 'custom',
          path: ['costItems', index, 'currency'],
          message: 'Cost items must use the workspace currency.',
        });
      }
    });

    value.payments.forEach((payment, index) => {
      if (paymentIds.has(payment.id)) {
        context.addIssue({
          code: 'custom',
          path: ['payments', index, 'id'],
          message: 'Payment ids must be unique.',
        });
      }
      paymentIds.add(payment.id);

      const costItem = costsById.get(payment.costItemId);
      if (!costItem) {
        context.addIssue({
          code: 'custom',
          path: ['payments', index, 'costItemId'],
          message: 'Every payment must reference an existing cost item.',
        });
      }

      if (payment.currency !== value.currency) {
        context.addIssue({
          code: 'custom',
          path: ['payments', index, 'currency'],
          message: 'Payments must use the workspace currency.',
        });
      }

      if (payment.status === 'paid') {
        paidByCostId.set(
          payment.costItemId,
          (paidByCostId.get(payment.costItemId) ?? 0) + payment.amount,
        );
      }
    });

    for (const [costItemId, paidTotal] of paidByCostId) {
      const costItem = costsById.get(costItemId);
      if (costItem && paidTotal > costItem.amount) {
        context.addIssue({
          code: 'custom',
          path: ['payments'],
          message: `Paid total exceeds cost item ${costItemId}.`,
        });
      }
    }
  });

export type TripStepKey = z.infer<typeof tripStepKeySchema>;
export type TripStepStatus = z.infer<typeof tripStepStatusSchema>;
export type TripCostCategoryId = z.infer<typeof tripCostCategoryIdSchema>;
export type TripCostStatus = z.infer<typeof tripCostStatusSchema>;
export type TripPaymentStatus = z.infer<typeof tripPaymentStatusSchema>;
export type TripDates = z.infer<typeof tripDatesSchema>;
export type TripTravelStyle = z.infer<typeof tripTravelStyleSchema>;
export type TripPurpose = z.infer<typeof tripPurposeSchema>;
export type TripTravelerProfile = z.infer<typeof tripTravelerProfileSchema>;
export type TripProfile = z.infer<typeof tripProfileSchema>;
export type TripFunds = z.infer<typeof tripFundsSchema>;
export type TripMoneyInCategoryId = z.infer<
  typeof tripMoneyInCategoryIdSchema
>;
export type TripMoneyInAvailability = z.infer<
  typeof tripMoneyInAvailabilitySchema
>;
export type TripMoneyInExpectedTiming = z.infer<
  typeof tripMoneyInExpectedTimingSchema
>;
export type TripMoneyInCertainty = z.infer<
  typeof tripMoneyInCertaintySchema
>;
export type TripMoneyInMonthlyRecurrence = z.infer<
  typeof tripMoneyInMonthlyRecurrenceSchema
>;
export type TripMoneyInItem = z.infer<typeof tripMoneyInItemSchema>;

export function normalizeMoneySourceName(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

export function isDuplicateMoneySource(
  items: readonly TripMoneyInItem[],
  candidate: Pick<
    TripMoneyInItem,
    'categoryId' | 'title'
  >,
  excludeId?: string,
): boolean {
  const normalizedTitle =
    normalizeMoneySourceName(
      candidate.title,
    );

  return items.some(
    (item) =>
      item.id !== excludeId &&
      item.categoryId ===
        candidate.categoryId &&
      normalizeMoneySourceName(
        item.title,
      ) === normalizedTitle,
  );
}
export type TripCommitmentCategoryId = z.infer<
  typeof tripCommitmentCategoryIdSchema
>;
export type TripCommitmentStatus = z.infer<
  typeof tripCommitmentStatusSchema
>;
export type TripCommitmentInstallmentCadence = z.infer<
  typeof tripCommitmentInstallmentCadenceSchema
>;
export type TripCommitmentItem = z.infer<
  typeof tripCommitmentItemSchema
>;
export type TripCommitmentMonthlyRecurrence = z.infer<
  typeof tripCommitmentMonthlyRecurrenceSchema
>;
export type TripRecurringCommitmentPaidOccurrence = z.infer<
  typeof tripRecurringCommitmentPaidOccurrenceSchema
>;
export type TripRecurringCommitment = z.infer<
  typeof tripRecurringCommitmentSchema
>;
export type TripCostItem = z.infer<typeof tripCostItemSchema>;
export type TripPayment = z.infer<typeof tripPaymentSchema>;
export type TripWorkspace = z.infer<typeof tripWorkspaceSchema>;


// -----------------------------------------------------------------------------
// Jahiz Financial Timeline Foundation M5A
//
// The timeline is deterministic truth infrastructure. It does not replace
// Ready Money or price a moved trip. It only normalizes known user-entered
// cash-flow events against a date window so scenario/recommendation layers can
// reason without asking an LLM to calculate money.
//
// Unknown rule: a moved trip is never assumed to keep the same travel prices.
// Scenario comparisons explicitly flag trip-cost repricing when costs exist.
// -----------------------------------------------------------------------------

export const financialTimelineTimingSchema = z.enum([
  'before-trip',
  'during-trip',
  'after-trip',
  'undated',
]);

export const financialTimelineDirectionSchema = z.enum([
  'inflow',
  'outflow',
]);

export const financialTimelineEventKindSchema = z.enum([
  'money-in',
  'commitment',
  'scheduled-payment',
]);

export const financialTimelineDateConfidenceSchema = z.enum([
  'exact',
  'window-only',
  'on-hand',
]);

export const financialTimelineEventSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  kind: financialTimelineEventKindSchema,
  direction: financialTimelineDirectionSchema,
  title: z.string().trim().min(1),
  amount: moneyAmountSchema.positive(),
  currency: currencyCodeSchema,
  date: isoDateSchema.nullable(),
  timing: financialTimelineTimingSchema,
  dateConfidence: financialTimelineDateConfidenceSchema,
  recurrenceIndex: z.number().int().min(1).nullable(),
});

export const financialTimelineSummarySchema = z.object({
  inflowBeforeTrip: moneyAmountSchema,
  outflowBeforeTrip: moneyAmountSchema,
  netBeforeTrip: z.number().finite().multipleOf(0.01),
  inflowDuringTrip: moneyAmountSchema,
  outflowDuringTrip: moneyAmountSchema,
  netDuringTrip: z.number().finite().multipleOf(0.01),
  exactEventCount: z.number().int().nonnegative(),
  windowOnlyEventCount: z.number().int().nonnegative(),
});

export const financialScenarioUnknownSchema = z.enum([
  'trip-cost-repricing',
]);

export const financialScenarioComparisonSchema = z.object({
  current: financialTimelineSummarySchema,
  proposed: financialTimelineSummarySchema,
  deltaInflowBeforeTrip: z.number().finite().multipleOf(0.01),
  deltaOutflowBeforeTrip: z.number().finite().multipleOf(0.01),
  deltaNetBeforeTrip: z.number().finite().multipleOf(0.01),
  unknowns: z.array(financialScenarioUnknownSchema),
});

export type FinancialTimelineTiming = z.infer<
  typeof financialTimelineTimingSchema
>;
export type FinancialTimelineDirection = z.infer<
  typeof financialTimelineDirectionSchema
>;
export type FinancialTimelineEventKind = z.infer<
  typeof financialTimelineEventKindSchema
>;
export type FinancialTimelineDateConfidence = z.infer<
  typeof financialTimelineDateConfidenceSchema
>;
export type FinancialTimelineEvent = z.infer<
  typeof financialTimelineEventSchema
>;
export type FinancialTimelineSummary = z.infer<
  typeof financialTimelineSummarySchema
>;
export type FinancialScenarioUnknown = z.infer<
  typeof financialScenarioUnknownSchema
>;
export type FinancialScenarioComparison = z.infer<
  typeof financialScenarioComparisonSchema
>;

export type FinancialTimelineDates = {
  departureDate: string | null;
  returnDate: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysInUtcMonth(
  year: number,
  monthIndex: number,
): number {
  return new Date(
    Date.UTC(
      year,
      monthIndex + 1,
      0,
    ),
  ).getUTCDate();
}

export function addMonthsToIsoDateClamped(
  isoDate: string,
  months: number,
): string {
  const parsed = isoDateSchema.parse(
    isoDate,
  );

  if (
    !Number.isInteger(months) ||
    months < 0
  ) {
    throw new Error(
      'Month offset must be a non-negative integer.',
    );
  }

  const date = new Date(
    `${parsed}T00:00:00.000Z`,
  );
  const sourceDay = date.getUTCDate();
  const targetMonthIndex =
    date.getUTCMonth() + months;
  const targetYear =
    date.getUTCFullYear() +
    Math.floor(targetMonthIndex / 12);
  const normalizedMonth =
    ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    sourceDay,
    daysInUtcMonth(
      targetYear,
      normalizedMonth,
    ),
  );

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      targetDay,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export function expandMonthlyDates(
  nextDate: string,
  throughDate: string,
): string[] {
  const start = isoDateSchema.parse(
    nextDate,
  );
  const end = isoDateSchema.parse(
    throughDate,
  );

  if (start > end) {
    return [];
  }

  const dates: string[] = [];

  for (
    let offset = 0;
    offset < 240;
    offset += 1
  ) {
    const occurrence =
      addMonthsToIsoDateClamped(
        start,
        offset,
      );

    if (occurrence > end) {
      break;
    }

    dates.push(occurrence);
  }

  return dates;
}

// Backward-compatible Money In API.
export function expandMonthlyMoneyDates(
  nextDate: string,
  throughDate: string,
): string[] {
  return expandMonthlyDates(
    nextDate,
    throughDate,
  );
}

export function isMonthlyOccurrenceDate(
  firstDueDate: string,
  occurrenceDate: string,
): boolean {
  const first =
    isoDateSchema.parse(firstDueDate);
  const occurrence =
    isoDateSchema.parse(occurrenceDate);

  if (occurrence < first) {
    return false;
  }

  return expandMonthlyDates(
    first,
    occurrence,
  ).includes(occurrence);
}

export function classifyTripDateTiming(
  date: string | null,
  fallbackTiming:
    | 'before-trip'
    | 'after-trip'
    | 'undated',
  dates: FinancialTimelineDates,
): FinancialTimelineTiming {
  if (!date) {
    return fallbackTiming;
  }

  const parsed =
    isoDateSchema.parse(date);
  const departureDate =
    dates.departureDate
      ? isoDateSchema.parse(
          dates.departureDate,
        )
      : null;
  const returnDate =
    dates.returnDate
      ? isoDateSchema.parse(
          dates.returnDate,
        )
      : null;

  if (
    departureDate &&
    parsed <= departureDate
  ) {
    return 'before-trip';
  }

  if (
    departureDate &&
    (
      returnDate === null ||
      parsed <= returnDate
    )
  ) {
    return 'during-trip';
  }

  if (
    returnDate &&
    parsed > returnDate
  ) {
    return 'after-trip';
  }

  if (
    departureDate &&
    parsed > departureDate
  ) {
    return 'during-trip';
  }

  return fallbackTiming;
}

function resolveTimelineDates(
  workspace: TripWorkspace,
  override?: Partial<FinancialTimelineDates>,
): FinancialTimelineDates {
  const departureDate =
    override?.departureDate === undefined
      ? workspace.dates.departureDate
      : override.departureDate;
  const returnDate =
    override?.returnDate === undefined
      ? workspace.dates.returnDate
      : override.returnDate;

  if (
    departureDate &&
    returnDate &&
    returnDate < departureDate
  ) {
    throw new Error(
      'Scenario return date cannot be before departure date.',
    );
  }

  return {
    departureDate:
      departureDate
        ? isoDateSchema.parse(
            departureDate,
          )
        : null,
    returnDate:
      returnDate
        ? isoDateSchema.parse(
            returnDate,
          )
        : null,
  };
}

export function buildFinancialTimeline(
  workspaceInput: TripWorkspace,
  override?: Partial<FinancialTimelineDates>,
): FinancialTimelineEvent[] {
  const workspace =
    tripWorkspaceSchema.parse(
      workspaceInput,
    );
  const dates = resolveTimelineDates(
    workspace,
    override,
  );
  const events: FinancialTimelineEvent[] = [];

  workspace.moneyInItems.forEach(
    (item) => {
      if (!item.includeInReadiness) {
        return;
      }

      if (item.recurrence) {
        // A recurring salary models future paydays starting at nextDate.
        // Money already on hand must be represented as a separate
        // available-now source so the same salary amount cannot be counted
        // once as cash today and again as the next payday.
        const horizon =
          dates.returnDate ??
          dates.departureDate;

        if (!horizon) {
          return;
        }

        const occurrences =
          expandMonthlyMoneyDates(
            item.recurrence.nextDate,
            horizon,
          );

        occurrences.forEach(
          (date, index) => {
            events.push(
              financialTimelineEventSchema.parse({
                id:
                  `${item.id}:monthly:${index + 1}`,
                sourceId: item.id,
                kind: 'money-in',
                direction: 'inflow',
                title: item.title,
                amount: item.amount,
                currency: item.currency,
                date,
                timing:
                  classifyTripDateTiming(
                    date,
                    'undated',
                    dates,
                  ),
                dateConfidence: 'exact',
                recurrenceIndex:
                  index + 1,
              }),
            );
          },
        );

        return;
      }

      if (
        item.availability ===
        'available-now'
      ) {
        events.push(
          financialTimelineEventSchema.parse({
            id: `${item.id}:on-hand`,
            sourceId: item.id,
            kind: 'money-in',
            direction: 'inflow',
            title: item.title,
            amount: item.amount,
            currency: item.currency,
            date: null,
            timing: 'before-trip',
            dateConfidence: 'on-hand',
            recurrenceIndex: null,
          }),
        );
        return;
      }

      const fallbackTiming =
        item.expectedTiming ===
        'before-travel'
          ? 'before-trip'
          : item.expectedTiming ===
              'after-travel'
            ? 'after-trip'
            : 'undated';

      events.push(
        financialTimelineEventSchema.parse({
          id: `${item.id}:expected`,
          sourceId: item.id,
          kind: 'money-in',
          direction: 'inflow',
          title: item.title,
          amount: item.amount,
          currency: item.currency,
          date: item.expectedDate,
          timing:
            classifyTripDateTiming(
              item.expectedDate,
              fallbackTiming,
              dates,
            ),
          dateConfidence:
            item.expectedDate
              ? 'exact'
              : 'window-only',
          recurrenceIndex: null,
        }),
      );
    },
  );

  workspace.commitments.forEach(
    (item) => {
      const paidCashEffectPending =
        item.status === 'paid' &&
        item.paidAmountReflectedInMoney !== true;

      if (
        item.status === 'paid' &&
        !paidCashEffectPending
      ) {
        return;
      }

      const eventDate =
        paidCashEffectPending
          ? null
          : item.dueDate;

      const fallbackTiming =
        paidCashEffectPending
          ? 'before-trip'
          : item.dueBeforeTravel
            ? 'before-trip'
            : 'undated';

      events.push(
        financialTimelineEventSchema.parse({
          id: `commitment:${item.id}`,
          sourceId: item.id,
          kind: 'commitment',
          direction: 'outflow',
          title: item.title,
          amount: item.amount,
          currency: item.currency,
          date: eventDate,
          timing:
            classifyTripDateTiming(
              eventDate,
              fallbackTiming,
              dates,
            ),
          dateConfidence:
            eventDate
              ? 'exact'
              : 'window-only',
          recurrenceIndex:
            item.installmentNumber ??
            null,
        }),
      );
    },
  );

  workspace.recurringCommitments.forEach(
    (item) => {
      const horizon =
        dates.returnDate ??
        dates.departureDate;

      const paidByDate = new Map(
        item.paidOccurrences.map(
          (occurrence) => [
            occurrence.dueDate,
            occurrence,
          ],
        ),
      );

      const furthestPaidDate =
        item.paidOccurrences
          .map(
            (occurrence) =>
              occurrence.dueDate,
          )
          .sort()
          .at(-1) ??
        null;

      const expansionHorizon = [
        horizon,
        furthestPaidDate,
        item.recurrence.firstDueDate,
      ]
        .filter(
          (value): value is string =>
            value !== null,
        )
        .sort()
        .at(-1);

      if (!expansionHorizon) {
        return;
      }

      const occurrences =
        expandMonthlyDates(
          item.recurrence.firstDueDate,
          expansionHorizon,
        );

      occurrences.forEach(
        (date, index) => {
          const paidOccurrence =
            paidByDate.get(date);

          const paidCashEffectPending =
            paidOccurrence !== undefined &&
            paidOccurrence
              .paidAmountReflectedInMoney !==
              true;

          const withinTripHorizon =
            horizon !== null &&
            date <= horizon;

          const withinSeriesHorizon =
            item.recurrence.endDate ===
              null ||
            date <=
              item.recurrence.endDate;

          // Future recurring obligations outside
          // the active trip window do not affect
          // this trip unless already paid and the
          // cash effect has not been reconciled.
          if (
            (
              !withinTripHorizon ||
              !withinSeriesHorizon
            ) &&
            !paidCashEffectPending
          ) {
            return;
          }

          // Explicit Money reconciliation is the
          // only state that releases a paid amount
          // from readiness outflows.
          if (
            paidOccurrence
              ?.paidAmountReflectedInMoney ===
            true
          ) {
            return;
          }

          const eventDate =
            paidCashEffectPending
              ? null
              : date;

          const fallbackTiming =
            paidCashEffectPending
              ? 'before-trip'
              : 'undated';

          events.push(
            financialTimelineEventSchema.parse({
              id:
                `recurring-commitment:${item.id}:${date}`,
              sourceId: item.id,
              kind: 'commitment',
              direction: 'outflow',
              title: item.title,
              amount:
                paidOccurrence?.amount ??
                item.amount,
              currency: item.currency,
              date: eventDate,
              timing:
                classifyTripDateTiming(
                  eventDate,
                  fallbackTiming,
                  dates,
                ),
              dateConfidence:
                eventDate
                  ? 'exact'
                  : 'window-only',
              recurrenceIndex:
                index + 1,
            }),
          );
        },
      );
    },
  );

  workspace.payments.forEach(
    (payment) => {
      if (
        payment.status !==
        'scheduled'
      ) {
        return;
      }

      const costItem =
        workspace.costItems.find(
          (candidate) =>
            candidate.id ===
            payment.costItemId,
        );

      events.push(
        financialTimelineEventSchema.parse({
          id: `payment:${payment.id}`,
          sourceId: payment.id,
          kind: 'scheduled-payment',
          direction: 'outflow',
          title:
            costItem?.title ??
            'Scheduled payment',
          amount: payment.amount,
          currency: payment.currency,
          date: payment.dueDate,
          timing:
            classifyTripDateTiming(
              payment.dueDate,
              'undated',
              dates,
            ),
          dateConfidence:
            payment.dueDate
              ? 'exact'
              : 'window-only',
          recurrenceIndex: null,
        }),
      );
    },
  );

  return events.sort(
    (left, right) => {
      if (
        left.date === null &&
        right.date !== null
      ) {
        return -1;
      }

      if (
        left.date !== null &&
        right.date === null
      ) {
        return 1;
      }

      if (
        left.date !==
        right.date
      ) {
        return (
          left.date ?? ''
        ).localeCompare(
          right.date ?? '',
        );
      }

      return left.id.localeCompare(
        right.id,
      );
    },
  );
}

export function summarizeFinancialTimeline(
  eventsInput: FinancialTimelineEvent[],
): FinancialTimelineSummary {
  const events = z
    .array(
      financialTimelineEventSchema,
    )
    .parse(eventsInput);

  let inflowBeforeTrip = 0;
  let outflowBeforeTrip = 0;
  let inflowDuringTrip = 0;
  let outflowDuringTrip = 0;
  let exactEventCount = 0;
  let windowOnlyEventCount = 0;

  events.forEach((event) => {
    if (
      event.dateConfidence === 'exact'
    ) {
      exactEventCount += 1;
    }

    if (
      event.dateConfidence ===
      'window-only'
    ) {
      windowOnlyEventCount += 1;
    }

    if (
      event.timing === 'before-trip'
    ) {
      if (
        event.direction === 'inflow'
      ) {
        inflowBeforeTrip +=
          event.amount;
      } else {
        outflowBeforeTrip +=
          event.amount;
      }
    }

    if (
      event.timing === 'during-trip'
    ) {
      if (
        event.direction === 'inflow'
      ) {
        inflowDuringTrip +=
          event.amount;
      } else {
        outflowDuringTrip +=
          event.amount;
      }
    }
  });

  return financialTimelineSummarySchema.parse({
    inflowBeforeTrip:
      roundMoney(
        inflowBeforeTrip,
      ),
    outflowBeforeTrip:
      roundMoney(
        outflowBeforeTrip,
      ),
    netBeforeTrip:
      roundMoney(
        inflowBeforeTrip -
          outflowBeforeTrip,
      ),
    inflowDuringTrip:
      roundMoney(
        inflowDuringTrip,
      ),
    outflowDuringTrip:
      roundMoney(
        outflowDuringTrip,
      ),
    netDuringTrip:
      roundMoney(
        inflowDuringTrip -
          outflowDuringTrip,
      ),
    exactEventCount,
    windowOnlyEventCount,
  });
}

export function compareFinancialTimelineScenario(
  workspaceInput: TripWorkspace,
  proposedDates: FinancialTimelineDates,
): FinancialScenarioComparison {
  const workspace =
    tripWorkspaceSchema.parse(
      workspaceInput,
    );

  const current =
    summarizeFinancialTimeline(
      buildFinancialTimeline(
        workspace,
      ),
    );

  const proposed =
    summarizeFinancialTimeline(
      buildFinancialTimeline(
        workspace,
        proposedDates,
      ),
    );

  const unknowns:
    FinancialScenarioUnknown[] = [];

  if (workspace.costItems.length > 0) {
    unknowns.push(
      'trip-cost-repricing',
    );
  }

  return financialScenarioComparisonSchema.parse({
    current,
    proposed,
    deltaInflowBeforeTrip:
      roundMoney(
        proposed.inflowBeforeTrip -
          current.inflowBeforeTrip,
      ),
    deltaOutflowBeforeTrip:
      roundMoney(
        proposed.outflowBeforeTrip -
          current.outflowBeforeTrip,
      ),
    deltaNetBeforeTrip:
      roundMoney(
        proposed.netBeforeTrip -
          current.netBeforeTrip,
      ),
    unknowns,
  });
}


export type MoveTripRecommendationEvent = {
  id: string;
  kind: FinancialTimelineEventKind;
  title: string;
  amount: number;
  direction: FinancialTimelineDirection;
  date: string | null;
};

export type MoveTripRecommendationCandidate = {
  offsetDays: number;
  proposedDates: FinancialTimelineDates;
  comparison: FinancialScenarioComparison;
  addedBeforeTripEvents: MoveTripRecommendationEvent[];
  removedBeforeTripEvents: MoveTripRecommendationEvent[];
};

export type MoveTripRecommendation = {
  checkedOffsets: number[];
  best: MoveTripRecommendationCandidate | null;
  candidates: MoveTripRecommendationCandidate[];
};

function addDaysToIsoDate(
  isoDate: string,
  days: number,
): string {
  const parsed = isoDateSchema.parse(isoDate);

  if (
    !Number.isInteger(days) ||
    days < 0
  ) {
    throw new Error(
      'Day offset must be a non-negative integer.',
    );
  }

  const date = new Date(
    `${parsed}T00:00:00.000Z`,
  );

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function toRecommendationEvent(
  event: FinancialTimelineEvent,
): MoveTripRecommendationEvent {
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    amount: event.amount,
    direction: event.direction,
    date: event.date,
  };
}

export function buildMoveTripRecommendation(
  workspaceInput: TripWorkspace,
  offsetsInput: readonly number[] = [
    7,
    14,
    30,
  ],
  asOfDateInput?: string,
): MoveTripRecommendation {
  const workspace =
    tripWorkspaceSchema.parse(
      workspaceInput,
    );

  const departureDate =
    workspace.dates.departureDate;
  const returnDate =
    workspace.dates.returnDate;

  const checkedOffsets = Array.from(
    new Set(
      offsetsInput.map(
        (offset) => {
          if (
            !Number.isInteger(offset) ||
            offset <= 0 ||
            offset > 180
          ) {
            throw new Error(
              'Move-trip offsets must be whole days from 1 to 180.',
            );
          }

          return offset;
        },
      ),
    ),
  ).sort(
    (left, right) =>
      left - right,
  );

  const asOfDate =
    asOfDateInput
      ? isoDateSchema.parse(
          asOfDateInput,
        )
      : null;

  if (
    !departureDate ||
    !returnDate ||
    workspace.dates.flexibility !==
      'flexible' ||
    (
      asOfDate !== null &&
      departureDate <= asOfDate
    )
  ) {
    return {
      checkedOffsets,
      best: null,
      candidates: [],
    };
  }

  const currentTimeline =
    buildFinancialTimeline(
      workspace,
    );
  const currentBeforeIds =
    new Set(
      currentTimeline
        .filter(
          (event) =>
            event.timing ===
            'before-trip',
        )
        .map((event) => event.id),
    );

  const candidates =
    checkedOffsets.map(
      (offsetDays) => {
        const proposedDates = {
          departureDate:
            addDaysToIsoDate(
              departureDate,
              offsetDays,
            ),
          returnDate:
            addDaysToIsoDate(
              returnDate,
              offsetDays,
            ),
        };

        const proposedTimeline =
          buildFinancialTimeline(
            workspace,
            proposedDates,
          );
        const proposedBeforeIds =
          new Set(
            proposedTimeline
              .filter(
                (event) =>
                  event.timing ===
                  'before-trip',
              )
              .map(
                (event) =>
                  event.id,
              ),
          );

        const addedBeforeTripEvents =
          proposedTimeline
            .filter(
              (event) =>
                event.timing ===
                  'before-trip' &&
                !currentBeforeIds.has(
                  event.id,
                ),
            )
            .map(
              toRecommendationEvent,
            );

        const removedBeforeTripEvents =
          currentTimeline
            .filter(
              (event) =>
                event.timing ===
                  'before-trip' &&
                !proposedBeforeIds.has(
                  event.id,
                ),
            )
            .map(
              toRecommendationEvent,
            );

        return {
          offsetDays,
          proposedDates,
          comparison:
            compareFinancialTimelineScenario(
              workspace,
              proposedDates,
            ),
          addedBeforeTripEvents,
          removedBeforeTripEvents,
        };
      },
    );

  const ranked =
    candidates
      .slice()
      .sort(
        (left, right) => {
          const impact =
            right.comparison
              .deltaNetBeforeTrip -
            left.comparison
              .deltaNetBeforeTrip;

          if (impact !== 0) {
            return impact;
          }

          return (
            left.offsetDays -
            right.offsetDays
          );
        },
      );

  const best =
    ranked.find(
      (candidate) =>
        candidate.comparison
          .deltaNetBeforeTrip > 0,
    ) ?? null;

  return {
    checkedOffsets,
    best,
    candidates,
  };
}


// -----------------------------------------------------------------------------
// Jahiz Multi-trip Portfolio Foundation M1
// A portfolio owns multiple isolated TripWorkspace snapshots.
// The active trip is navigation state; financial truth remains inside each workspace.
// -----------------------------------------------------------------------------

export const tripPortfolioVersionSchema = z.literal(1);

export const tripLifecycleSchema = z.enum([
  'draft',
  'upcoming',
  'in-progress',
  'completed',
  'archived',
]);

export const tripRecordSchema = z.object({
  workspace: tripWorkspaceSchema,
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .nullable()
    .default(null),
  archivedAt: z
    .string()
    .datetime()
    .nullable()
    .default(null),
});

export const tripPortfolioSchema = z
  .object({
    version: tripPortfolioVersionSchema,
    activeTripId: z.string().min(1).nullable(),
    trips: z.array(tripRecordSchema),
  })
  .superRefine((value, context) => {
    const tripIds = new Set<string>();

    value.trips.forEach((record, index) => {
      const tripId = record.workspace.id;

      if (tripIds.has(tripId)) {
        context.addIssue({
          code: 'custom',
          path: ['trips', index, 'workspace', 'id'],
          message: 'Trip ids must be unique inside a portfolio.',
        });
      }

      tripIds.add(tripId);
    });

    const activeRecord =
      value.activeTripId === null
        ? null
        : value.trips.find(
            (record) =>
              record.workspace.id === value.activeTripId,
          ) ?? null;

    if (
      value.activeTripId !== null &&
      activeRecord === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['activeTripId'],
        message:
          'Active trip id must reference a trip in the portfolio.',
      });
    }

    if (activeRecord?.archivedAt) {
      context.addIssue({
        code: 'custom',
        path: ['activeTripId'],
        message: 'An archived trip cannot be active.',
      });
    }

    const hasUnarchivedTrip = value.trips.some(
      (record) => record.archivedAt === null,
    );

    if (
      hasUnarchivedTrip &&
      value.activeTripId === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['activeTripId'],
        message:
          'A portfolio with an unarchived trip requires an active trip.',
      });
    }

    if (
      !hasUnarchivedTrip &&
      value.activeTripId !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['activeTripId'],
        message:
          'A portfolio with only archived trips cannot have an active trip.',
      });
    }
  });

export type TripLifecycle = z.infer<
  typeof tripLifecycleSchema
>;
export type TripRecord = z.infer<
  typeof tripRecordSchema
>;
export type TripPortfolio = z.infer<
  typeof tripPortfolioSchema
>;

export function createTripRecord(
  workspace: TripWorkspace,
  name: string | null = null,
): TripRecord {
  return tripRecordSchema.parse({
    workspace,
    name,
    archivedAt: null,
  });
}

export function createTripPortfolioFromWorkspace(
  workspace: TripWorkspace,
  name: string | null = null,
): TripPortfolio {
  return tripPortfolioSchema.parse({
    version: 1,
    activeTripId: workspace.id,
    trips: [
      createTripRecord(
        workspace,
        name,
      ),
    ],
  });
}

export function selectActiveTripRecord(
  portfolio: TripPortfolio,
): TripRecord | null {
  if (!portfolio.activeTripId) {
    return null;
  }

  return (
    portfolio.trips.find(
      (record) =>
        record.workspace.id ===
        portfolio.activeTripId,
    ) ?? null
  );
}

export function selectUnarchivedTripRecords(
  portfolio: TripPortfolio,
): TripRecord[] {
  return portfolio.trips.filter(
    (record) => record.archivedAt === null,
  );
}

export function addTripToPortfolio(
  portfolio: TripPortfolio,
  workspace: TripWorkspace,
  name: string | null = null,
  makeActive = true,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);

  if (
    current.trips.some(
      (record) =>
        record.workspace.id === workspace.id,
    )
  ) {
    throw new Error(
      `Trip ${workspace.id} already exists in the portfolio.`,
    );
  }

  const record = createTripRecord(
    workspace,
    name,
  );

  return tripPortfolioSchema.parse({
    ...current,
    activeTripId:
      makeActive ||
      current.activeTripId === null
        ? workspace.id
        : current.activeTripId,
    trips: [
      ...current.trips,
      record,
    ],
  });
}

export function replaceTripWorkspace(
  portfolio: TripPortfolio,
  workspace: TripWorkspace,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);

  const index = current.trips.findIndex(
    (record) =>
      record.workspace.id === workspace.id,
  );

  if (index < 0) {
    throw new Error(
      `Trip ${workspace.id} does not exist in the portfolio.`,
    );
  }

  const trips = current.trips.map(
    (record, recordIndex) =>
      recordIndex === index
        ? {
            ...record,
            workspace:
              tripWorkspaceSchema.parse(
                workspace,
              ),
          }
        : record,
  );

  return tripPortfolioSchema.parse({
    ...current,
    trips,
  });
}

export function setActiveTrip(
  portfolio: TripPortfolio,
  tripId: string,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);

  const record = current.trips.find(
    (candidate) =>
      candidate.workspace.id === tripId,
  );

  if (!record) {
    throw new Error(
      `Trip ${tripId} does not exist in the portfolio.`,
    );
  }

  if (record.archivedAt) {
    throw new Error(
      `Trip ${tripId} is archived and cannot be active.`,
    );
  }

  return tripPortfolioSchema.parse({
    ...current,
    activeTripId: tripId,
  });
}

export function renameTripInPortfolio(
  portfolio: TripPortfolio,
  tripId: string,
  name: string | null,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);

  let found = false;

  const trips = current.trips.map(
    (record) => {
      if (
        record.workspace.id !== tripId
      ) {
        return record;
      }

      found = true;

      return tripRecordSchema.parse({
        ...record,
        name,
      });
    },
  );

  if (!found) {
    throw new Error(
      `Trip ${tripId} does not exist in the portfolio.`,
    );
  }

  return tripPortfolioSchema.parse({
    ...current,
    trips,
  });
}

export function archiveTripInPortfolio(
  portfolio: TripPortfolio,
  tripId: string,
  archivedAt: string,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);
  const archiveTime = z
    .string()
    .datetime()
    .parse(archivedAt);

  let found = false;

  const trips = current.trips.map(
    (record) => {
      if (
        record.workspace.id !== tripId
      ) {
        return record;
      }

      found = true;

      return tripRecordSchema.parse({
        ...record,
        archivedAt: archiveTime,
      });
    },
  );

  if (!found) {
    throw new Error(
      `Trip ${tripId} does not exist in the portfolio.`,
    );
  }

  let activeTripId =
    current.activeTripId;

  if (activeTripId === tripId) {
    activeTripId =
      trips.find(
        (record) =>
          record.archivedAt === null,
      )?.workspace.id ?? null;
  }

  return tripPortfolioSchema.parse({
    ...current,
    activeTripId,
    trips,
  });
}

export function restoreTripInPortfolio(
  portfolio: TripPortfolio,
  tripId: string,
): TripPortfolio {
  const current =
    tripPortfolioSchema.parse(portfolio);

  let found = false;

  const trips = current.trips.map(
    (record) => {
      if (
        record.workspace.id !== tripId
      ) {
        return record;
      }

      found = true;

      return tripRecordSchema.parse({
        ...record,
        archivedAt: null,
      });
    },
  );

  if (!found) {
    throw new Error(
      `Trip ${tripId} does not exist in the portfolio.`,
    );
  }

  return tripPortfolioSchema.parse({
    ...current,
    activeTripId:
      current.activeTripId ?? tripId,
    trips,
  });
}

export function deriveTripLifecycle(
  record: TripRecord,
  todayIso: string,
): TripLifecycle {
  const today = isoDateSchema.parse(
    todayIso,
  );

  if (record.archivedAt) {
    return 'archived';
  }

  const {
    departureDate,
    returnDate,
  } = record.workspace.dates;

  if (!departureDate) {
    return 'draft';
  }

  if (today < departureDate) {
    return 'upcoming';
  }

  if (
    returnDate &&
    today > returnDate
  ) {
    return 'completed';
  }

  return 'in-progress';
}

export function selectTripRouteLabel(
  record: TripRecord,
): string | null {
  const route = record.workspace.route;

  if (!route) {
    return null;
  }

  return `${route.origin.airportCode} → ${route.destination.airportCode}`;
}

export const tripPortfolioPersistenceVersion = 2 as const;

export const tripPortfolioPersistedEnvelopeSchema = z.object({
  state: z.object({
    portfolio: tripPortfolioSchema,
  }),
  version: z.number().int().optional(),
});

const legacyTripWorkspacePersistedEnvelopeSchema = z.object({
  state: z.object({
    workspace: tripWorkspaceSchema,
  }),
  version: z.number().int().optional(),
});

export type TripPortfolioPersistedEnvelope = z.infer<
  typeof tripPortfolioPersistedEnvelopeSchema
>;

export function createTripPortfolioPersistedEnvelope(
  portfolio: TripPortfolio,
): TripPortfolioPersistedEnvelope {
  return tripPortfolioPersistedEnvelopeSchema.parse({
    state: {
      portfolio,
    },
    version: tripPortfolioPersistenceVersion,
  });
}

export function migrateTripPortfolioPersistence(
  input: unknown,
): TripPortfolio | null {
  const current =
    tripPortfolioPersistedEnvelopeSchema.safeParse(
      input,
    );

  if (current.success) {
    return current.data.state.portfolio;
  }

  const legacy =
    legacyTripWorkspacePersistedEnvelopeSchema.safeParse(
      input,
    );

  if (legacy.success) {
    return createTripPortfolioFromWorkspace(
      legacy.data.state.workspace,
    );
  }

  return null;
}

export function migrateTripPortfolioPersistenceJson(
  raw: string | null,
): string | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const portfolio =
    migrateTripPortfolioPersistence(
      parsed,
    );

  if (!portfolio) {
    return null;
  }

  return JSON.stringify(
    createTripPortfolioPersistedEnvelope(
      portfolio,
    ),
  );
}

// -----------------------------------------------------------------------------
// Jahiz M7B — Server Truth / optimistic concurrency contract
// Mobile may cache trip state, but the server revision is authoritative.
// -----------------------------------------------------------------------------

export const serverRevisionSchema = z
  .number()
  .int()
  .nonnegative();

export const clientMutationIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(120);

export const serverTripLifecycleStatusSchema =
  z.enum([
    'active',
    'archived',
    'deleted',
  ]);

export const serverTripLifecycleFilterSchema =
  z.enum([
    'active',
    'archived',
    'deleted',
    'all',
  ])
    .default('active');

export const serverTripLifecycleSchema =
  z.object({
    status:
      serverTripLifecycleStatusSchema,

    archivedAt:
      z.string()
        .datetime()
        .nullable(),

    deletedAt:
      z.string()
        .datetime()
        .nullable()
        .optional(),
  })
    .superRefine(
      (
        value,
        context,
      ) => {
        const deletedAt =
          value.deletedAt ?? null;

        if (
          value.status === 'active' &&
          (
            value.archivedAt !== null ||
            deletedAt !== null
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['status'],
            message:
              'Active trips cannot carry archive or deletion timestamps.',
          });
        }

        if (
          value.status === 'archived' &&
          (
            value.archivedAt === null ||
            deletedAt !== null
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['status'],
            message:
              'Archived trips require only an archive timestamp.',
          });
        }

        if (
          value.status === 'deleted' &&
          (
            value.archivedAt !== null ||
            deletedAt === null
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['status'],
            message:
              'Deleted trips require only a deletion timestamp.',
          });
        }
      },
    );
export const serverTripEnvelopeSchema = z.object({
  tripId: z.string().min(1),
  ownerId: z.string().min(1),
  revision: serverRevisionSchema,
  lifecycle:
    serverTripLifecycleSchema.default({
      status: 'active',
      archivedAt: null,
    }),
  workspace: tripWorkspaceSchema,
  serverUpdatedAt: z.string().datetime(),
});

export const serverTripListResponseSchema =
  z.object({
    data: z.array(
      serverTripEnvelopeSchema,
    ),
  });

export const serverTripCreateRequestSchema = z.object({
  clientMutationId: clientMutationIdSchema,
  workspace: tripWorkspaceSchema,
});

export const serverTripUpdateRequestSchema = z.object({
  clientMutationId: clientMutationIdSchema,
  expectedRevision: serverRevisionSchema,
  workspace: tripWorkspaceSchema,
});

export const serverTripLifecycleMutationRequestSchema =
  z.object({
    clientMutationId:
      clientMutationIdSchema,
    expectedRevision:
      serverRevisionSchema,
    targetStatus:
      serverTripLifecycleStatusSchema,
  });

export const serverTripAppliedSchema = z.object({
  status: z.literal('applied'),
  trip: serverTripEnvelopeSchema,
});

export const serverTripConflictSchema = z.object({
  status: z.literal('conflict'),
  expectedRevision: serverRevisionSchema,
  trip: serverTripEnvelopeSchema,
});

export const serverTripMutationResultSchema =
  z.discriminatedUnion('status', [
    serverTripAppliedSchema,
    serverTripConflictSchema,
  ]);

export const serverTripLifecycleInvalidTransitionSchema =
  z.object({
    status:
      z.literal(
        'invalid_transition',
      ),
    trip:
      serverTripEnvelopeSchema,
  });

export const serverTripLifecycleMutationResultSchema =
  z.discriminatedUnion(
    'status',
    [
      serverTripAppliedSchema,
      serverTripConflictSchema,
      serverTripLifecycleInvalidTransitionSchema,
    ],
  );

export type ServerTripEnvelope = z.infer<
  typeof serverTripEnvelopeSchema
>;

export type ServerTripListResponse = z.infer<
  typeof serverTripListResponseSchema
>;

export type ServerTripCreateRequest = z.infer<
  typeof serverTripCreateRequestSchema
>;

export type ServerTripUpdateRequest = z.infer<
  typeof serverTripUpdateRequestSchema
>;

export type ServerTripLifecycleMutationRequest = z.infer<
  typeof serverTripLifecycleMutationRequestSchema
>;

export type ServerTripLifecycleMutationResult = z.infer<
  typeof serverTripLifecycleMutationResultSchema
>;

export type ServerTripMutationResult = z.infer<
  typeof serverTripMutationResultSchema
>;

export function createServerTripEnvelope(
  input: {
    ownerId: string;
    workspace: TripWorkspace;
    serverUpdatedAt: string;
  },
): ServerTripEnvelope {
  return serverTripEnvelopeSchema.parse({
    tripId: input.workspace.id,
    ownerId: input.ownerId,
    revision: 0,
    lifecycle: {
      status: 'active',
      archivedAt: null,
    },
    workspace: input.workspace,
    serverUpdatedAt: input.serverUpdatedAt,
  });
}

export function applyServerTripUpdate(
  current: ServerTripEnvelope,
  request: ServerTripUpdateRequest,
  serverUpdatedAt: string,
): ServerTripMutationResult {
  const parsedCurrent =
    serverTripEnvelopeSchema.parse(current);

  const parsedRequest =
    serverTripUpdateRequestSchema.parse(
      request,
    );

  if (
    parsedRequest.expectedRevision !==
    parsedCurrent.revision
  ) {
    return serverTripConflictSchema.parse({
      status: 'conflict',
      expectedRevision:
        parsedRequest.expectedRevision,
      trip: parsedCurrent,
    });
  }

  if (
    parsedCurrent.lifecycle.status !==
    'active'
  ) {
    return serverTripConflictSchema.parse({
      status: 'conflict',
      expectedRevision:
        parsedRequest.expectedRevision,
      trip: parsedCurrent,
    });
  }

  return serverTripAppliedSchema.parse({
    status: 'applied',
    trip: {
      tripId: parsedCurrent.tripId,
      ownerId: parsedCurrent.ownerId,
      revision:
        parsedCurrent.revision + 1,
      lifecycle:
        parsedCurrent.lifecycle,
      workspace:
        parsedRequest.workspace,
      serverUpdatedAt,
    },
  });
}

export function applyServerTripLifecycleTransition(
  current: ServerTripEnvelope,
  request:
    ServerTripLifecycleMutationRequest,
  serverUpdatedAt: string,
): ServerTripLifecycleMutationResult {
  const parsedCurrent =
    serverTripEnvelopeSchema.parse(
      current,
    );

  const parsedRequest =
    serverTripLifecycleMutationRequestSchema
      .parse(
        request,
      );

  if (
    parsedRequest.expectedRevision !==
    parsedCurrent.revision
  ) {
    return serverTripConflictSchema.parse({
      status: 'conflict',
      expectedRevision:
        parsedRequest.expectedRevision,
      trip:
        parsedCurrent,
    });
  }

  // Deleted is terminal. A later stale client must never
  // turn a tombstone back into an active or archived trip.
  if (
    parsedCurrent.lifecycle.status ===
    'deleted'
  ) {
    return serverTripLifecycleInvalidTransitionSchema
      .parse({
        status:
          'invalid_transition',
        trip:
          parsedCurrent,
      });
  }

  if (
    parsedRequest.targetStatus ===
    parsedCurrent.lifecycle.status
  ) {
    return serverTripLifecycleInvalidTransitionSchema
      .parse({
        status:
          'invalid_transition',
        trip:
          parsedCurrent,
      });
  }

  const lifecycle =
    parsedRequest.targetStatus ===
      'deleted'
      ? {
          status:
            'deleted' as const,
          archivedAt:
            null,
          deletedAt:
            serverUpdatedAt,
        }
      : parsedRequest.targetStatus ===
          'archived'
        ? {
            status:
              'archived' as const,
            archivedAt:
              serverUpdatedAt,
          }
        : {
            status:
              'active' as const,
            archivedAt:
              null,
          };

  return serverTripAppliedSchema.parse({
    status: 'applied',
    trip: {
      tripId:
        parsedCurrent.tripId,
      ownerId:
        parsedCurrent.ownerId,
      revision:
        parsedCurrent.revision + 1,
      lifecycle,
      workspace:
        parsedCurrent.workspace,
      serverUpdatedAt,
    },
  });
}

// -----------------------------------------------------------------------------
// Jahiz M7G.1 - Provider-neutral authentication and identity contracts
// Production ownerId is a stable Jahiz account identifier resolved by the
// server. providerSubject is opaque external identity and is never accepted as
// repository authority directly from a client payload.
// -----------------------------------------------------------------------------

export const jahizOwnerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160);

export const jahizAuthProviderSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
  );

export const jahizProviderSubjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(255);

export const jahizSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255);

export const jahizAuthenticatedIdentitySchema =
  z.object({
    ownerId: jahizOwnerIdSchema,
    provider: jahizAuthProviderSchema,
    providerSubject:
      jahizProviderSubjectSchema,
    sessionId:
      jahizSessionIdSchema
        .nullable()
        .default(null),
  });

export type JahizAuthenticatedIdentity =
  z.infer<
    typeof jahizAuthenticatedIdentitySchema
  >;

export const jahizAuthStateSchema =
  z.discriminatedUnion(
    'status',
    [
      z.object({
        status: z.literal('loading'),
      }),
      z.object({
        status: z.literal('anonymous'),
      }),
      z.object({
        status: z.literal(
          'authenticated',
        ),
        identity:
          jahizAuthenticatedIdentitySchema,
      }),
    ],
  );

export type JahizAuthState =
  z.infer<typeof jahizAuthStateSchema>;

export const jahizAccountSessionSchema =
  z.object({
    status: z.literal('authenticated'),
    ownerId: jahizOwnerIdSchema,
    provider: jahizAuthProviderSchema,
    sessionId:
      jahizSessionIdSchema
        .nullable()
        .default(null),
  });

export type JahizAccountSession =
  z.infer<typeof jahizAccountSessionSchema>;
