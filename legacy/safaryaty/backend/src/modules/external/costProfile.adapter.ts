import { envelope, type ExternalConfidence } from './types.js';
import { estimateCategoryRanges, profileCurrencyForCountry } from '../suggestions/cost-profiles.js';
import { getRate } from '../fx/fx.service.js';
import { getCountryEnvelope } from './countryMetadata.service.js';
import { rateFromBook } from '../../../../shared/currency-domain.js';
import { convertCostRangeProfile } from '../../../../shared/cost-estimate-currency.js';

export type CostProfileInput = {
  destinationCountry?: string | null;
  tripCurrency: string;
  comfortLevel?: string | null;
  days: number;
  travelers: number;
  rateBook?: Record<string, number> | null;
};

function confidenceRank(value: ExternalConfidence) {
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function lowestConfidence(a: ExternalConfidence, b: ExternalConfidence): ExternalConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

function asExternalConfidence(value: unknown): ExternalConfidence {
  return value === 'high' || value === 'low' || value === 'medium' ? value : 'medium';
}

export async function getCostProfileEnvelope(input: CostProfileInput) {
  const targetCurrency = String(input.tripCurrency || 'USD').toUpperCase();
  let metadataCurrency = '';
  try {
    const countryResult = input.destinationCountry ? await getCountryEnvelope(String(input.destinationCountry)) : null;
    metadataCurrency = String(countryResult?.data?.currency || '').toUpperCase();
  } catch {
    metadataCurrency = '';
  }
  const nativeCurrency = metadataCurrency || profileCurrencyForCountry(input.destinationCountry, targetCurrency);
  let data: any = estimateCategoryRanges({
    destinationCountry: input.destinationCountry || undefined,
    tripCurrency: nativeCurrency,
    comfortLevel: input.comfortLevel || 'Balanced',
    days: input.days,
    travelers: input.travelers
  });
  let source = data.source || 'local-cost-profile';
  let confidence: ExternalConfidence = asExternalConfidence(data.confidence);
  const notes = ['Ranges are planning estimates, not booking quotes.', 'They never use salary, savings, support money, or available cash.'];
  let conversionAvailable = nativeCurrency === targetCurrency;
  let conversionRate = nativeCurrency === targetCurrency ? 1 : 0;

  if (nativeCurrency !== targetCurrency) {
    const savedRate = rateFromBook(input.rateBook || {}, nativeCurrency, targetCurrency);
    if (savedRate > 0) {
      const converted = convertCostRangeProfile(data, { sourceCurrency: nativeCurrency, targetCurrency, rate: savedRate });
      if (converted) {
        data = converted;
        source = `${source}+trip-rate-book`;
        confidence = lowestConfidence(confidence, 'medium');
        conversionAvailable = true;
        conversionRate = savedRate;
        notes.push(`Converted profile from ${nativeCurrency} to ${targetCurrency} using the saved trip rate.`);
      }
    }

    if (!conversionAvailable) {
      try {
        const fx = await getRate(nativeCurrency, targetCurrency);
        const converted = convertCostRangeProfile(data, { sourceCurrency: nativeCurrency, targetCurrency, rate: fx.rate });
        if (!converted) throw new Error('Cost-profile conversion returned no result');
        data = converted;
        source = `${source}+${fx.source}`;
        confidence = lowestConfidence(confidence, asExternalConfidence(fx.confidence));
        conversionAvailable = true;
        conversionRate = fx.rate;
        notes.push(`Converted profile from ${nativeCurrency} to ${targetCurrency} using ${fx.source}.`);
      } catch {
        confidence = 'low';
        notes.push(`A rate for ${nativeCurrency} to ${targetCurrency} is unavailable. Native estimates were returned without relabelling them.`);
      }
    }
  }

  return envelope({
    type: 'cost-profile',
    source,
    data: {
      ...data,
      nativeCurrency,
      requestedCurrency: targetCurrency,
      conversionAvailable,
      conversionRate: conversionRate || null
    },
    confidence,
    notes
  });
}
