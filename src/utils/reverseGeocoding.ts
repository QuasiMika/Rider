import { enqueue } from './geocoding'

// ── Provider interface ────────────────────────────────────────────────────────
// Swap the active export below to replace the reverse-geocoding backend.
export interface ReverseGeocodingProvider {
  lookupName(lat: number, lng: number, signal?: AbortSignal): Promise<string | null>
}

// ── Nominatim implementation ──────────────────────────────────────────────────
const memCache = new Map<string, string | null>()

class NominatimReverseProvider implements ReverseGeocodingProvider {
  async lookupName(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (memCache.has(key)) return memCache.get(key)!

    return enqueue(async () => {
      if (signal?.aborted) return null
      const url = `/nominatim/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=de`
      try {
        const res = await fetch(url, signal ? { signal } : undefined)
        if (!res.ok) { memCache.set(key, null); return null }
        const data = await res.json()
        const a = data.address ?? {}
        // Build a concise name: primary feature + city
        const main = a.road ?? a.pedestrian ?? a.neighbourhood ?? a.suburb ?? data.name ?? ''
        const city = a.city ?? a.town ?? a.village ?? a.county ?? ''
        const name = [main, city].filter(Boolean).join(', ') || data.display_name || null
        memCache.set(key, name)
        return name
      } catch {
        return null
      }
    })
  }
}

// Active provider — replace `new NominatimReverseProvider()` to switch backends
export const reverseGeocoder: ReverseGeocodingProvider = new NominatimReverseProvider()

// ── localStorage cache keyed by ride ID + field ───────────────────────────────
const placeKey = (rideId: string, field: 'pickup' | 'destination') =>
  `rider:place:${rideId}:${field}`

export function savePlaceName(rideId: string, field: 'pickup' | 'destination', name: string): void {
  try { localStorage.setItem(placeKey(rideId, field), name) } catch { /* storage full */ }
}

export function loadPlaceName(rideId: string, field: 'pickup' | 'destination'): string | null {
  try { return localStorage.getItem(placeKey(rideId, field)) } catch { return null }
}
