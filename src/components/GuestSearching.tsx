import { useEffect, useState } from 'react'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { geocode } from '../utils/geocoding'
import { router, formatDistance, formatDuration } from '../utils/routing'

type Props = {
  requestId?: string
  pickupLocation: string | null
  destination: string | null
  priceEur: number | null
  onCancel: () => void
}

function formatPrice(priceEur: number) {
  return `ca. ${priceEur.toFixed(2).replace('.', ',')} €`
}

function parseCoordString(value: string): [number, number] | null {
  const parts = value.split(',').map(part => Number(part.trim()))
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]]
  }
  return null
}

export function GuestSearching({ requestId, pickupLocation, destination, priceEur, onCancel }: Props) {
  const { pickupName, destName } = useResolvedNames(
    requestId,
    pickupLocation ?? undefined,
    destination ?? undefined,
  )
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const showRoute = pickupLocation || destination

  useEffect(() => {
    if (!pickupLocation || !destination) {
      setDistanceMeters(null)
      setDurationSeconds(null)
      setRouteLoading(false)
      return
    }

    const controller = new AbortController()
    setRouteLoading(true)

    const loadRoute = async () => {
      let pickup = parseCoordString(pickupLocation)
      let dest = parseCoordString(destination)

      if (!pickup) pickup = await geocode(pickupLocation, controller.signal)
      if (!dest) dest = await geocode(destination, controller.signal)

      if (!pickup || !dest || controller.signal.aborted) {
        if (!controller.signal.aborted) {
          setDistanceMeters(null)
          setDurationSeconds(null)
          setRouteLoading(false)
        }
        return
      }

      const route = await router.getRoute(pickup, dest, controller.signal)
      if (controller.signal.aborted) return

      if (route) {
        setDistanceMeters(route.distanceMeters)
        setDurationSeconds(route.durationSeconds)
      } else {
        setDistanceMeters(null)
        setDurationSeconds(null)
      }
      setRouteLoading(false)
    }

    void loadRoute()
    return () => controller.abort()
  }, [pickupLocation, destination])

  const showTripMeta = routeLoading || distanceMeters != null || durationSeconds != null

  return (
    <div className="rm-card">
      <h2>Suche Fahrer...</h2>

      {showRoute && (
        <div className="guest-search-summary" aria-label="Deine Fahrt">
          <div className="guest-search-summary__route">
            <div className="guest-search-summary__stop">
              <span className="guest-search-summary__dot guest-search-summary__dot--from" aria-hidden="true" />
              <div>
                <span className="guest-search-summary__label">Start</span>
                <span className="guest-search-summary__value">{pickupName || '–'}</span>
              </div>
            </div>
            <div className="guest-search-summary__line" aria-hidden="true" />
            <div className="guest-search-summary__stop">
              <span className="guest-search-summary__dot guest-search-summary__dot--to" aria-hidden="true" />
              <div>
                <span className="guest-search-summary__label">Ziel</span>
                <span className="guest-search-summary__value">{destName || '–'}</span>
              </div>
            </div>
          </div>

          {showTripMeta && (
            <div className="guest-search-summary__meta">
              {routeLoading ? (
                <span className="guest-search-summary__meta-loading">Route wird berechnet…</span>
              ) : (
                <>
                  {distanceMeters != null && (
                    <span className="guest-search-summary__meta-item">{formatDistance(distanceMeters)}</span>
                  )}
                  {distanceMeters != null && durationSeconds != null && (
                    <span className="guest-search-summary__meta-sep" aria-hidden="true">·</span>
                  )}
                  {durationSeconds != null && (
                    <span className="guest-search-summary__meta-item">{formatDuration(durationSeconds)}</span>
                  )}
                </>
              )}
            </div>
          )}

          {priceEur != null && (
            <div className="guest-search-summary__price">{formatPrice(priceEur)}</div>
          )}
        </div>
      )}

      <div className="guest-radar" aria-label="Suche läuft">
        <div className="guest-radar__ring" />
        <div className="guest-radar__ring" />
        <div className="guest-radar__ring" />
        <div className="guest-radar__dot" />
      </div>
      <p>Wir suchen einen verfügbaren Fahrer für dich.</p>
      <button className="rm-btn rm-btn--cancel" onClick={onCancel}>
        Abbrechen
      </button>
    </div>
  )
}
