import airportData from '@/entities/airport/airports.json';
import {
  airportDirectorySchema,
  type AirportDirectoryItem,
  type LocationSelection,
} from '@jahiz/api-contracts';

const airportDirectory = airportDirectorySchema.parse(
  airportData,
) as AirportDirectoryItem[];

const airportsByCode = new Map(
  airportDirectory.map((airport) => [
    airport.airportCode,
    airport,
  ]),
);

export function findAirportForLocation(
  location: LocationSelection | null | undefined,
): AirportDirectoryItem | null {
  if (!location) return null;

  return airportsByCode.get(location.airportCode) ?? null;
}
