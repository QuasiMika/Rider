import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useDriverRequests } from '../hooks/useDriverRequests'
import { presenceService, dbService } from '../services'
import type { Ride } from '../types/ride'
import { DriverWaiting } from './DriverWaiting'
import { DriverRideActive } from './DriverRideActive'
import { DriverRideCompleted } from './DriverRideCompleted'

export function DriverPanel() {
  const { user } = useAuth()
  const { requests, currentRide, status, isAccepting, error, acceptRequest, resetToIdle } = useDriverRequests(
    user?.id ?? ''
  )
  const [urlCompletedRide, setUrlCompletedRide] = useState<Ride | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Restore completed ride from URL param on mount
  useEffect(() => {
    const completedId = searchParams.get('completed')
    if (!completedId) return
    dbService.getRideById(completedId).then(ride => {
      if (ride?.status === 'completed') setUrlCompletedRide(ride)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write URL param when ride transitions to completed
  useEffect(() => {
    if (currentRide?.status === 'completed') {
      setSearchParams({ completed: currentRide.id }, { replace: true })
    }
  }, [currentRide?.status, currentRide?.id, setSearchParams])

  useEffect(() => {
    if (!user?.id || status === 'matched') return
    return presenceService.trackOnline('drivers-online', user.id)
  }, [user?.id, status])

  const handleReset = () => {
    setUrlCompletedRide(null)
    setSearchParams({}, { replace: true })
    resetToIdle()
  }

  const completedRide = currentRide?.status === 'completed' ? currentRide : urlCompletedRide
  const activeRide = status === 'matched' && currentRide?.status !== 'completed' ? currentRide : null

  if (completedRide) return <DriverRideCompleted ride={completedRide} onReset={handleReset} />
  if (activeRide) return <DriverRideActive ride={activeRide} />
  return (
    <DriverWaiting
      requests={requests}
      isAccepting={isAccepting}
      error={error}
      onAccept={acceptRequest}
    />
  )
}
