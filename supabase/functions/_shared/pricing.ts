const OSRM_BASE = 'https://router.project-osrm.org'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function parseCoord(s: string): [number, number] | null {
  const parts = s.split(',').map(Number)
  if (parts.length !== 2 || parts.some(isNaN)) return null
  const [lat, lng] = parts
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

async function osrmDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): Promise<number | null> {
  try {
    // OSRM expects lng,lat order
    const url = `${OSRM_BASE}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null
    return (data.routes[0].distance as number) / 1000
  } catch {
    return null
  }
}

// €2.00/km, minimum €2.00, rounded to the nearest cent.
// Uses OSRM road distance; falls back to haversine if OSRM is unavailable.
export async function calculatePriceEur(
  pickupLocation: string | null,
  destination: string | null,
): Promise<number | null> {
  const pickup = parseCoord(pickupLocation ?? '')
  const dest = parseCoord(destination ?? '')
  if (!pickup || !dest) return null

  const routeKm = await osrmDistanceKm(pickup[0], pickup[1], dest[0], dest[1])
  const km = routeKm ?? haversineKm(pickup[0], pickup[1], dest[0], dest[1])

  return Math.round(Math.max(km * 2, 2) * 100) / 100
}
