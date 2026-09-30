import type { PrismaClient } from "@prisma/client";
import { addRateToBook, convertIncomeCurrencyValues, convertTripCurrencyValues, normalizeCurrencyCode } from "../../../../shared/currency-domain.js";
import { mergeFinanceProfileIntoClientTrip, parseTripSnapshot, readFinanceSettingsFromTripRow } from "../../../../shared/trip-finance-profile.js";
import { getRate } from "../fx/fx.service.js";
import { HttpError } from "../../utils/httpError.js";
import { includeTripRelations } from "../trips/trips.service.js";
import { upsertTripFinanceProfile } from "../trips/trip-finance-profile.service.js";

function roundMoney(value: unknown) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export type CurrencyContextChangeInput = {
  incomeCurrency?: string;
  tripCurrency?: string;
  origin?: { countryCode?: string; airportCode?: string } | null;
  destination?: { countryCode?: string; airportCode?: string } | null;
};

export async function changeTripCurrencyContext(prisma: PrismaClient, tripId: string, userId: string, input: CurrencyContextChangeInput) {
  const existing = await prisma.trip.findFirst({
    where: { id: tripId, userId, status: { not: "DELETED" } },
    include: includeTripRelations()
  });
  if (!existing) throw new HttpError(404, "Trip not found");

  const oldIncome = normalizeCurrencyCode(existing.incomeCurrency, "AED");
  const oldTrip = normalizeCurrencyCode(existing.tripCurrency, oldIncome);
  const nextIncome = normalizeCurrencyCode(input.incomeCurrency || oldIncome, oldIncome);
  const nextTrip = normalizeCurrencyCode(input.tripCurrency || oldTrip, oldTrip);
  if (!nextIncome || !nextTrip) throw new HttpError(422, "Currency codes must be valid ISO 4217 codes");

  const planRate = await getRate(nextIncome, nextTrip);
  const incomeConversion = oldIncome === nextIncome ? { rate: 1, source: "same-currency" } : await getRate(oldIncome, nextIncome);
  const tripConversion = oldTrip === nextTrip ? { rate: 1, source: "same-currency" } : await getRate(oldTrip, nextTrip);

  const snapshot = parseTripSnapshot(existing.notes);
  const settings = readFinanceSettingsFromTripRow(existing as any);
  const clientTrip = mergeFinanceProfileIntoClientTrip(snapshot.trip || {}, (existing as any).financeProfile || null);
  let rateBook = { ...(settings.rateBook || {}) };
  rateBook = addRateToBook(rateBook, nextIncome, nextTrip, planRate.rate);
  rateBook = addRateToBook(rateBook, oldIncome, nextIncome, incomeConversion.rate);
  rateBook = addRateToBook(rateBook, oldTrip, nextTrip, tripConversion.rate);

  const incomeValues = convertIncomeCurrencyValues({
    oldIncomeToNewIncomeRate: incomeConversion.rate,
    startingSavingsBase: clientTrip.startingSavingsBase,
    reserveAmountBase: clientTrip?.scenario?.reserveAmountBase,
    incomeSources: clientTrip.incomeSources,
    lifeCosts: clientTrip.lifeCosts,
    installments: clientTrip.installments
  });
  const tripValues = convertTripCurrencyValues({
    oldTripToNewTripRate: tripConversion.rate,
    supportLocal: clientTrip.supportLocal,
    budget: clientTrip.budget
  });

  const nextDisplayCurrency = oldTrip === nextTrip
    ? normalizeCurrencyCode(clientTrip.displayCurrency || existing.displayCurrency || nextTrip, nextTrip)
    : nextTrip;

  const nextClientTrip = {
    ...clientTrip,
    ...(input.origin ? { origin: { ...(clientTrip.origin || {}), ...input.origin } } : {}),
    ...(input.destination ? { destinationInfo: { ...(clientTrip.destinationInfo || {}), ...input.destination } } : {}),
    baseCurrency: nextIncome,
    tripCurrency: nextTrip,
    displayCurrency: nextDisplayCurrency,
    exchangeRate: planRate.rate,
    ratePair: `${nextIncome}_${nextTrip}`,
    rateMode: "AUTO",
    rateNeedsReview: false,
    rateSource: planRate.source,
    rateSourceAsOf: planRate.sourceAsOf || null,
    rateUpdatedAt: planRate.fetchedAt,
    rateExpiresAt: planRate.expiresAt,
    rateStale: !!planRate.stale,
    rateConfidence: planRate.confidence,
    rateBook,
    pendingCurrencyConversion: null,
    startingSavingsBase: incomeValues?.startingSavingsBase ?? clientTrip.startingSavingsBase,
    supportLocal: tripValues?.supportLocal ?? clientTrip.supportLocal,
    incomeSources: incomeValues?.incomeSources ?? clientTrip.incomeSources,
    lifeCosts: incomeValues?.lifeCosts ?? clientTrip.lifeCosts,
    installments: incomeValues?.installments ?? clientTrip.installments,
    budget: tripValues?.budget ?? clientTrip.budget,
    scenario: {
      ...(clientTrip.scenario || {}),
      reserveAmountBase: incomeValues?.reserveAmountBase ?? clientTrip?.scenario?.reserveAmountBase ?? 0
    }
  };

  await prisma.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: existing.id },
      data: {
        incomeCurrency: nextIncome,
        tripCurrency: nextTrip,
        displayCurrency: nextDisplayCurrency,
        exchangeRate: planRate.rate,
        rateMode: "AUTO",
        fromCountry: input.origin?.countryCode || existing.fromCountry,
        fromAirport: input.origin?.airportCode || existing.fromAirport,
        toCountry: input.destination?.countryCode || existing.toCountry,
        toAirport: input.destination?.airportCode || existing.toAirport,
        notes: JSON.stringify({ ...snapshot, version: "client-trip-v3-normalized-finance", trip: nextClientTrip })
      }
    });

    await upsertTripFinanceProfile(tx, existing.id, nextClientTrip);

    if (oldIncome !== nextIncome) {
      await Promise.all([
        ...existing.incomes.map((item) => tx.income.update({ where: { id: item.id }, data: { amount: roundMoney(item.amount * incomeConversion.rate), currency: nextIncome } })),
        ...existing.lifeCosts.map((item) => tx.lifeCost.update({ where: { id: item.id }, data: { amount: roundMoney(item.amount * incomeConversion.rate), currency: nextIncome } })),
        ...existing.installments.map((item) => tx.installment.update({ where: { id: item.id }, data: { amount: roundMoney(item.amount * incomeConversion.rate), currency: nextIncome } }))
      ]);
    }

    if (oldTrip !== nextTrip) {
      await Promise.all([
        ...existing.tripCosts.map((item) => tx.tripCost.update({ where: { id: item.id }, data: { amount: roundMoney(item.amount * tripConversion.rate), currency: nextTrip } })),
        ...existing.suggestions.map((item) => tx.presetSuggestion.update({
          where: { id: item.id },
          data: {
            currentAmount: roundMoney(item.currentAmount * tripConversion.rate),
            suggestedAmount: roundMoney(item.suggestedAmount * tripConversion.rate),
            difference: roundMoney(item.difference * tripConversion.rate),
            currency: nextTrip
          }
        }))
      ]);
    }
  });

  const trip = await prisma.trip.findFirst({ where: { id: existing.id, userId }, include: includeTripRelations() });
  if (!trip) throw new HttpError(404, "Trip not found after currency update");
  return {
    trip,
    conversion: {
      oldIncome,
      nextIncome,
      oldTrip,
      nextTrip,
      planRate,
      incomeConversion,
      tripConversion,
      paymentMarksPreserved: true
    }
  };
}
