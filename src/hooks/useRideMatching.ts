import { useState, useEffect } from 'react'
import { dbService, realtimeService, functionsService } from '../services'
import type { Ride } from '../types/ride'

type Status = 'idle' | 'waiting' | 'matched' | 'completed' | 'error'

type UseRideMatchingResult = {
  submitAvailability: () => Promise<void>
  requestRide: (pickupLocation: string, destination: string) => Promise<void>
  cancelRequest: () => Promise<void>
  confirmPickup: () => Promise<void>
  resetToIdle: () => void
  currentRide: Ride | null
  status: Status
  isLoading: boolean
  error: string | null
}

export function useRideMatching(userId: string, role: 'driver' | 'guest'): UseRideMatchingResult {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore state on mount
  useEffect(() => {
    if (!userId) return

    const checkExistingState = async () => {
      const rideField = role === 'driver' ? 'driver_id' : 'guest_id'
      const ride = await dbService.getActiveRide(userId, rideField)
      if (ride) { setCurrentRide(ride); setStatus('matched'); return }

      const table = role === 'driver' ? 'driver_availability' : 'guest_requests'
      const existing =
        table === 'driver_availability'
          ? await dbService.getDriverAvailability(userId)
          : await dbService.getWaitingGuestRequest(userId)

      if (existing) { setStatus('waiting'); setIsLoading(true) }
    }

    checkExistingState()
  }, [userId, role])

  // Polling fallback while waiting — catches missed realtime INSERT events
  useEffect(() => {
    if (status !== 'waiting' || !userId) return
    const interval = setInterval(async () => {
      const ride = await dbService.getActiveRide(userId, 'guest_id')
      if (ride) { setCurrentRide(ride); setStatus('matched'); setIsLoading(false) }
    }, 5000)
    return () => clearInterval(interval)
  }, [status, userId])

  // Realtime: rides for this user (both driver and guest channels)
  useEffect(() => {
    if (!userId) return

    const unsubDriver = realtimeService.subscribeRideByDriverId(
      `rides-driver-${userId}`,
      userId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsLoading(false) },
      () => {},
    )

    const unsubGuest = realtimeService.subscribeRideByGuestId(
      `rides-guest-${userId}`,
      userId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsLoading(false) },
      (ride) => {
        setCurrentRide(ride)
        if (ride.status === 'completed') setStatus('completed')
      },
    )

    return () => { unsubDriver(); unsubGuest() }
  }, [userId])

  const callMatchFunction = async (recordId: string) => {
    const result = await functionsService.invokeMatchRide(role, recordId)
    if (result.matched && result.ride_id) {
      console.log('[useRideMatching] Match found immediately, ride_id:', result.ride_id)
      const ride = await dbService.getRideById(result.ride_id)
      if (ride) { setCurrentRide(ride); setStatus('matched'); setIsLoading(false) }
    }
  }

  const submitAvailability = async () => {
    if (!userId) return
    setIsLoading(true); setError(null); setStatus('waiting')

    try {
      const existing = await dbService.getDriverAvailability(userId)
      let recordId: string

      if (existing) {
        recordId = existing.id
      } else {
        const { data, error: insertError } = await dbService.insertDriverAvailability(userId)
        if (insertError) throw new Error(insertError.message)
        recordId = data!.id
      }

      await callMatchFunction(recordId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStatus('error'); setIsLoading(false)
    }
  }

  const requestRide = async (pickupLocation: string, destination: string) => {
    if (!userId) return
    setIsLoading(true); setError(null); setStatus('waiting')

    try {
      const existing = await dbService.getWaitingGuestRequest(userId)
      if (!existing) {
        await functionsService.invokeCreateRequest(pickupLocation, destination)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStatus('error'); setIsLoading(false)
    }
  }

  const cancelRequest = async () => {
    if (!userId) return
    const { error: deleteError } = await dbService.deleteWaitingGuestRequest(userId)
    if (!deleteError) { setStatus('idle'); setIsLoading(false); setError(null) }
  }

  const confirmPickup = async () => {
    if (!currentRide?.id) return
    await dbService.confirmPickup(currentRide.id)
    setCurrentRide(prev => prev ? { ...prev, status: 'picked_up' } : null)
  }

  const resetToIdle = () => {
    setStatus('idle')
    setCurrentRide(null)
    setIsLoading(false)
    setError(null)
  }

  return { submitAvailability, requestRide, cancelRequest, confirmPickup, resetToIdle, currentRide, status, isLoading, error }
}
