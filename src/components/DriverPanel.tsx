import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useDriverRequests } from '../hooks/useDriverRequests'
import { useDriverLocation } from '../hooks/useDriverLocation'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { RideMap } from './RideMap'
import { supabase } from '../utils/supabase'

type PartnerProfile = { first_name: string | null; family_name: string | null }

type RequestItemProps = {
  req: { id: string; guestInitials: string; guestName: string; pickupLocation: string; destination: string }
  isAccepting: boolean
  onAccept: (id: string) => void
}

function RequestItem({ req, isAccepting, onAccept }: RequestItemProps) {
  const { pickupName, destName } = useResolvedNames(undefined, req.pickupLocation, req.destination)

  return (
    <div className="rm-request-item">
      <div className="rm-partner__avatar rm-partner__avatar--sm">{req.guestInitials}</div>
      <div className="rm-request-item__info">
        <div className="rm-partner__label">Fahrtanfrage</div>
        <div className="rm-partner__name">{req.guestName}</div>
        {(req.pickupLocation || req.destination) && (
          <div className="rm-request-item__route">
            {req.pickupLocation && (
              <span className="rm-route-stop rm-route-stop--from">
                <span className="rm-route-stop__dot" />
                {pickupName}
              </span>
            )}
            {req.destination && (
              <span className="rm-route-stop rm-route-stop--to">
                <span className="rm-route-stop__dot" />
                {destName}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        className="rm-btn rm-btn--accept"
        onClick={() => onAccept(req.id)}
        disabled={isAccepting}
      >
        {isAccepting ? '...' : 'Annehmen'}
      </button>
    </div>
  )
}

export function DriverPanel() {
  const { user } = useAuth()
  const { requests, currentRide, status, isAccepting, error, acceptRequest } = useDriverRequests(
    user?.id ?? ''
  )
  const { driverPosition, approachPolyline } = useDriverLocation(
    currentRide?.id ?? null,
    currentRide?.pickup_location ?? undefined
  )
  const { pickupName, destName } = useResolvedNames(
    currentRide?.id,
    currentRide?.pickup_location,
    currentRide?.destination,
  )
  const [guest, setGuest] = useState<PartnerProfile | null>(null)
  const [completeSlider, setCompleteSlider] = useState(0)
  const [completing, setCompleting] = useState(false)

  const handleCompleteRelease = async () => {
    if (completeSlider < 90) { setCompleteSlider(0); return }
    if (!currentRide?.id) return
    setCompleting(true)
    const location = driverPosition ? `${driverPosition[0]},${driverPosition[1]}` : ''
    await supabase.rpc('complete_ride', { p_ride_id: currentRide.id, p_location: location })
    setCompleteSlider(0)
    setCompleting(false)
  }

  useEffect(() => {
    if (!currentRide?.guest_id) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', currentRide.guest_id)
      .single()
      .then(({ data }) => { if (data) setGuest(data) })
  }, [currentRide?.guest_id])

  const guestName = guest
    ? `${guest.first_name ?? ''} ${guest.family_name ?? ''}`.trim() || 'Gast'
    : 'Gast'

  const initials = guest
    ? `${guest.first_name?.[0] ?? ''}${guest.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  if (status === 'matched' && currentRide) {
    const statusLabel =
      currentRide.status === 'pending'    ? 'Unterwegs zum Gast' :
      currentRide.status === 'picked_up'  ? 'Gast eingestiegen'  :
      currentRide.status === 'active'     ? 'Fahrt läuft'        :
      currentRide.status === 'completed'  ? 'Fahrt beendet'      : currentRide.status

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

            {currentRide.status === 'picked_up' && (
              <div className="pickup-slider-wrap">
                <span className="pickup-slider-label">
                  {completing ? 'Wird abgeschlossen...' : 'Zum Beenden der Fahrt schieben →'}
                </span>
                <input
                  type="range"
                  className="pickup-slider"
                  min={0}
                  max={100}
                  value={completeSlider}
                  onChange={e => setCompleteSlider(Number(e.target.value))}
                  onMouseUp={handleCompleteRelease}
                  onTouchEnd={handleCompleteRelease}
                  disabled={completing}
                />
              </div>
            )}
          </div>

          {(currentRide.pickup_location || currentRide.destination) && (
            <div className="rm-ride-active__map">
              <RideMap
                pickupLocation={currentRide.pickup_location ?? ''}
                destination={currentRide.destination ?? ''}
                height={420}
                rideId={currentRide.id}
                driverPosition={driverPosition}
                rideStatus={currentRide.status}
                approachPolyline={approachPolyline}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rm-card">
      <div className="rm-requests-header">
        <h2>Fahrtanfragen</h2>
        {requests.length > 0 && (
          <span className="rm-requests-badge">{requests.length}</span>
        )}
      </div>

      {error && <p className="ride-error">{error}</p>}

      {requests.length === 0 ? (
        <>
          <div className="ride-spinner" aria-label="Warte auf Anfragen" />
          <p>Warte auf Fahrtanfragen...</p>
        </>
      ) : (
        <div className="rm-requests-list">
          {requests.map(req => (
            <RequestItem
              key={req.id}
              req={req}
              isAccepting={isAccepting}
              onAccept={acceptRequest}
            />
          ))}
        </div>
      )}
    </div>
  )
}
