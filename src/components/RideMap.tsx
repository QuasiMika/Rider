import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { geocode } from '../utils/geocoding'
import { router, loadRoute, saveRoute } from '../utils/routing'
import type { RouteResult } from '../utils/routing'
import type { LatLng } from '../utils/geocoding'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const driverIcon = L.divIcon({
  html: '<span style="font-size:26px;line-height:1;display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))">🛺</span>',
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// ── Map helpers ───────────────────────────────────────────────────────────────

function BoundsSync({
  coords,
  driverPosition,
  rideStatus,
}: {
  coords: LatLng[]
  driverPosition?: LatLng | null
  rideStatus?: string
}) {
  const map = useMap()

  // Fit to pickup+destination whenever coords change OR status advances past pending
  // (e.g. when picked_up fires, re-center on the trip route).
  useEffect(() => {
    map.invalidateSize()
    if (coords.length === 0) return
    if (coords.length === 1) { map.setView(coords[0], 14); return }
    map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] })
  }, [map, coords, rideStatus])

  // Smooth tracking: keep driver + pickup in view while approaching
  useEffect(() => {
    if (!driverPosition || rideStatus !== 'pending') return
    const anchor = coords[0]
    const points: LatLng[] = anchor ? [driverPosition, anchor] : [driverPosition]
    if (points.length === 1) {
      map.setView(driverPosition, 15, { animate: true })
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: true, maxZoom: 16 })
    }
  }, [map, driverPosition, coords, rideStatus])

  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  pickupLocation: string
  destination: string
  height?: number
  driverPosition?: LatLng | null
  /** Ride ID used to persist the trip route in localStorage */
  rideId?: string
  /** Controls which route is drawn: approach (driver→pickup) when pending, trip otherwise */
  rideStatus?: string
  /** Pre-calculated approach polyline broadcast from the driver */
  approachPolyline?: LatLng[] | null
}

export function RideMap({ pickupLocation, destination, height = 220, driverPosition, rideId, rideStatus, approachPolyline }: Props) {
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null)
  const [destCoords,   setDestCoords]   = useState<LatLng | null>(null)
  const [geocoding,    setGeocoding]    = useState(true)
  const [tripRoute,    setTripRoute]    = useState<RouteResult | null>(null)

  // Geocode pickup and destination
  useEffect(() => {
    const controller = new AbortController()
    setGeocoding(true)
    setPickupCoords(null)
    setDestCoords(null)

    Promise.all([
      pickupLocation ? geocode(pickupLocation, controller.signal) : Promise.resolve(null),
      destination    ? geocode(destination,    controller.signal) : Promise.resolve(null),
    ]).then(([p, d]) => {
      if (controller.signal.aborted) return
      setPickupCoords(p)
      setDestCoords(d)
      setGeocoding(false)
    }).catch(() => {})

    return () => controller.abort()
  }, [pickupLocation, destination])

  // Calculate and cache the trip route (pickup → destination) once geocoding is done.
  // With LIVE_ROUTING = false this never re-runs after the first successful fetch.
  useEffect(() => {
    if (!pickupCoords || !destCoords) return

    // Try localStorage first
    if (rideId) {
      const cached = loadRoute(rideId)
      if (cached) { setTripRoute(cached); return }
    }

    const controller = new AbortController()
    router.getRoute(pickupCoords, destCoords, controller.signal).then(route => {
      if (controller.signal.aborted || !route) return
      setTripRoute(route)
      if (rideId) saveRoute(rideId, route)
    })

    // When LIVE_ROUTING is on the trip route itself doesn't change,
    // only the approach (driver→pickup) is recalculated in useDriverLocation.
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, destCoords, rideId]) // LIVE_ROUTING is a module constant, not a dep

  const coords = useMemo(
    () => [pickupCoords, destCoords].filter(Boolean) as LatLng[],
    [pickupCoords, destCoords]
  )

  const center: LatLng = driverPosition ?? coords[0] ?? [51.1657, 10.4515]

  if (geocoding) {
    return (
      <div className="rm-map-skeleton" style={{ height }}>
        <div className="ride-spinner" aria-label="Karte wird geladen" />
      </div>
    )
  }

  if (coords.length === 0 && !driverPosition) return null

  return (
    <div className="rm-map-wrap">
      <MapContainer center={center} zoom={13} style={{ height }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsSync coords={coords} driverPosition={driverPosition} rideStatus={rideStatus} />

        {/* Approach route (driver → pickup): shown while driver is en route */}
        {rideStatus === 'pending' && approachPolyline && approachPolyline.length > 0 && (
          <Polyline positions={approachPolyline} color="#f59e0b" weight={4} opacity={0.8} />
        )}

        {/* Trip route (pickup → destination): shown once guest is picked up */}
        {rideStatus !== 'pending' && tripRoute && (
          <Polyline positions={tripRoute.polyline} color="#3b82f6" weight={4} opacity={0.75} />
        )}

        {pickupCoords && (
          <Marker position={pickupCoords} icon={pickupIcon}>
            <Popup>{pickupLocation}</Popup>
          </Marker>
        )}
        {destCoords && (
          <Marker position={destCoords} icon={destIcon}>
            <Popup>{destination}</Popup>
          </Marker>
        )}
        {driverPosition && (
          <Marker position={driverPosition} icon={driverIcon}>
            <Popup>Fahrer</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
