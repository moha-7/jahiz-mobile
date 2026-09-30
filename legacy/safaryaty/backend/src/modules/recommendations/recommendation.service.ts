import type { Trip, Income, LifeCost, Installment, TripCost, Expense, PaymentMark } from '@prisma/client';
import { generateRecommendations, recommendationSummary, RECOMMENDATION_ENGINE_VERSION } from '../../../../shared/recommendation-engine.js';
import { calculateTrip, tripCostCategoryTotals } from '../finance/cashflow.engine.js';
import { getCostProfileEnvelope } from '../external/costProfile.adapter.js';

export type RecommendationTrip = Trip & {
  incomes: Income[];
  lifeCosts: LifeCost[];
  installments: Installment[];
  tripCosts: TripCost[];
  expenses: Expense[];
  paymentMarks?: PaymentMark[];
};

function snapshotFromTrip(trip: Trip): any {
  try {
    const parsed = JSON.parse((trip as any).notes || '{}');
    return parsed?.trip || parsed || {};
  } catch {
    return {};
  }
}

function tripDays(trip: Trip) {
  if (!trip.departureDate || !trip.returnDate) return 7;
  return Math.max(1, Math.ceil((trip.returnDate.getTime() - trip.departureDate.getTime()) / 86400000));
}

export async function buildTripRecommendations(trip: RecommendationTrip) {
  const summary = calculateTrip({
    trip,
    incomes: trip.incomes,
    lifeCosts: trip.lifeCosts,
    installments: trip.installments,
    tripCosts: trip.tripCosts,
    expenses: trip.expenses,
    paymentMarks: trip.paymentMarks || []
  });
  const snap = snapshotFromTrip(trip);
  const profile = await getCostProfileEnvelope({
    destinationCountry: trip.toCountry,
    tripCurrency: trip.tripCurrency,
    comfortLevel: snap.comfortLevel || trip.travelStyle || 'Balanced',
    days: tripDays(trip),
    travelers: Math.max(1, Number(trip.travelers || 1))
  });
  const categoryAmounts = tripCostCategoryTotals(trip.tripCosts, trip);
  const recommendations = generateRecommendations({
    decision: summary.decision,
    currency: trip.tripCurrency,
    planned: summary.cards.tripCost,
    available: summary.cards.available,
    paid: summary.cards.paid,
    remaining: summary.details.remaining,
    gap: summary.cards.stillNeeded,
    rateUnsure: summary.decision?.inputs?.rateUnsure,
    everNegative: summary.decision?.inputs?.everNegative,
    continuingInstallments: summary.decision?.inputs?.continuingInstallments,
    upcomingPayments: summary.payments.upcoming.length,
    categoryAmounts,
    categoryRanges: (profile.data as any)?.categories || {},
    costProfile: {
      confidence: profile.confidence,
      source: profile.source,
      asOf: (profile as any).sourceAsOf || (profile.data as any)?.asOf || profile.fetchedAt,
      stale: profile.stale,
    }
  });

  return {
    version: RECOMMENDATION_ENGINE_VERSION,
    recommendations,
    summary: recommendationSummary(recommendations),
    context: {
      currency: trip.tripCurrency,
      costProfile: {
        source: profile.source,
        confidence: profile.confidence,
        sourceAsOf: (profile as any).sourceAsOf || (profile.data as any)?.asOf || null,
        stale: profile.stale,
      },
      decisionVersion: summary.decision?.version || null,
    }
  };
}
