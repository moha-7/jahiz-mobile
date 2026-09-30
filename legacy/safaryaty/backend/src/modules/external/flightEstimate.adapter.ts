import { envelope } from './types.js';

export type FlightEstimateInput = {
  origin: string;
  destination: string;
  departureDate?: string;
  returnDate?: string;
  travelers?: number;
  currency: string;
};

export type FlightEstimate = {
  origin: string;
  destination: string;
  currency: string;
  min: number;
  typical: number;
  max: number;
  bookingUrl: string | null;
};

export interface FlightEstimateProvider {
  estimate(input: FlightEstimateInput): Promise<FlightEstimate>;
}

export class LocalFlightEstimateProvider implements FlightEstimateProvider {
  async estimate(input: FlightEstimateInput): Promise<FlightEstimate> {
    const travelers = Math.max(1, Number(input.travelers || 1));
    return {
      origin: input.origin,
      destination: input.destination,
      currency: input.currency,
      min: Math.round(350 * travelers),
      typical: Math.round(650 * travelers),
      max: Math.round(1100 * travelers),
      bookingUrl: null
    };
  }
}

export async function getFlightEstimateEnvelope(input: FlightEstimateInput, provider: FlightEstimateProvider = new LocalFlightEstimateProvider()) {
  const data = await provider.estimate(input);
  return envelope({ type: 'flight-estimate', source: 'local-flight-fallback', data, confidence: 'low', notes: ['Planning estimate only. Not a live ticket price.'] });
}
