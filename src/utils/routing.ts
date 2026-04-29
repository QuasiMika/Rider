import type { LatLng } from './geocoding'

// ── Config ────────────────────────────────────────────────────────────────────
// false → calculate the trip route once when the ride is created and cache it.
// true  → recalculate the approach route on every driver GPS update.
export const LIVE_ROUTING = false

// ── Types ─────────────────────────────────────────────────────────────────────
export type RouteResult = {
  polyline: LatLng[]
  distanceMeters: number
  durationSeconds: number
}

// ── Provider interface ────────────────────────────────────────────────────────
// Swap the active export below to replace the routing backend.
export interface RoutingProvider {
  getRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteResult | null>
}

// ── OSRM implementation ───────────────────────────────────────────────────────
class OsrmProvider implements RoutingProvider {
  async getRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteResult | null> {
    const [fLat, fLng] = from
    const [tLat, tLng] = to
    // Proxied via Vite dev server: /osrm → https://router.project-osrm.org
    const url =
      `/osrm/route/v1/driving/${fLng},${fLat};${tLng},${tLat}` +
      `?overview=full&geometries=geojson`
    try {
      const res = await fetch(url, signal ? { signal } : undefined)
      if (!res.ok) return null
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.[0]) return null
      const r = data.routes[0]
      // GeoJSON coordinates are [lng, lat] — swap to [lat, lng] for Leaflet
      const polyline: LatLng[] = (r.geometry.coordinates as [number, number][]).map(
        ([lng, lat]) => [lat, lng]
      )
      return { polyline, distanceMeters: r.distance, durationSeconds: r.duration }
    } catch {
      return null
    }
  }
}

// Active provider — replace `new OsrmProvider()` to switch backends
export const router: RoutingProvider = new OsrmProvider()

// ── localStorage cache ────────────────────────────────────────────────────────
// Routes are keyed by ride ID so they survive page reloads within a session.

const storageKey = (rideId: string) => `rider:route:${rideId}`

export function saveRoute(rideId: string, route: RouteResult): void {
  try { localStorage.setItem(storageKey(rideId), JSON.stringify(route)) } catch { /* storage full */ }
}

export function loadRoute(rideId: string): RouteResult | null {
  try {
    const raw = localStorage.getItem(storageKey(rideId))
    return raw ? (JSON.parse(raw) as RouteResult) : null
  } catch { return null }
}

export function clearRoute(rideId: string): void {
  try { localStorage.removeItem(storageKey(rideId)) } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 1) return 'weniger als 1 Min.'
  if (m === 1) return '1 Min.'
  return `${m} Min.`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
