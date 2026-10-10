/**
 * Geo helpers + Map Provider Architecture.
 *
 * Supports selectable map providers:
 *   - static / district (DistrictCentroidMapProvider: privacy-first district centroids)
 *   - google (GoogleMapsProvider: Google Maps Platform API)
 *   - mapbox (MapboxProvider: Mapbox Geocoding & Matrix API)
 *
 * Privacy requirement:
 * Exact home/work coordinates are NEVER exposed publicly.
 * Public discovery and search results use approximate district centroids or distance buckets.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MapProvider {
  readonly name: string;
  geocodeDistrict(district: string, state?: string): Promise<GeoPoint | null> | GeoPoint | null;
  distanceKm(a: GeoPoint, b: GeoPoint): number;
  approximateLocation(point: GeoPoint, radiusKm?: number): GeoPoint;
}

export const RAJASTHAN_DISTRICTS: Record<string, GeoPoint> = {
  Churu: { lat: 28.3, lng: 74.96 },
  Jaipur: { lat: 26.91, lng: 75.79 },
  Sikar: { lat: 27.61, lng: 75.14 },
  Bikaner: { lat: 28.02, lng: 73.31 },
  Jodhpur: { lat: 26.24, lng: 73.02 },
  Hanumangarh: { lat: 29.58, lng: 74.32 },
  "Sri Ganganagar": { lat: 29.92, lng: 73.88 },
  Jhunjhunu: { lat: 28.13, lng: 75.4 },
  Nagaur: { lat: 27.2, lng: 73.74 },
  Alwar: { lat: 27.55, lng: 76.63 },
  Bharatpur: { lat: 27.22, lng: 77.49 },
  Kota: { lat: 25.21, lng: 75.86 },
  Ajmer: { lat: 26.45, lng: 74.64 },
  Bhilwara: { lat: 25.35, lng: 74.63 },
  Barmer: { lat: 25.75, lng: 71.39 },
  Jaisalmer: { lat: 26.92, lng: 70.91 },
  Pali: { lat: 25.77, lng: 73.32 },
  Tonk: { lat: 26.17, lng: 75.79 },
  Udaipur: { lat: 24.58, lng: 73.68 },
  Ratangarh: { lat: 28.08, lng: 74.62 }, // tehsil in Churu — treated as a place for proximity
};

export const DISTRICT_NAMES = Object.keys(RAJASTHAN_DISTRICTS).filter((d) => d !== "Ratangarh");

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Obfuscates coordinates to a privacy-safe radius (e.g. 3-5 km jitter). */
export function jitterLocation(point: GeoPoint, radiusKm: number = 3): GeoPoint {
  const r = radiusKm / 111.32; // degrees approx
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = (w * Math.sin(t)) / Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: Number((point.lat + x).toFixed(4)),
    lng: Number((point.lng + y).toFixed(4)),
  };
}

export class DistrictCentroidMapProvider implements MapProvider {
  readonly name = "static";

  geocodeDistrict(district: string): GeoPoint | null {
    const key = Object.keys(RAJASTHAN_DISTRICTS).find((k) => k.toLowerCase() === district.trim().toLowerCase());
    return key ? RAJASTHAN_DISTRICTS[key] : null;
  }

  distanceKm(a: GeoPoint, b: GeoPoint): number {
    return haversineKm(a, b);
  }

  approximateLocation(point: GeoPoint): GeoPoint {
    return point;
  }
}

export class GoogleMapsProvider implements MapProvider {
  readonly name = "google";
  private apiKey: string;

  constructor(apiKey: string = "") {
    this.apiKey = apiKey;
  }

  async geocodeDistrict(district: string, state: string = "Rajasthan"): Promise<GeoPoint | null> {
    if (!this.apiKey) {
      return new DistrictCentroidMapProvider().geocodeDistrict(district);
    }
    try {
      const q = encodeURIComponent(`${district}, ${state}, India`);
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${this.apiKey}`);
      const data = await res.json();
      if (data.results && data.results[0]?.geometry?.location) {
        return {
          lat: data.results[0].geometry.location.lat,
          lng: data.results[0].geometry.location.lng,
        };
      }
    } catch (err) {
      console.error("[maps:google] Geocode failed:", err);
    }
    return new DistrictCentroidMapProvider().geocodeDistrict(district);
  }

  distanceKm(a: GeoPoint, b: GeoPoint): number {
    return haversineKm(a, b);
  }

  approximateLocation(point: GeoPoint, radiusKm: number = 3): GeoPoint {
    return jitterLocation(point, radiusKm);
  }
}

export class MapboxProvider implements MapProvider {
  readonly name = "mapbox";
  private token: string;

  constructor(token: string = "") {
    this.token = token;
  }

  async geocodeDistrict(district: string, state: string = "Rajasthan"): Promise<GeoPoint | null> {
    if (!this.token) {
      return new DistrictCentroidMapProvider().geocodeDistrict(district);
    }
    try {
      const q = encodeURIComponent(`${district} ${state} India`);
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${this.token}&types=place,district`);
      const data = await res.json();
      if (data.features && data.features[0]?.center) {
        return {
          lng: data.features[0].center[0],
          lat: data.features[0].center[1],
        };
      }
    } catch (err) {
      console.error("[maps:mapbox] Geocode failed:", err);
    }
    return new DistrictCentroidMapProvider().geocodeDistrict(district);
  }

  distanceKm(a: GeoPoint, b: GeoPoint): number {
    return haversineKm(a, b);
  }

  approximateLocation(point: GeoPoint, radiusKm: number = 3): GeoPoint {
    return jitterLocation(point, radiusKm);
  }
}

export const staticMapProvider = new DistrictCentroidMapProvider();

export function districtDistanceKm(a: string, b: string, provider: MapProvider = staticMapProvider): number | null {
  const pa = provider.geocodeDistrict(a);
  const pb = provider.geocodeDistrict(b);
  if (pa instanceof Promise || pb instanceof Promise) {
    return null;
  }
  return pa && pb ? Math.round(provider.distanceKm(pa, pb)) : null;
}

/** Find a known place name inside free text, e.g. "mustard farmers near Churu" → "Churu". */
export function findPlaceInText(text: string): string | null {
  const lower = text.toLowerCase();
  const names = Object.keys(RAJASTHAN_DISTRICTS).sort((a, b) => b.length - a.length);
  return names.find((n) => lower.includes(n.toLowerCase())) ?? null;
}
