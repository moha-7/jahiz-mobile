import type {
  TripTravelStyle,
} from '@jahiz/api-contracts';

export type TravelStyleProviderHints = {
  accommodationTier:
    | 'hostel-basic'
    | 'value'
    | 'comfort'
    | 'premium';
  transportBias:
    | 'public-first'
    | 'value-mix'
    | 'comfort-mix'
    | 'private-first';
  diningBias:
    | 'budget'
    | 'value'
    | 'comfort'
    | 'premium';
  experienceBias:
    | 'essentials'
    | 'balanced'
    | 'expanded'
    | 'premium';
};

export const TRAVEL_STYLE_ORDER = [
  'budget',
  'smart',
  'comfort',
  'premium',
] as const satisfies readonly TripTravelStyle[];

const PROVIDER_HINTS: Record<
  TripTravelStyle,
  TravelStyleProviderHints
> = {
  budget: {
    accommodationTier: 'hostel-basic',
    transportBias: 'public-first',
    diningBias: 'budget',
    experienceBias: 'essentials',
  },
  smart: {
    accommodationTier: 'value',
    transportBias: 'value-mix',
    diningBias: 'value',
    experienceBias: 'balanced',
  },
  comfort: {
    accommodationTier: 'comfort',
    transportBias: 'comfort-mix',
    diningBias: 'comfort',
    experienceBias: 'expanded',
  },
  premium: {
    accommodationTier: 'premium',
    transportBias: 'private-first',
    diningBias: 'premium',
    experienceBias: 'premium',
  },
};

export function getTravelStyleProviderHints(
  style: TripTravelStyle,
): TravelStyleProviderHints {
  return PROVIDER_HINTS[style];
}
