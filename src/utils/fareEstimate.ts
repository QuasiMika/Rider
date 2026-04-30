import { router } from './routing'
import type { LatLng } from './geocoding'

export type FareEstimate = {
  distanceKm: number
  durationSeconds: number
  price: number
}

export async function estimateFare(
  pickup: LatLng,
  dest: LatLng,
  signal?: AbortSignal
): Promise<FareEstimate | null> {
  const route = await router.getRoute(pickup, dest, signal)
  if (!route) return null
  const distanceKm = route.distanceMeters / 1000
  return { distanceKm, durationSeconds: route.durationSeconds, price: distanceKm * 2 }
}
