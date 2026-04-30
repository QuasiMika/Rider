import { useState, useEffect } from 'react'
import { geocode } from '../utils/geocoding'
import { reverseGeocoder } from '../utils/reverseGeocoding'
import { estimateFare, type FareEstimate } from '../utils/fareEstimate'
import { formatDuration, formatDistance } from '../utils/routing'

type Props = {
  onlineDrivers: number | null
  isLoading: boolean
  error: string | null
  onRequest: (pickup: string, destination: string) => Promise<void>
}

export function GuestBooking({ onlineDrivers, isLoading, error, onRequest }: Props) {
  const [pickupDisplay, setPickupDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
  const [pickupCoords, setPickupCoords] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const [estimatePickup, setEstimatePickup] = useState<[number, number] | null>(null)
  const [estimateDest, setEstimateDest] = useState<[number, number] | null>(null)
  const [fareResult, setFareResult] = useState<FareEstimate | null>(null)

  useEffect(() => {
    if (!estimatePickup || !estimateDest) { setFareResult(null); return }
    const controller = new AbortController()
    estimateFare(estimatePickup, estimateDest, controller.signal).then(result => {
      if (!controller.signal.aborted) setFareResult(result)
    })
    return () => controller.abort()
  }, [estimatePickup, estimateDest])

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation wird von diesem Browser nicht unterstützt.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const coordStr = `${coords.latitude}, ${coords.longitude}`
        setPickupCoords(coordStr)
        setEstimatePickup([coords.latitude, coords.longitude])
        const name = await reverseGeocoder.lookupName(coords.latitude, coords.longitude)
        setPickupDisplay(name ?? coordStr)
        setLocating(false)
      },
      () => {
        setLocateError('Standort konnte nicht ermittelt werden.')
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }

  const handlePickupBlur = async () => {
    if (pickupCoords) {
      const [lat, lng] = pickupCoords.split(',').map(Number)
      setEstimatePickup([lat, lng])
    } else if (pickupDisplay.trim()) {
      const ll = await geocode(pickupDisplay.trim())
      if (ll) setEstimatePickup(ll)
    }
  }

  const handleDestBlur = async () => {
    if (destDisplay.trim()) {
      const ll = await geocode(destDisplay.trim())
      if (ll) setEstimateDest(ll)
    }
  }

  const handleRequest = async () => {
    setGeocodeError(null)
    setGeocoding(true)
    let pickup = pickupCoords
    if (!pickup) {
      const ll = await geocode(pickupDisplay.trim())
      if (!ll) { setGeocodeError('Startort konnte nicht gefunden werden.'); setGeocoding(false); return }
      pickup = `${ll[0]}, ${ll[1]}`
    }
    const ll = await geocode(destDisplay.trim())
    if (!ll) { setGeocodeError('Ziel konnte nicht gefunden werden.'); setGeocoding(false); return }
    setGeocoding(false)
    await onRequest(pickup, `${ll[0]}, ${ll[1]}`)
  }

  return (
    <div className="guest-idle">
      <div className="guest-idle__visual">🛺</div>

      <div className="guest-idle__heading">
        <h1>Wohin soll's gehen?</h1>
      </div>

      <div className="guest-route-card">
        <div className="guest-route-card__row">
          <span className="guest-route-card__dot guest-route-card__dot--from" />
          <input
            id="pickup"
            className="guest-route-card__input"
            type="text"
            placeholder="Startort"
            value={pickupDisplay}
            onChange={e => { setPickupDisplay(e.target.value); setPickupCoords(null); setEstimatePickup(null) }}
            onBlur={handlePickupBlur}
          />
          <button
            type="button"
            className="guest-route-card__locate"
            onClick={useCurrentLocation}
            disabled={locating}
            title="Aktuellen Standort verwenden"
          >
            {locating ? '…' : '📍'}
          </button>
        </div>
        <div className="guest-route-card__sep" />
        <div className="guest-route-card__row">
          <span className="guest-route-card__dot guest-route-card__dot--to" />
          <input
            id="destination"
            className="guest-route-card__input"
            type="text"
            placeholder="Ziel"
            value={destDisplay}
            onChange={e => { setDestDisplay(e.target.value); setEstimateDest(null) }}
            onBlur={handleDestBlur}
          />
        </div>
      </div>

      {locateError && <p className="ride-error guest-idle__error">{locateError}</p>}
      {(error || geocodeError) && <p className="ride-error guest-idle__error">{error ?? geocodeError}</p>}

      {fareResult && (
        <div className="guest-fare-estimate">
          <span className="guest-fare-estimate__distance">{formatDistance(fareResult.distanceKm * 1000)}</span>
          <span className="guest-fare-estimate__sep">·</span>
          <span className="guest-fare-estimate__duration">{formatDuration(fareResult.durationSeconds)}</span>
          <span className="guest-fare-estimate__sep">·</span>
          <span className="guest-fare-estimate__price">ca. {fareResult.price.toFixed(2).replace('.', ',')} €</span>
        </div>
      )}

      <button
        className="rm-btn guest-idle__cta"
        onClick={handleRequest}
        disabled={isLoading || geocoding || !pickupDisplay.trim() || !destDisplay.trim()}
      >
        <span>{geocoding ? 'Ort wird gesucht…' : isLoading ? 'Wird angefordert…' : 'Fahrer anfordern →'}</span>
      </button>
      {onlineDrivers !== null && (
        <span className={`guest-drivers-online${onlineDrivers === 0 ? ' guest-drivers-online--none' : ''}`}>
          <span className="guest-drivers-online__dot" />
          {onlineDrivers === 0 ? 'Kein Fahrer online' : `${onlineDrivers} Fahrer online`}
        </span>
      )}
    </div>
  )
}
