import { useState, useEffect } from 'react'
import { dbService, realtimeService } from '../services'
import type { DriverLocationPayload } from '../services'
import { formatDuration } from '../utils/routing'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import type { Ride } from '../types/ride'

type PartnerProfile = { first_name: string | null; family_name: string | null }

type Props = {
  ride: Ride
  onConfirmPickup: () => Promise<void>
}

export function GuestRideActive({ ride, onConfirmPickup }: Props) {
  const [driver, setDriver] = useState<PartnerProfile | null>(null)
  const [driverPosition, setDriverPosition] = useState<[number, number] | null>(null)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [approachPolyline, setApproachPolyline] = useState<[number, number][] | null>(null)
  const [sliderValue, setSliderValue] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)

  useEffect(() => {
    if (!ride.driver_id) return
    dbService.getUserProfiles([ride.driver_id]).then(profiles => {
      if (profiles[0]) setDriver(profiles[0])
    })
  }, [ride.driver_id])

  useEffect(() => {
    setDriverPosition(null); setEtaSeconds(null); setApproachPolyline(null)
    return realtimeService.subscribeDriverLocation(ride.id, (payload: DriverLocationPayload) => {
      setDriverPosition([payload.lat, payload.lng])
      if (typeof payload.etaSeconds === 'number') setEtaSeconds(payload.etaSeconds)
      if (Array.isArray(payload.approachPolyline)) setApproachPolyline(payload.approachPolyline as [number, number][])
    })
  }, [ride.id])

  const handleSliderRelease = async () => {
    if (sliderValue < 90) { setSliderValue(0); return }
    setConfirming(true)
    await onConfirmPickup()
    setSliderValue(0); setConfirming(false)
  }

  const driverName = driver
    ? `${driver.first_name ?? ''} ${driver.family_name ?? ''}`.trim() || 'Fahrer'
    : 'Fahrer'

  const initials = driver
    ? `${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  const statusText =
    ride.status === 'pending'
      ? (driverPosition
        ? etaSeconds != null
          ? `ist auf dem Weg zu dir -  ${formatDuration(etaSeconds)}`
          : `ist auf dem Weg zu dir`
        : `Warte auf GPS…`)
      : ride.status === 'picked_up' ? 'Unterwegs zum Ziel'
        : 'Genieße die Fahrt!'

  return (
    <div className="rm-ride-active">
      <div className="rm-ride-active__body">
        <div className="rm-ride-active__info">
          <div className="rm-partner">
            <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
            <div>
              <div className="rm-partner__label">Dein Fahrer</div>
              <div className="rm-partner__name">{driverName}</div>
              <div className="rm-partner__status">{statusText}</div>
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
              {ride.pickup_location && ride.destination && <div className="rm-route-row__line" />}
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
                {confirming ? 'Bestätige…' : 'Zum Bestätigen der Abholung schieben →'}
              </span>
              <input
                type="range"
                className="pickup-slider"
                min={0} max={100}
                value={sliderValue}
                onChange={e => setSliderValue(Number(e.target.value))}
                onMouseUp={handleSliderRelease}
                onTouchEnd={handleSliderRelease}
                disabled={confirming}
              />
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
        {(ride.status === 'picked_up' || ride.status === 'active') && (
          <div className="guest-active">
            <div className="guest-active__dot" />
            <span>
              {ride.status === 'picked_up' ? 'Unterwegs zum Ziel!' : 'Genieße die Fahrt!'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
