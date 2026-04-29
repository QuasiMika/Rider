export type LatLng = [number, number]

const cache = new Map<string, LatLng | null>()

// Nominatim allows 1 req/s — serialize all requests through this queue.
// Exported so reverse geocoding can share the same queue and not violate rate limits.
let queue = Promise.resolve()
export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn).then(
    v => (queue = Promise.resolve(), v),
    e => { queue = Promise.resolve(); throw e },
  )
  queue = next.then(() => new Promise(r => setTimeout(r, 1100))).catch(() => {})
  return next
}

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
    const url = `/nominatim/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=de`
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
