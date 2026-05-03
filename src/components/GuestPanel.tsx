import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { presenceService } from '../services'
import { GuestBooking } from './GuestBooking'
import { GuestSearching } from './GuestSearching'
import { GuestRideActive } from './GuestRideActive'
import './GuestPanel.css'

export function GuestPanel() {
  const { user } = useAuth()
  const { requestRide, cancelRequest, confirmPickup, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? '',
    'guest'
  )
  const [onlineDrivers, setOnlineDrivers] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const paymentSuccess = searchParams.get('payment') === 'success'

  useEffect(() => {
    if (!paymentSuccess) return
    const t = setTimeout(() => { setSearchParams({}, { replace: true }) }, 4000)
    return () => clearTimeout(t)
  }, [paymentSuccess, setSearchParams])

  useEffect(() => {
    if (status !== 'idle') return
    return presenceService.subscribeOnlineCount('drivers-online', setOnlineDrivers)
  }, [status])

  return (
    <>
      {paymentSuccess && (
        <div className="payment-success-banner">
          ✓ Zahlung erfolgreich — Danke für deine Fahrt mit Rider!
        </div>
      )}

      {status === 'matched' && currentRide
        ? <GuestRideActive ride={currentRide} userId={user?.id ?? ''} onConfirmPickup={confirmPickup} />
        : status === 'waiting'
        ? <GuestSearching onCancel={cancelRequest} />
        : <GuestBooking onlineDrivers={onlineDrivers} isLoading={isLoading} error={error} onRequest={requestRide} />
      }
    </>
  )
}
