export type LatLng = [number, number]

export type AddressSuggestion = {
  displayName: string
  coords: LatLng
}

const cache = new Map<string, LatLng | null>()

// Nominatim allows 1 req/s — serialize all requests through this queue.
// Exported so reverse geocoding can share the same queue and not violate rate limits.
let queue = Promise.resolve()
export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn).then(
    v => (queue = Promise.resolve(), v),
    e => { queue = Promise.resolve(); throw e },
  )
  queue = next.then(() => new Promise<void>(r => setTimeout(r, 1100))).catch(() => {})
  return next
}

const NOMINATIM = import.meta.env.DEV
  ? '/nominatim'
  : 'https://nominatim.openstreetmap.org'

// Bounding box for Konstanz and surrounding area
const KONSTANZ_VIEWBOX = '9.00,47.82,9.45,47.57'

const COORD_RE = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/

export async function geocode(query: string, signal?: AbortSignal): Promise<LatLng | null> {
  if (!query) return null
  if (cache.has(query)) return cache.get(query)!

  if (COORD_RE.test(query.trim())) {
    const [lat, lon] = query.split(',').map(Number)
    const result: LatLng = [lat, lon]
    cache.set(query, result)
    return result
  }

  return enqueue(async () => {
    if (signal?.aborted) return null
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=de`
    const res = await fetch(url, signal ? { signal } : undefined)
    if (!res.ok) { cache.set(query, null); return null }
    const data = await res.json()
    const result: LatLng | null = data[0]
      ? [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      : null
    cache.set(query, result)
    return result
  })
}

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  if (!query.trim() || query.trim().length < 2) return []
  if (signal?.aborted) return []
  // Uses viewbox to bias results toward Konstanz but does not restrict strictly (no bounded=1)
  // so that nearby addresses still appear. Bypasses the shared enqueue throttle because
  // the caller (useAddressSearch) already debounces and manages its own abort controller.
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=de&viewbox=${KONSTANZ_VIEWBOX}&countrycodes=de`
  try {
    const res = await fetch(url, signal ? { signal } : undefined)
    if (!res.ok) return []
    const data = await res.json()
    return (data as { display_name: string; lat: string; lon: string }[]).map(item => ({
      displayName: item.display_name,
      coords: [parseFloat(item.lat), parseFloat(item.lon)] as LatLng,
    }))
  } catch {
    return []
  }
}
