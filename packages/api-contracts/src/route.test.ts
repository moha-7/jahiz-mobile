import assert from 'node:assert/strict';
import test from 'node:test';
import airportData from '../../../apps/mobile/src/entities/airport/airports.json' with { type: 'json' };
import {
  airportDirectorySchema,
  createTripRouteRequestSchema,
  type AirportDirectoryItem,
} from './index.ts';

const airports = airportDirectorySchema.parse(airportData) as AirportDirectoryItem[];
const dxb = airports.find((airport) => airport.airportCode === 'DXB');
const bah = airports.find((airport) => airport.airportCode === 'BAH');

function toLocation(airport: AirportDirectoryItem) {
  return {
    countryCode: airport.countryCode,
    countryName: airport.countryName,
    cityName: airport.cityName,
    airportCode: airport.airportCode,
    airportName: airport.airportName,
    currency: airport.currency,
  };
}

test('airport directory has unique valid IATA codes and bilingual labels', () => {
  assert.ok(airports.length >= 8);
  assert.equal(new Set(airports.map((airport) => airport.airportCode)).size, airports.length);
  for (const airport of airports) {
    assert.match(airport.airportCode, /^[A-Z]{3}$/);
    assert.match(airport.currency, /^[A-Z]{3}$/);
    assert.ok(airport.airportNameAr.length > 0);
    assert.ok(airport.cityNameAr.length > 0);
  }
});

test('DXB to BAH is a valid route', () => {
  assert.ok(dxb);
  assert.ok(bah);
  const result = createTripRouteRequestSchema.safeParse({
    origin: toLocation(dxb),
    destination: toLocation(bah),
  });
  assert.equal(result.success, true);
});

test('origin and destination cannot be the same airport', () => {
  assert.ok(dxb);
  const result = createTripRouteRequestSchema.safeParse({
    origin: toLocation(dxb),
    destination: toLocation(dxb),
  });
  assert.equal(result.success, false);
});
