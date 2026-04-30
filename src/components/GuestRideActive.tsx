import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { formatDuration } from '../utils/routing'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import type { Ride } from '../types/ride'

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

type Props = {
  ride: Ride
  userId: string
  onConfirmPickup: () => Promise<void>
}

export function GuestRideActive({ ride, userId, onConfirmPickup }: Props) {
  const [driver, setDriver] = useState<PartnerProfile | null>(null)
  const [driverPosition, setDriverPosition] = useState<[number, number] | null>(null)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [approachPolyline, setApproachPolyline] = useState<[number, number][] | null>(null)
  const [sliderValue, setSliderValue] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [existingStars, setExistingStars] = useState<number | null | 'loading'>('loading')
  const [selectedStars, setSelectedStars] = useState(0)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)

  useEffect(() => {
    if (!ride.driver_id) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', ride.driver_id)
      .single()
      .then(({ data }) => { if (data) setDriver(data) })
  }, [ride.driver_id])

  useEffect(() => {
    setDriverPosition(null)
    setEtaSeconds(null)
    setApproachPolyline(null)
    const channel = supabase
      .channel(`ride-location:${ride.id}`)
      .on('broadcast', { event: 'driver-location' }, ({ payload }) => {
        setDriverPosition([payload.lat as number, payload.lng as number])
        if (typeof payload.etaSeconds === 'number') setEtaSeconds(payload.etaSeconds)
        if (Array.isArray(payload.approachPolyline)) setApproachPolyline(payload.approachPolyline)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ride.id])

  useEffect(() => {
    if (ride.status !== 'completed' || !userId) return
    supabase
      .from('ride_reviews')
      .select('stars')
      .eq('ride_id', ride.id)
      .eq('reviewer_id', userId)
      .maybeSingle()
      .then(({ data }) => setExistingStars(data?.stars ?? null))
  }, [ride.id, ride.status, userId])

  const handleSliderRelease = async () => {
    if (sliderValue < 90) { setSliderValue(0); return }
    setConfirming(true)
    await onConfirmPickup()
    setSliderValue(0)
    setConfirming(false)
  }

  const submitReview = async () => {
    if (!selectedStars || !ride.driver_id || !userId) return
    setReviewSubmitting(true)
    setReviewError(null)
    const { error } = await supabase.from('ride_reviews').insert({
      ride_id: ride.id,
      reviewer_id: userId,
      reviewee_id: ride.driver_id,
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

  const title =
    ride.status === 'pending'   ? 'Fahrer ist unterwegs!' :
    ride.status === 'picked_up' ? 'Fahrt läuft'           :
    ride.status === 'active'    ? 'Fahrt läuft'           :
    'Fahrt beendet'

  const statusText =
    ride.status === 'pending'
      ? (driverPosition
          ? etaSeconds != null
            ? `${driverName} kommt in ca. ${formatDuration(etaSeconds)}`
            : `${driverName} ist auf dem Weg zu dir`
          : `Warte auf GPS von ${driverName}...`)
      : ride.status === 'picked_up' ? 'Unterwegs zum Ziel'
      : ride.status === 'active'    ? 'Genieße die Fahrt!'
      : 'Danke, dass du Rider genutzt hast!'

  const icon =
    ride.status === 'completed' ? '✓' :
    ride.status === 'pending'   ? '🛺' : '🚴'

  return (
    <div className="rm-ride-active">
      <div className="rm-ride-active__header">
        <div className="rm-ride-active__icon">{icon}</div>
        <div>
          <h1 className="rm-ride-active__title">{title}</h1>
          <p className="rm-ride-active__status">{statusText}</p>
        </div>
      </div>

      {ride.status === 'completed' && existingStars !== 'loading' && (
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

      {ride.status !== 'completed' && (
        <div className="rm-ride-active__body">
          <div className="rm-ride-active__info">
            <div className="rm-partner">
              <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
              <div>
                <div className="rm-partner__label">Dein Fahrer</div>
                <div className="rm-partner__name">{driverName}</div>
              </div>
            </div>

            {(ride.pickup_location || ride.destination) && (
              <div className="rm-ride-active__route">
                {ride.pickup_location && (
                  <div className="rm-route-row">
                    <span className="rm-route-row__dot rm-route-row__dot--from" />
                    <div>
                      <div className="rm-route-row__label">Abholung</div>
                      <div className="rm-route-row__value">{pickupName}</div>
                    </div>
                  </div>
                )}
                {ride.pickup_location && ride.destination && (
                  <div className="rm-route-row__line" />
                )}
                {ride.destination && (
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

            {ride.status === 'pending' && (
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

            {(ride.status === 'picked_up' || ride.status === 'active') && (
              <div className="guest-active">
                <div className="guest-active__dot" />
                <span>
                  {ride.status === 'picked_up' ? 'Unterwegs zum Ziel!' : 'Genieße die Fahrt!'}
                </span>
              </div>
            )}
          </div>

          <div className="rm-ride-active__map">
            <RideMap
              pickupLocation={ride.pickup_location ?? ''}
              destination={ride.destination ?? ''}
              driverPosition={driverPosition}
              height={420}
              rideId={ride.id}
              rideStatus={ride.status}
              approachPolyline={ride.status === 'pending' ? approachPolyline : null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
