import { useState, useEffect } from 'react'
import type { LatLng } from '../utils/geocoding'
import { reverseGeocoder } from '../utils/reverseGeocoding'
import { AddressInput } from './AddressInput'
import { estimateFare, type FareEstimate } from '../utils/fareEstimate'
import { formatDuration, formatDistance } from '../utils/routing'
import { dbService, realtimeService } from '../services'
import type { RickshawType } from '../services'

const LANDMARKS: { label: string; icon: string; coords: [number, number] }[] = [
  { label: 'Bahnhof',   icon: '🚉', coords: [47.6605, 9.1751] },
  { label: 'Altstadt',  icon: '🏛️', coords: [47.6638, 9.1768] },
  { label: 'Universität', icon: '🎓', coords: [47.6957, 9.1918] },
  { label: 'Hafen',     icon: '⚓', coords: [47.6612, 9.1860] },
  { label: 'Lago',      icon: '🛍️', coords: [47.6574, 9.1793] },
  { label: 'Imperia',   icon: '🗿', coords: [47.6598, 9.1768] },
]

const FALLBACK_RICKSHAW_TYPES: RickshawType[] = [
  { id: 'fallback-small', name: 'Klein', capacity: 1, price_per_km: 2.5 },
  { id: 'fallback-standard', name: 'Standard', capacity: 2, price_per_km: 3 },
  { id: 'fallback-large', name: 'Groß', capacity: 4, price_per_km: 4 },
]

type Props = {
  onlineDrivers: number | null
  isLoading: boolean
  error: string | null
  onRequest: (pickup: string, destination: string, passengerCount: number, rickshawTypeId?: string | null) => Promise<void>
}

