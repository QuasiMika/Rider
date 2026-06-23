import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useDriverRequests } from '../hooks/useDriverRequests'
import { presenceService, dbService, realtimeService } from '../services'
import type { RickshawType } from '../services'
import type { Ride } from '../types/ride'
import { DriverWaiting } from './DriverWaiting'
import { DriverRideActive } from './DriverRideActive'
import { DriverRideCompleted } from './DriverRideCompleted'

export function DriverPanel() {
  const { user } = useAuth()
  const [driverRickshaw, setDriverRickshaw] = useState<RickshawType | null>(null)
  const [minPassengers, setMinPassengers] = useState(1)
  const [maxPassengers, setMaxPassengers] = useState(4)
  const { requests, currentRide, status, isAccepting, error, acceptRequest, resetToIdle } = useDriverRequests(
    user?.id ?? '',
    minPassengers,
    maxPassengers,
    driverRickshaw?.capacity ?? 0,
  )
  const [urlCompletedRide, setUrlCompletedRide] = useState<Ride | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [isWorking, setIsWorking] = useState<boolean | null>(null)

  const loadDriverRickshaw = async () => {
    if (!user?.id) return
    const [{ data: profile }, types] = await Promise.all([
      dbService.getUserProfile(user.id),
      dbService.getRickshawTypes(),
    ])
    const type = types.find(t => t.id === profile?.rickshaw_type_id) ?? null
    setDriverRickshaw(type)
    if (type) {
      setMinPassengers(current => Math.min(current, type.capacity))
      setMaxPassengers(current => current === 4 || current > type.capacity ? type.capacity : current)
    }
  }

  // Load currently_working on mount
  useEffect(() => {
    if (!user?.id) return
    dbService.getUserProfile(user.id).then(({ data }) => {
      setIsWorking(data?.currently_working ?? true)
    })
  }, [user?.id])

  useEffect(() => {
    loadDriverRickshaw()
    return realtimeService.subscribeRickshawTypes(loadDriverRickshaw)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Subscribe to admin status changes in real-time
  useEffect(() => {
    if (!user?.id) return
    return realtimeService.subscribeDriverWorking(user.id, setIsWorking)
  }, [user?.id])

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

  // Only track presence when admin has set driver as active
  useEffect(() => {
    if (!user?.id || status === 'matched' || isWorking !== true) return
    return presenceService.trackOnline('drivers-online', user.id)
  }, [user?.id, status, isWorking])

  const handleReset = () => {
    setUrlCompletedRide(null)
    setSearchParams({}, { replace: true })
    resetToIdle()
  }

  const completedRide = currentRide?.status === 'completed' ? currentRide : urlCompletedRide
  const activeRide = status === 'matched' && currentRide?.status !== 'completed' && currentRide?.status !== 'cancelled' ? currentRide : null

  if (completedRide) return <DriverRideCompleted ride={completedRide} onReset={handleReset} />
  if (activeRide) return <DriverRideActive ride={activeRide} currentUserId={user?.id ?? ''} />

  if (isWorking === false) {
    return (
      <div className="ride-panel ride-panel--waiting" style={{ marginTop: '2rem' }}>
        <p style={{ fontSize: '2rem' }}>⏸</p>
        <p style={{ color: 'var(--text-h)', fontWeight: 600 }}>Dein Konto ist deaktiviert</p>
        <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
          Ein Administrator muss dein Konto aktivieren, bevor du Fahrten annehmen kannst.
        </p>
      </div>
    )
  }

  return (
    <DriverWaiting
      requests={requests}
      isAccepting={isAccepting}
      error={error}
      onAccept={acceptRequest}
      minPassengers={minPassengers}
      maxPassengers={maxPassengers}
      capacity={driverRickshaw?.capacity ?? 4}
      onPassengerRangeChange={(min, max) => {
        setMinPassengers(min)
        setMaxPassengers(max)
      }}
    />
  )
}
