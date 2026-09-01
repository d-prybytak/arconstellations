import type { City } from "./types";

export const CITIES: City[] = [
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Reykjavik", lat: 64.1466, lon: -21.9426 },
  { name: "Berlin", lat: 52.52, lon: 13.405 },
  { name: "Cairo", lat: 30.0444, lon: 31.2357 },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
  { name: "Auckland", lat: -36.8509, lon: 174.7645 },
  { name: "Sao Paulo", lat: -23.5505, lon: -46.6333 },
];

export const CITY_GROUPS: { region: string; names: string[] }[] = [
  { region: "Europe", names: ["London", "Berlin", "Reykjavik"] },
  { region: "Americas", names: ["New York", "Los Angeles", "Sao Paulo"] },
  { region: "Africa", names: ["Cairo", "Cape Town"] },
  { region: "Asia & Pacific", names: ["Mumbai", "Singapore", "Tokyo", "Sydney", "Auckland"] },
];

export function nearestCity(lat: number, lon: number): City {
  let best = CITIES[0]!;
  let bestD = Infinity;
  for (const city of CITIES) {
    const d = (city.lat - lat) ** 2 + (city.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best;
}

export function cityByName(name: string): City | undefined {
  return CITIES.find((c) => c.name === name);
}