export function GuestBooking({ onlineDrivers, isLoading, error, onRequest }: Props) {
  const [pickupDisplay, setPickupDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
  const [pickupCoords, setPickupCoords] = useState<string | null>(null)
  const [pickupConfirmed, setPickupConfirmed] = useState(false)
  const [destConfirmed, setDestConfirmed] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [passengerCount, setPassengerCount] = useState(1)
  const [rickshawTypes, setRickshawTypes] = useState<RickshawType[]>([])
  const [selectedRickshawTypeId, setSelectedRickshawTypeId] = useState<string | null>(null)

  const [estimatePickup, setEstimatePickup] = useState<[number, number] | null>(null)
  const [estimateDest, setEstimateDest] = useState<[number, number] | null>(null)
  const [fareResult, setFareResult] = useState<FareEstimate | null>(null)
  const [fareLoading, setFareLoading] = useState(false)

  const availableTypes = rickshawTypes.length > 0 ? rickshawTypes : FALLBACK_RICKSHAW_TYPES
  const selectedType =
    availableTypes.find(type => type.id === selectedRickshawTypeId)
    ?? availableTypes.find(type => type.capacity >= passengerCount)
    ?? availableTypes[availableTypes.length - 1]
  const maxPassengers = selectedType?.capacity ?? Math.max(...availableTypes.map(type => type.capacity))

  useEffect(() => {
    const loadTypes = () => {
      dbService.getRickshawTypes().then(types => {
        if (types.length > 0) {
          setRickshawTypes(types)
          setSelectedRickshawTypeId(current => current ?? types[0]?.id ?? null)
        }
      })
    }
    loadTypes()
    return realtimeService.subscribeRickshawTypes(loadTypes)
  }, [])

  useEffect(() => {
    if (!estimatePickup || !estimateDest) { setFareResult(null); setFareLoading(false); return }
    setFareLoading(true)
    const controller = new AbortController()
    estimateFare(estimatePickup, estimateDest, selectedType.price_per_km, controller.signal).then(result => {
      if (!controller.signal.aborted) { setFareResult(result); setFareLoading(false) }
    })
    return () => controller.abort()
  }, [estimatePickup, estimateDest, selectedType.price_per_km])

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
        setPickupConfirmed(true)
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

  const selectLandmark = (label: string, coords: [number, number]) => {
    setDestDisplay(label)
    setEstimateDest(coords)
    setDestConfirmed(true)
  }

  const handlePickupConfirm = (displayName: string, coords: LatLng) => {
    setPickupDisplay(displayName.split(',').slice(0, 2).join(',').trim())
    setPickupCoords(`${coords[0]}, ${coords[1]}`)
    setEstimatePickup(coords)
    setPickupConfirmed(true)
  }

  const handlePickupClear = () => {
    setPickupCoords(null)
    setEstimatePickup(null)
    setPickupConfirmed(false)
  }

  const handleDestConfirm = (displayName: string, coords: LatLng) => {
    setDestDisplay(displayName.split(',').slice(0, 2).join(',').trim())
    setEstimateDest(coords)
    setDestConfirmed(true)
  }

  const handleDestClear = () => {
    setEstimateDest(null)
    setDestConfirmed(false)
  }

  const selectRickshawType = (type: RickshawType) => {
    setSelectedRickshawTypeId(type.id)
    setPassengerCount(current => Math.min(current, type.capacity))
  }

  const handleRequest = async () => {
    if (!pickupCoords || !estimateDest) return
    await onRequest(
      pickupCoords,
      `${estimateDest[0]}, ${estimateDest[1]}`,
      passengerCount,
      selectedType.id.startsWith('fallback-') ? null : selectedType.id,
    )
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
          <AddressInput
            placeholder="Startort"
            value={pickupDisplay}
            confirmed={pickupConfirmed}
            onChange={v => { setPickupDisplay(v); handlePickupClear() }}
            onConfirm={handlePickupConfirm}
            onClear={handlePickupClear}
            rightSlot={
              <button
                type="button"
                className="guest-route-card__locate"
                onClick={useCurrentLocation}
                disabled={locating}
                title="Aktuellen Standort verwenden"
              >
                {locating ? '…' : '📍'}
              </button>
            }
          />
        </div>
        <div className="guest-route-card__sep" />
        <div className="guest-route-card__row">
          <span className="guest-route-card__dot guest-route-card__dot--to" />
          <AddressInput
            placeholder="Ziel"
            value={destDisplay}
            confirmed={destConfirmed}
            onChange={v => { setDestDisplay(v); handleDestClear() }}
            onConfirm={handleDestConfirm}
            onClear={handleDestClear}
          />
        </div>
      </div>

      <div className="guest-landmarks" role="group" aria-label="Schnellziele">
        {LANDMARKS.map(lm => (
          <button
            key={lm.label}
            type="button"
            className={`guest-landmark-chip${destDisplay === lm.label ? ' guest-landmark-chip--active' : ''}`}
            onClick={() => selectLandmark(lm.label, lm.coords)}
          >
            <span>{lm.icon}</span>
            {lm.label}
          </button>
        ))}
      </div>

      <div className="guest-passengers" role="group" aria-label="Personenanzahl">
        <span className="guest-passengers__label">Personen</span>
        <div className="guest-passengers__options">
          {Array.from({ length: maxPassengers }, (_, index) => index + 1).map(count => (
            <button
              key={count}
              type="button"
              className={`guest-passengers__option${passengerCount === count ? ' guest-passengers__option--active' : ''}`}
              onClick={() => setPassengerCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="guest-rickshaw-types" role="radiogroup" aria-label="Rikscha-Modell">
        {availableTypes.map(type => (
          <button
            key={type.id}
            type="button"
            role="radio"
            aria-checked={selectedType.id === type.id}
            className={`guest-rickshaw-type${selectedType.id === type.id ? ' guest-rickshaw-type--active' : ''}`}
            onClick={() => selectRickshawType(type)}
          >
            <span className="guest-rickshaw-type__name">{type.name}</span>
            <span className="guest-rickshaw-type__meta">
              bis {type.capacity} {type.capacity === 1 ? 'Person' : 'Personen'}
            </span>
            <span className="guest-rickshaw-type__price">
              {type.price_per_km.toFixed(2).replace('.', ',')} €/km
            </span>
          </button>
        ))}
      </div>

      {locateError && <p className="ride-error guest-idle__error">{locateError}</p>}
      {(error || geocodeError) && <p className="ride-error guest-idle__error">{error ?? geocodeError}</p>}
      {estimatePickup && estimateDest && !fareLoading && !fareResult && (
        <p className="ride-error guest-idle__error">Route konnte nicht berechnet werden.</p>
      )}

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
        disabled={isLoading || fareLoading || !pickupConfirmed || !destConfirmed || (!!estimatePickup && !!estimateDest && !fareResult)}
      >
        <span>{isLoading ? 'Wird angefordert…' : 'Fahrer anfordern →'}</span>
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
