import airportData from './airports.json';
import {
  airportDirectorySchema,
  type AirportDirectoryItem,
  type LocationSelection,
} from '@jahiz/api-contracts';

export const airportDirectory: AirportDirectoryItem[] = airportDirectorySchema.parse(airportData);

export function airportToLocationSelection(airport: AirportDirectoryItem): LocationSelection {
  return {
    countryCode: airport.countryCode,
    countryName: airport.countryName,
    cityName: airport.cityName,
    airportCode: airport.airportCode,
    airportName: airport.airportName,
    currency: airport.currency,
  };
}

export function getLocalizedAirportText(airport: AirportDirectoryItem, isRtl: boolean) {
  return {
    city: isRtl ? airport.cityNameAr : airport.cityName,
    country: isRtl ? airport.countryNameAr : airport.countryName,
    airport: isRtl ? airport.airportNameAr : airport.airportName,
  };
}
