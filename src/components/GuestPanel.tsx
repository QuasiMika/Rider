import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import { supabase } from '../utils/supabase'
import { formatDuration } from '../utils/routing'
import { geocode } from '../utils/geocoding'
import { reverseGeocoder } from '../utils/reverseGeocoding'
import './GuestPanel.css'

type PartnerProfile = { first_name: string | null; family_name: string | null }

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-picker__star ${n <= (hovered || value) ? 'star-picker__star--on' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} Stern${n > 1 ? 'e' : ''}`}
        >★</button>
      ))}
    </div>
  )
}

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

  const [pickupDisplay, setPickupDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
  const [pickupCoords, setPickupCoords] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  const [existingStars, setExistingStars] = useState<number | null | 'loading'>('loading')
  const [selectedStars, setSelectedStars] = useState(0)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

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
        const coordStr = `${coords.latitude}, ${coords.longitude}`
        setPickupCoords(coordStr)
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
    await requestRide(pickup, `${ll[0]}, ${ll[1]}`)
  }

  const handleSliderRelease = async () => {
    if (sliderValue < 90) { setSliderValue(0); return }
    setConfirming(true)
    await confirmPickup()
    setSliderValue(0)
    setConfirming(false)
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

  useEffect(() => {
    if (!currentRide?.id || currentRide.status !== 'completed' || !user?.id) return
    supabase
      .from('ride_reviews')
      .select('stars')
      .eq('ride_id', currentRide.id)
      .eq('reviewer_id', user.id)
      .maybeSingle()
      .then(({ data }) => setExistingStars(data?.stars ?? null))
  }, [currentRide?.id, currentRide?.status, user?.id])

  const submitReview = async () => {
    if (!selectedStars || !currentRide?.driver_id || !user?.id) return
    setReviewSubmitting(true)
    setReviewError(null)
    const { error } = await supabase.from('ride_reviews').insert({
      ride_id: currentRide.id,
      reviewer_id: user.id,
      reviewee_id: currentRide.driver_id,
      stars: selectedStars,
    })
    if (error) setReviewError(error.message)
    else setExistingStars(selectedStars)
    setReviewSubmitting(false)
  }

  const driverName = driver
    ? `${driver.first_name ?? ''} ${driver.family_name ?? ''}`.trim() || 'Fahrer'
    : 'Fahrer'

  const initials = driver
    ? `${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  // ── Active ride ────────────────────────────────────────────────────────────
  if (status === 'matched' && currentRide) {
    const title =
      currentRide.status === 'pending'   ? 'Fahrer ist unterwegs!' :
      currentRide.status === 'picked_up' ? 'Fahrt läuft'           :
      currentRide.status === 'active'    ? 'Fahrt läuft'           :
      'Fahrt beendet'

    const statusText =
      currentRide.status === 'pending'
        ? (driverPosition
            ? etaSeconds != null
              ? `${driverName} kommt in ca. ${formatDuration(etaSeconds)}`
              : `${driverName} ist auf dem Weg zu dir`
            : `Warte auf GPS von ${driverName}...`)
        : currentRide.status === 'picked_up' ? 'Unterwegs zum Ziel'
        : currentRide.status === 'active'    ? 'Genieße die Fahrt!'
        : 'Danke, dass du Rider genutzt hast!'

    const icon =
      currentRide.status === 'completed' ? '✓' :
      currentRide.status === 'pending'   ? '🛺' : '🚴'

    return (
      <div className="rm-ride-active">
        <div className="rm-ride-active__header">
          <div className="rm-ride-active__icon">{icon}</div>
          <div>
            <h1 className="rm-ride-active__title">{title}</h1>
            <p className="rm-ride-active__status">{statusText}</p>
          </div>
        </div>

        {currentRide.status === 'completed' && existingStars !== 'loading' && (
          <div className="guest-completed">
            <div className="rm-partner">
              <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
              <div>
                <div className="rm-partner__label">Dein Fahrer</div>
                <div className="rm-partner__name">{driverName}</div>
              </div>
            </div>

            {existingStars === null ? (
              <div className="guest-review">
                <div className="guest-review__title">Fahrer bewerten</div>
                <StarPicker value={selectedStars} onChange={setSelectedStars} />
                {reviewError && <p className="ride-error">{reviewError}</p>}
                <button
                  className="rm-btn"
                  onClick={submitReview}
                  disabled={reviewSubmitting || selectedStars === 0}
                >
                  {reviewSubmitting ? 'Wird gespeichert...' : 'Bewertung abgeben'}
                </button>
              </div>
            ) : (
              <div className="guest-review">
                <div className="guest-review__title">Deine Bewertung</div>
                <div className="star-picker">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} className={`star-picker__star ${n <= existingStars ? 'star-picker__star--on' : ''}`}>★</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentRide.status !== 'completed' && (
          <div className="rm-ride-active__body">
            <div className="rm-ride-active__info">
              <div className="rm-partner">
                <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
                <div>
                  <div className="rm-partner__label">Dein Fahrer</div>
                  <div className="rm-partner__name">{driverName}</div>
                </div>
              </div>

              {(currentRide.pickup_location || currentRide.destination) && (
                <div className="rm-ride-active__route">
                  {currentRide.pickup_location && (
                    <div className="rm-route-row">
                      <span className="rm-route-row__dot rm-route-row__dot--from" />
                      <div>
                        <div className="rm-route-row__label">Abholung</div>
                        <div className="rm-route-row__value">{pickupName}</div>
                      </div>
                    </div>
                  )}
                  {currentRide.pickup_location && currentRide.destination && (
                    <div className="rm-route-row__line" />
                  )}
                  {currentRide.destination && (
                    <div className="rm-route-row">
                      <span className="rm-route-row__dot rm-route-row__dot--to" />
                      <div>
                        <div className="rm-route-row__label">Ziel</div>
                        <div className="rm-route-row__value">{destName}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentRide.status === 'pending' && (
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
              )}

              {(currentRide.status === 'picked_up' || currentRide.status === 'active') && (
                <div className="guest-active">
                  <div className="guest-active__dot" />
                  <span>
                    {currentRide.status === 'picked_up' ? 'Unterwegs zum Ziel!' : 'Genieße die Fahrt!'}
                  </span>
                </div>
              )}
            </div>

            <div className="rm-ride-active__map">
              <RideMap
                pickupLocation={currentRide.pickup_location ?? ''}
                destination={currentRide.destination ?? ''}
                driverPosition={driverPosition}
                height={420}
                rideId={currentRide.id}
                rideStatus={currentRide.status}
                approachPolyline={currentRide.status === 'pending' ? approachPolyline : null}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Searching ──────────────────────────────────────────────────────────────
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

  // ── Idle / request form ────────────────────────────────────────────────────
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
            value={pickupDisplay}
            onChange={e => { setPickupDisplay(e.target.value); setPickupCoords(null) }}
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
            value={destDisplay}
            onChange={e => setDestDisplay(e.target.value)}
          />
        </div>
      </div>

      {(error || geocodeError) && <p className="ride-error">{error ?? geocodeError}</p>}
      <button
        className="rm-btn"
        onClick={handleRequest}
        disabled={isLoading || geocoding || !pickupDisplay.trim() || !destDisplay.trim()}
      >
        {geocoding ? 'Ort wird gesucht...' : isLoading ? 'Wird angefordert...' : 'Fahrer anfordern'}
      </button>
    </div>
  )
}
