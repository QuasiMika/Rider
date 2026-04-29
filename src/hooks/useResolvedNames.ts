import { useState, useEffect } from 'react'
import { geocode } from '../utils/geocoding'
import { reverseGeocoder, loadPlaceName, savePlaceName } from '../utils/reverseGeocoding'

/**
 * Resolves pickup/destination strings to short, human-readable place names
 * by forward-geocoding then reverse-geocoding via the configured providers.
 *
 * Results are cached in localStorage when rideId is provided, so subsequent
 * loads (e.g. after page reload) are instant.
 *
 * Falls back to the raw location strings while loading or on error.
 */
export function useResolvedNames(
  rideId: string | undefined,
  pickupLocation: string | undefined,
  destination: string | undefined,
) {
  const [pickupName, setPickupName] = useState(pickupLocation ?? '')
  const [destName,   setDestName]   = useState(destination ?? '')

  useEffect(() => {
    setPickupName(pickupLocation ?? '')
    if (!pickupLocation) return

    if (rideId) {
      const cached = loadPlaceName(rideId, 'pickup')
      if (cached) { setPickupName(cached); return }
    }

    const controller = new AbortController()
    geocode(pickupLocation, controller.signal).then(async coords => {
      if (!coords || controller.signal.aborted) return
      const name = await reverseGeocoder.lookupName(coords[0], coords[1], controller.signal)
      if (!name || controller.signal.aborted) return
      setPickupName(name)
      if (rideId) savePlaceName(rideId, 'pickup', name)
    }).catch(() => {})
    return () => controller.abort()
  }, [rideId, pickupLocation])

  useEffect(() => {
    setDestName(destination ?? '')
    if (!destination) return

    if (rideId) {
      const cached = loadPlaceName(rideId, 'destination')
      if (cached) { setDestName(cached); return }
    }

    const controller = new AbortController()
    geocode(destination, controller.signal).then(async coords => {
      if (!coords || controller.signal.aborted) return
      const name = await reverseGeocoder.lookupName(coords[0], coords[1], controller.signal)
      if (!name || controller.signal.aborted) return
      setDestName(name)
      if (rideId) savePlaceName(rideId, 'destination', name)
    }).catch(() => {})
    return () => controller.abort()
  }, [rideId, destination])

  return { pickupName, destName }
}
