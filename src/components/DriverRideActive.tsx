import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faRoute } from '@fortawesome/free-solid-svg-icons'
import { dbService } from '../services'
import { useDriverLocation } from '../hooks/useDriverLocation'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { useChatMessages } from '../hooks/useChatMessages'
import { geocode, type LatLng } from '../utils/geocoding'
import { RideMap } from './RideMap'
import { ChatButton } from './ChatButton'
import { ChatDrawer } from './ChatDrawer'
import type { Ride } from '../types/ride'

type PartnerProfile = { first_name: string | null; family_name: string | null }

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const mapsApp = isIOS ? 'Apple Maps' : 'Google Maps'

function openMapsToLocation(location: string) {
  const encoded = encodeURIComponent(location.trim())
  const url = isIOS
    ? `maps://?daddr=${encoded}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
  window.open(url, '_blank')
}

type Props = { ride: Ride; currentUserId: string }

const NO_SHOW_WAIT_MS = 5 * 60 * 1000
const ARRIVAL_RADIUS_METERS = 50

function distanceMeters(a: LatLng, b: LatLng) {
  const earthRadius = 6371000
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

export function DriverRideActive({ ride, currentUserId }: Props) {
  const [guest, setGuest] = useState<PartnerProfile | null>(null)
  const [completeSlider, setCompleteSlider] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [pickupCode, setPickupCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [cancellingNoShow, setCancellingNoShow] = useState(false)
  const [noShowError, setNoShowError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null)
  const autoArrivalRequestedRef = useRef(false)

  const { driverPosition, approachPolyline } = useDriverLocation(ride.id, ride.pickup_location ?? undefined)
  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)
  const { messages, unreadCount, isOpen, openChat, closeChat, sendMessage } = useChatMessages(ride.id, currentUserId)

  useEffect(() => {
    if (!ride.guest_id) return
    dbService.getUserProfiles([ride.guest_id]).then(profiles => {
      if (profiles[0]) setGuest(profiles[0])
    })
  }, [ride.guest_id])

  useEffect(() => {
    autoArrivalRequestedRef.current = false
  }, [ride.id])

  useEffect(() => {
    if (ride.status !== 'arrived') return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [ride.status, ride.arrived_at])

  useEffect(() => {
    if (!ride.pickup_location) { setPickupCoords(null); return }
    const controller = new AbortController()
    geocode(ride.pickup_location, controller.signal).then(coords => {
      if (!controller.signal.aborted) setPickupCoords(coords)
    })
    return () => controller.abort()
  }, [ride.pickup_location])

  const handleCompleteRelease = async () => {
    if (completeSlider < 90) { setCompleteSlider(0); return }
    setCompleting(true)
    const location = driverPosition ? `${driverPosition[0]},${driverPosition[1]}` : ''
    await dbService.completeRide(ride.id, location)
    setCompleteSlider(0); setCompleting(false)
  }

  const handleConfirmPickup = async () => {
    if (pickupCode.length !== 4) return
    setVerifying(true)
    setCodeError(null)
    const ok = await dbService.confirmPickupByDriver(ride.id, pickupCode)
    if (!ok) {
      setCodeError('Falscher Code. Bitte erneut versuchen.')
    }
    setVerifying(false)
  }

  const markArrivedFromLocation = async () => {
    setNoShowError(null)
    const ok = await dbService.markDriverArrived(ride.id)
    if (!ok) setNoShowError('Ankunft konnte nicht gespeichert werden.')
  }

  const handleCancelNoShow = async () => {
    setCancellingNoShow(true)
    setNoShowError(null)
    const ok = await dbService.cancelRideNoShow(ride.id)
    if (!ok) setNoShowError('Die Fahrt konnte noch nicht storniert werden.')
    setCancellingNoShow(false)
  }

  const arrivedAt = ride.arrived_at ? new Date(ride.arrived_at).getTime() : null
  const noShowRemainingMs = arrivedAt ? Math.max(0, arrivedAt + NO_SHOW_WAIT_MS - now) : NO_SHOW_WAIT_MS
  const canCancelNoShow = ride.status === 'arrived' && noShowRemainingMs <= 0

  useEffect(() => {
    if (ride.status !== 'pending' || !driverPosition || !pickupCoords || autoArrivalRequestedRef.current) return
    if (distanceMeters(driverPosition, pickupCoords) > ARRIVAL_RADIUS_METERS) return
    autoArrivalRequestedRef.current = true
    void markArrivedFromLocation()
  }, [ride.status, driverPosition, pickupCoords])

  const guestName = guest
    ? `${guest.first_name ?? ''} ${guest.family_name ?? ''}`.trim() || 'Gast'
    : 'Gast'

  const initials = guest
    ? `${guest.first_name?.[0] ?? ''}${guest.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'


  return (
    <div className="rm-ride-active">
      {isOpen && (
        <div className="chat-overlay" onClick={closeChat}>
          <ChatDrawer
            messages={messages}
            currentUserId={currentUserId}
            onClose={closeChat}
            onSend={sendMessage}
          />
        </div>
      )}
      <div className="rm-ride-active__body">
        <div className="rm-ride-active__info">
          <div className="rm-partner">
            <div className="rm-partner__avatar rm-partner__avatar--lg">{initials}</div>
            <div>
              <div className="rm-partner__label">Dein Gast</div>
              <div className="rm-partner__name">{guestName}</div>
            </div>
          </div>
          <div className="rm-chat-row">
            <ChatButton unreadCount={unreadCount} onClick={openChat} />
            <span className="rm-chat-row__label">Gast kontaktieren</span>
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
              <span className="rm-btn--maps__main"><FontAwesomeIcon icon={faLocationDot} /> Zum Abholort navigieren</span>
              <span className="rm-btn--maps__sub">Öffnet {mapsApp}</span>
            </button>
          )}

          {ride.status === 'arrived' && (
            <div className="no-show-panel">
              <div className="no-show-panel__label">Wartezeit am Abholort</div>
              {canCancelNoShow ? (
                <button className="rm-btn rm-btn--danger" onClick={handleCancelNoShow} disabled={cancellingNoShow}>
                  {cancellingNoShow ? 'Wird storniert...' : 'Fahrgast nicht aufgetaucht'}
                </button>
              ) : (
                <button className="rm-btn rm-btn--waiting" disabled>
                  Warten auf Fahrgast
                </button>
              )}
            </div>
          )}

          {(ride.status === 'pending' || ride.status === 'arrived') && (
            <div className="pickup-code-input">
              <div className="pickup-code-input__label">Abholcode des Fahrgasts</div>
              <div className="pickup-code-input__row">
                <input
                  className="pickup-code-input__field"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={pickupCode}
                  onChange={e => { setPickupCode(e.target.value.replace(/\D/g, '')); setCodeError(null) }}
                />
                <button
                  className="rm-btn rm-btn--accept"
                  onClick={handleConfirmPickup}
                  disabled={pickupCode.length !== 4 || verifying}
                >
                  {verifying ? 'Prüfe…' : 'Bestätigen'}
                </button>
              </div>
              {codeError && <div className="pickup-code-input__error">{codeError}</div>}
            </div>
          )}
          {noShowError && <div className="pickup-code-input__error">{noShowError}</div>}

          {ride.status === 'picked_up' && ride.destination && (
            <button className="rm-btn rm-btn--maps" onClick={() => openMapsToLocation(ride.destination!)}>
              <span className="rm-btn--maps__main"><FontAwesomeIcon icon={faRoute} /> Zum Ziel navigieren</span>
              <span className="rm-btn--maps__sub">Öffnet {mapsApp}</span>
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
