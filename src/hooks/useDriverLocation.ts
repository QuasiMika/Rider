import { useEffect, useRef, useState } from 'react'
import { realtimeService } from '../services'
import { geocode } from '../utils/geocoding'
import { router, LIVE_ROUTING } from '../utils/routing'
import type { LatLng } from '../utils/geocoding'

export function useDriverLocation(rideId: string | null, pickupLocation?: string) {
  const pickupCoordsRef = useRef<LatLng | null>(null)
  const approachCalculatedRef = useRef(false)
  const approachPolylineRef = useRef<LatLng[] | null>(null)
  const [driverPosition, setDriverPosition] = useState<LatLng | null>(null)
  const [approachPolyline, setApproachPolyline] = useState<LatLng[] | null>(null)

  useEffect(() => {
    if (!pickupLocation) return
    const controller = new AbortController()
    geocode(pickupLocation, controller.signal).then(coords => {
      pickupCoordsRef.current = coords
    })
    return () => controller.abort()
  }, [pickupLocation])

  useEffect(() => {
    if (!rideId || !navigator.geolocation) return

    approachCalculatedRef.current = false
    approachPolylineRef.current = null

    const broadcast = realtimeService.createLocationBroadcast(rideId)
    let watchId: number | null = null

    broadcast.subscribe(status => {
      if (status !== 'SUBSCRIBED') return

      watchId = navigator.geolocation.watchPosition(
        async ({ coords }) => {
          const driverPos: LatLng = [coords.latitude, coords.longitude]
          setDriverPosition(driverPos)

          const pickup = pickupCoordsRef.current
          const shouldCalcApproach =
            pickup !== null && (!approachCalculatedRef.current || LIVE_ROUTING)

          let etaSeconds: number | undefined

          if (shouldCalcApproach) {
            const approach = await router.getRoute(driverPos, pickup!)
            if (approach) {
              etaSeconds = approach.durationSeconds
              approachCalculatedRef.current = true
              approachPolylineRef.current = approach.polyline
              setApproachPolyline(approach.polyline)
            }
          }

          broadcast.send({
            lat: coords.latitude,
            lng: coords.longitude,
            etaSeconds,
            approachPolyline: approachPolylineRef.current,
          })
        },
        err => console.warn('[useDriverLocation]', err.message),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
      )
    })

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      broadcast.close()
    }
  }, [rideId])

  return { driverPosition, approachPolyline }
}
