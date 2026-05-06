import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { presenceService, dbService } from '../services'
import type { Ride } from '../types/ride'
import { GuestBooking } from './GuestBooking'
import { GuestSearching } from './GuestSearching'
import { GuestRideActive } from './GuestRideActive'
import { GuestRideCompleted } from './GuestRideCompleted'
import './GuestPanel.css'

export function GuestPanel() {
  const { user } = useAuth()
  const { requestRide, cancelRequest, confirmPickup, resetToIdle, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? '',
    'guest'
  )
  const [onlineDrivers, setOnlineDrivers] = useState<number | null>(null)
  const [urlCompletedRide, setUrlCompletedRide] = useState<Ride | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const paymentSuccess = searchParams.get('payment') === 'success'

  // Restore completed ride from URL param on mount
  useEffect(() => {
    const completedId = searchParams.get('completed')
    if (!completedId || !user?.id) return
    dbService.getRideById(completedId).then(ride => {
      if (ride?.status === 'completed') setUrlCompletedRide(ride)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write URL param when hook transitions to completed
  useEffect(() => {
    if (status === 'completed' && currentRide) {
      setSearchParams({ completed: currentRide.id }, { replace: true })
    }
  }, [status, currentRide, setSearchParams])

  useEffect(() => {
    if (!paymentSuccess) return
    const t = setTimeout(() => { setSearchParams({}, { replace: true }) }, 4000)
    return () => clearTimeout(t)
  }, [paymentSuccess, setSearchParams])

  useEffect(() => {
    if (status !== 'idle') return
    return presenceService.subscribeOnlineCount('drivers-online', setOnlineDrivers)
  }, [status])

  const handleNewRide = () => {
    setUrlCompletedRide(null)
    setSearchParams({}, { replace: true })
    resetToIdle()
  }

  const completedRide = status === 'completed' ? currentRide : urlCompletedRide

  return (
    <>
      {paymentSuccess && (
        <div className="payment-success-banner">
          ✓ Zahlung erfolgreich — Danke für deine Fahrt mit Rider!
        </div>
      )}

      {completedRide
        ? <GuestRideCompleted ride={completedRide} userId={user?.id ?? ''} onNewRide={handleNewRide} />
        : status === 'matched' && currentRide
        ? <GuestRideActive ride={currentRide} />
        : status === 'waiting'
        ? <GuestSearching onCancel={cancelRequest} />
        : <GuestBooking onlineDrivers={onlineDrivers} isLoading={isLoading} error={error} onRequest={requestRide} />
      }
    </>
  )
}
