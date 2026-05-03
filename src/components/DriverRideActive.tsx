import { useState, useEffect } from 'react'
import { dbService } from '../services'
import { useDriverLocation } from '../hooks/useDriverLocation'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import type { Ride } from '../types/ride'

type PartnerProfile = { first_name: string | null; family_name: string | null }

function openMapsToLocation(location: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const encoded = encodeURIComponent(location.trim())
  const url = isIOS
    ? `maps://?daddr=${encoded}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
  window.open(url, '_blank')
}

type Props = { ride: Ride }

export function DriverRideActive({ ride }: Props) {
  const [guest, setGuest] = useState<PartnerProfile | null>(null)
  const [completeSlider, setCompleteSlider] = useState(0)
  const [completing, setCompleting] = useState(false)

  const { driverPosition, approachPolyline } = useDriverLocation(ride.id, ride.pickup_location ?? undefined)
  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)

  useEffect(() => {
    if (!ride.guest_id) return
    dbService.getUserProfiles([ride.guest_id]).then(profiles => {
      if (profiles[0]) setGuest(profiles[0])
    })
  }, [ride.guest_id])

  const handleCompleteRelease = async () => {
    if (completeSlider < 90) { setCompleteSlider(0); return }
    setCompleting(true)
    const location = driverPosition ? `${driverPosition[0]},${driverPosition[1]}` : ''
    await dbService.completeRide(ride.id, location)
    setCompleteSlider(0); setCompleting(false)
  }

  const guestName = guest
    ? `${guest.first_name ?? ''} ${guest.family_name ?? ''}`.trim() || 'Gast'
    : 'Gast'

  const initials = guest
    ? `${guest.first_name?.[0] ?? ''}${guest.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  const statusLabel =
    ride.status === 'pending'   ? 'Unterwegs zum Gast' :
    ride.status === 'picked_up' ? 'Gast eingestiegen'  :
    ride.status === 'active'    ? 'Fahrt läuft'        :
    ride.status === 'completed' ? 'Fahrt beendet'      : ride.status

  return (
    <div className="rm-ride-active">
      <div className="rm-ride-active__header">
        <div className="rm-ride-active__icon">🚴</div>
        <div>
          <h1 className="rm-ride-active__title">Fahrt angenommen</h1>
          <p className="rm-ride-active__status">{statusLabel}</p>
        </div>
      </div>

      <div className="rm-ride-active__body">
        <div className="rm-ride-active__info">
          <div className="rm-partner">
            <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
            <div>
              <div className="rm-partner__label">Dein Gast</div>
              <div className="rm-partner__name">{guestName}</div>
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

          {ride.status === 'pending' && ride.pickup_location && (
            <button className="rm-btn rm-btn--maps" onClick={() => openMapsToLocation(ride.pickup_location!)}>
              📍 Navigation zum Abholort
            </button>
          )}

          {ride.status === 'picked_up' && ride.destination && (
            <button className="rm-btn rm-btn--maps" onClick={() => openMapsToLocation(ride.destination!)}>
              🗺️ Navigation zum Ziel
            </button>
          )}

          {ride.status === 'picked_up' && (
            <div className="pickup-slider-wrap">
              <span className="pickup-slider-label">
                {completing ? 'Wird abgeschlossen...' : 'Zum Beenden der Fahrt schieben →'}
              </span>
              <input
                type="range"
                className="pickup-slider"
                min={0} max={100}
                value={completeSlider}
                onChange={e => setCompleteSlider(Number(e.target.value))}
                onMouseUp={handleCompleteRelease}
                onTouchEnd={handleCompleteRelease}
                disabled={completing}
              />
            </div>
          )}
        </div>

        {(ride.pickup_location || ride.destination) && (
          <div className="rm-ride-active__map">
            <RideMap
              pickupLocation={ride.pickup_location ?? ''}
              destination={ride.destination ?? ''}
              height={420}
              rideId={ride.id}
              driverPosition={driverPosition}
              rideStatus={ride.status}
              approachPolyline={approachPolyline}
            />
          </div>
        )}
      </div>
    </div>
  )
}
