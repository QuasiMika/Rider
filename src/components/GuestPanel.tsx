import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import { supabase } from '../utils/supabase'
import { formatDuration } from '../utils/routing'
import { reverseGeocoder } from '../utils/reverseGeocoding'
import './GuestPanel.css'

type PartnerProfile = { first_name: string | null; family_name: string | null }

export function GuestPanel() {
  const { user } = useAuth()
  const { requestRide, cancelRequest, confirmPickup, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? '',
    'guest'
  )
  const [driver, setDriver] = useState<PartnerProfile | null>(null)
  const [driverPosition, setDriverPosition] = useState<[number, number] | null>(null)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [approachPolyline, setApproachPolyline] = useState<[number, number][] | null>(null)
  const [sliderValue, setSliderValue] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [pickupLocation, setPickupLocation] = useState('')
  const [destination, setDestination] = useState('')
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  // Resolved place names for the matched ride (cached in localStorage per ride ID)
  const { pickupName, destName } = useResolvedNames(
    currentRide?.id,
    currentRide?.pickup_location,
    currentRide?.destination,
  )

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation wird von diesem Browser nicht unterstützt.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const name = await reverseGeocoder.lookupName(coords.latitude, coords.longitude)
        setPickupLocation(name ?? `${coords.latitude}, ${coords.longitude}`)
        setLocating(false)
      },
      () => {
        setLocateError('Standort konnte nicht ermittelt werden.')
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }

  useEffect(() => {
    if (!currentRide?.driver_id) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', currentRide.driver_id)
      .single()
      .then(({ data }) => { if (data) setDriver(data) })
  }, [currentRide?.driver_id])

  useEffect(() => {
    if (!currentRide?.id) return
    setDriverPosition(null)
    setEtaSeconds(null)
    setApproachPolyline(null)
    const channel = supabase
      .channel(`ride-location:${currentRide.id}`)
      .on('broadcast', { event: 'driver-location' }, ({ payload }) => {
        setDriverPosition([payload.lat as number, payload.lng as number])
        if (typeof payload.etaSeconds === 'number') setEtaSeconds(payload.etaSeconds)
        if (Array.isArray(payload.approachPolyline)) setApproachPolyline(payload.approachPolyline)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentRide?.id])

  const handleSliderRelease = async () => {
    if (sliderValue < 90) { setSliderValue(0); return }
    setConfirming(true)
    await confirmPickup()
    setSliderValue(0)
    setConfirming(false)
  }

  const driverName = driver
    ? `${driver.first_name ?? ''} ${driver.family_name ?? ''}`.trim() || 'Fahrer'
    : 'Fahrer'

  const initials = driver
    ? `${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  // Driver is on the way
  if (status === 'matched' && currentRide?.status === 'pending') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrer ist unterwegs!</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Fahrer</div>
            <div className="rm-partner__name">{driverName}</div>
          </div>
        </div>
        <RideMap
          pickupLocation={currentRide.pickup_location ?? ''}
          destination={currentRide.destination ?? ''}
          driverPosition={driverPosition}
          height={260}
          rideId={currentRide.id}
          rideStatus={currentRide.status}
          approachPolyline={approachPolyline}
        />
        {(pickupName || destName) && (
          <div className="rm-route-mini">
            {pickupName && <span className="rm-route-mini__from">{pickupName}</span>}
            {pickupName && destName && <span className="rm-route-mini__arrow">→</span>}
            {destName && <span className="rm-route-mini__to">{destName}</span>}
          </div>
        )}
        <p>
          {driverPosition
            ? etaSeconds != null
              ? `${driverName} kommt in ca. ${formatDuration(etaSeconds)}.`
              : `${driverName} ist auf dem Weg zu dir.`
            : `Warte auf GPS von ${driverName}...`}
        </p>
        <div className="pickup-slider-wrap">
          <span className="pickup-slider-label">
            {confirming ? 'Bestätige...' : 'Zum Bestätigen der Abholung schieben →'}
          </span>
          <input
            type="range"
            className="pickup-slider"
            min={0}
            max={100}
            value={sliderValue}
            onChange={e => setSliderValue(Number(e.target.value))}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease}
            disabled={confirming}
          />
        </div>
      </div>
    )
  }

  // Picked up — trip route to destination
  if (status === 'matched' && currentRide?.status === 'picked_up') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt läuft 🚴</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Fahrer</div>
            <div className="rm-partner__name">{driverName}</div>
          </div>
        </div>
        <RideMap
          pickupLocation={currentRide.pickup_location ?? ''}
          destination={currentRide.destination ?? ''}
          driverPosition={driverPosition}
          height={260}
          rideId={currentRide.id}
          rideStatus={currentRide.status}
        />
        {(pickupName || destName) && (
          <div className="rm-route-mini">
            {pickupName && <span className="rm-route-mini__from">{pickupName}</span>}
            {pickupName && destName && <span className="rm-route-mini__arrow">→</span>}
            {destName && <span className="rm-route-mini__to">{destName}</span>}
          </div>
        )}
        <div className="guest-active">
          <div className="guest-active__dot" />
          <span>Unterwegs zum Ziel!</span>
        </div>
      </div>
    )
  }

  // Ride is active
  if (status === 'matched' && currentRide?.status === 'active') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt läuft 🚴</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Fahrer</div>
            <div className="rm-partner__name">{driverName}</div>
          </div>
        </div>
        <RideMap
          pickupLocation={currentRide.pickup_location ?? ''}
          destination={currentRide.destination ?? ''}
          driverPosition={driverPosition}
          height={260}
          rideId={currentRide.id}
          rideStatus={currentRide.status}
        />
        {(pickupName || destName) && (
          <div className="rm-route-mini">
            {pickupName && <span className="rm-route-mini__from">{pickupName}</span>}
            {pickupName && destName && <span className="rm-route-mini__arrow">→</span>}
            {destName && <span className="rm-route-mini__to">{destName}</span>}
          </div>
        )}
        <div className="guest-active">
          <div className="guest-active__dot" />
          <span>Genieße die Fahrt!</span>
        </div>
      </div>
    )
  }

  // Ride completed
  if (status === 'matched' && currentRide?.status === 'completed') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt beendet ✓</h2>
        <p>Danke, dass du Rider genutzt hast!</p>
      </div>
    )
  }

  // Searching for driver
  if (status === 'waiting') {
    return (
      <div className="rm-card">
        <h2>Suche Fahrer...</h2>
        <div className="guest-radar" aria-label="Suche läuft">
          <div className="guest-radar__ring" />
          <div className="guest-radar__ring" />
          <div className="guest-radar__ring" />
          <div className="guest-radar__dot" />
        </div>
        <p>Wir suchen einen verfügbaren Fahrer für dich.</p>
        <button className="rm-btn rm-btn--cancel" onClick={cancelRequest}>
          Abbrechen
        </button>
      </div>
    )
  }

  return (
    <div className="rm-card">
      <h2>Wohin soll's gehen?</h2>
      <p>Gib deinen Start- und Zielort an, um einen Fahrer anzufordern.</p>

      <div className="rm-fields">
        <div className="rm-field">
          <div className="rm-field__header">
            <label className="rm-label" htmlFor="pickup">Startort</label>
            <button
              type="button"
              className="rm-locate-btn"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              {locating ? 'Ermittle...' : '📍 Standort'}
            </button>
          </div>
          <input
            id="pickup"
            className="rm-input"
            type="text"
            placeholder="z. B. Hauptbahnhof"
            value={pickupLocation}
            onChange={e => setPickupLocation(e.target.value)}
          />
          {locateError && <p className="ride-error" style={{ fontSize: 12 }}>{locateError}</p>}
        </div>
        <div className="rm-field">
          <label className="rm-label" htmlFor="destination">Ziel</label>
          <input
            id="destination"
            className="rm-input"
            type="text"
            placeholder="z. B. Flughafen"
            value={destination}
            onChange={e => setDestination(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="ride-error">{error}</p>}
      <button
        className="rm-btn"
        onClick={() => requestRide(pickupLocation.trim(), destination.trim())}
        disabled={isLoading || !pickupLocation.trim() || !destination.trim()}
      >
        {isLoading ? 'Wird angefordert...' : 'Fahrer anfordern'}
      </button>
    </div>
  )
}
