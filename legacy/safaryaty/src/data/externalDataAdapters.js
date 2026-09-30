// Safaryaty external data adapter foundation
// These adapters define how external-world data should enter the system.
// UI must not call external providers directly. The backend/worker layer owns live providers and caching.

export const externalProviderTypes = Object.freeze({
  FX: 'fx-rate',
  COUNTRY_METADATA: 'country-metadata',
  COST_PROFILE: 'cost-profile',
  FLIGHT_ESTIMATE: 'flight-estimate'
});

export const confidenceLevels = Object.freeze(['low', 'medium', 'high']);

export function makeDataEnvelope({ type, source, data, confidence = 'medium', fetchedAt = new Date().toISOString(), expiresAt = null, stale = false, notes = [] }) {
  if (!Object.values(externalProviderTypes).includes(type)) throw new Error(`Unsupported external data type: ${type}`);
  if (!confidenceLevels.includes(confidence)) throw new Error(`Unsupported confidence level: ${confidence}`);
  return { type, source, data, confidence, fetchedAt, expiresAt, stale: !!stale, notes };
}

export function shouldRefreshEnvelope(envelope, now = new Date()) {
  if (!envelope) return true;
  if (envelope.stale) return true;
  if (!envelope.expiresAt) return false;
  const expiry = new Date(envelope.expiresAt);
  if (Number.isNaN(expiry.getTime())) return true;
  return expiry <= now;
}

export function normalizeCurrencyPair(from, to) {
  const safe = (v) => String(v || '').trim().toUpperCase().slice(0, 3);
  const a = safe(from);
  const b = safe(to);
  if (a.length !== 3 || b.length !== 3) throw new Error('Currency codes must be 3 letters');
  return `${a}_${b}`;
}

export function flightEstimateKey({ origin, destination, departureDate = '', returnDate = '', travelers = 1, cabin = 'economy' }) {
  return [origin, destination, departureDate, returnDate, travelers, cabin].map(v => String(v || '').trim().toUpperCase()).join('|');
}

export function safeFlightEstimateFallback({ origin, destination, currency, travelers = 1 }) {
  // Non-live fallback only. It is a planning placeholder until provider adapters are connected.
  const people = Math.max(1, Number(travelers || 1));
  return makeDataEnvelope({
    type: externalProviderTypes.FLIGHT_ESTIMATE,
    source: 'local-route-fallback',
    confidence: 'low',
    data: {
      origin,
      destination,
      currency,
      min: Math.round(350 * people),
      typical: Math.round(650 * people),
      max: Math.round(1100 * people),
      bookingUrl: null
    },
    notes: ['Fallback estimate only. Not a live ticket price.']
  });
}
