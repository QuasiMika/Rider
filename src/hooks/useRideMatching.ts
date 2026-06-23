import { useState, useEffect, useCallback } from 'react'
import { dbService, realtimeService, functionsService } from '../services'
import type { GuestRequestRow } from '../services'
import type { Ride } from '../types/ride'
import { DRIVER_SEARCH_TIMEOUT_MS, DRIVER_SEARCH_TIMEOUT_MESSAGE } from '../constants/driverSearch'
import { withTimeout } from '../utils/withTimeout'

type Status = 'idle' | 'waiting' | 'matched' | 'completed' | 'error'

type UseRideMatchingResult = {
  submitAvailability: () => Promise<void>
  requestRide: (
    pickupLocation: string,
    destination: string,
    passengerCount: number,
    rickshawTypeId?: string | null,
  ) => Promise<void>
  cancelRequest: () => Promise<void>
  confirmPickup: () => Promise<void>
  resetToIdle: () => void
  currentRide: Ride | null
  pendingRequest: GuestRequestRow | null
  searchTimeoutMessage: string | null
  cancellationMessage: string | null
  status: Status
  isLoading: boolean
  error: string | null
}

export function useRideMatching(userId: string, role: 'driver' | 'guest'): UseRideMatchingResult {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [pendingRequest, setPendingRequest] = useState<GuestRequestRow | null>(null)
  const [searchTimeoutMessage, setSearchTimeoutMessage] = useState<string | null>(null)
  const [cancellationMessage, setCancellationMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPendingRequest = useCallback(async () => {
    if (!userId || role !== 'guest') return
    const request = await dbService.getWaitingGuestRequest(userId)
    setPendingRequest(request)
  }, [userId, role])

  const expireSearch = useCallback(async () => {
    if (!userId || role !== 'guest') return
    await dbService.expireWaitingGuestRequest(userId)
    setPendingRequest(null)
    setStatus('idle')
    setIsLoading(false)
    setSearchTimeoutMessage(DRIVER_SEARCH_TIMEOUT_MESSAGE)
  }, [userId, role])

  // Restore state on mount
  useEffect(() => {
    if (!userId) return

    const checkExistingState = async () => {
      const rideField = role === 'driver' ? 'driver_id' : 'guest_id'
      const ride = await dbService.getActiveRide(userId, rideField)
      if (ride) { setCurrentRide(ride); setStatus('matched'); return }

      if (role === 'guest') {
        const existing = await dbService.getWaitingGuestRequest(userId)
        if (existing) {
          const elapsed = Date.now() - new Date(existing.created_at).getTime()
          if (elapsed >= DRIVER_SEARCH_TIMEOUT_MS) {
            await expireSearch()
            return
          }
          setPendingRequest(existing)
          setStatus('waiting')
          setIsLoading(true)
        }
        return
      }

      const existing = await dbService.getDriverAvailability(userId)
      if (existing) {
        setStatus('waiting')
        setIsLoading(true)
      }
    }

    checkExistingState()
  }, [userId, role, expireSearch])

  // Auto-expire guest search after timeout
  useEffect(() => {
    if (status !== 'waiting' || role !== 'guest' || !pendingRequest?.created_at) return

    const startedAt = new Date(pendingRequest.created_at).getTime()
    const remaining = DRIVER_SEARCH_TIMEOUT_MS - (Date.now() - startedAt)

    if (remaining <= 0) {
      void expireSearch()
      return
    }

    const timer = window.setTimeout(() => { void expireSearch() }, remaining)
    return () => window.clearTimeout(timer)
  }, [status, role, pendingRequest?.id, pendingRequest?.created_at, expireSearch])

  // Polling fallback while waiting — catches missed realtime INSERT events
  useEffect(() => {
    if (status !== 'waiting' || !userId) return
    const interval = setInterval(async () => {
      const ride = await dbService.getActiveRide(userId, 'guest_id')
      if (ride) { setCurrentRide(ride); setStatus('matched'); setIsLoading(false); setPendingRequest(null) }
    }, 5000)
    return () => clearInterval(interval)
  }, [status, userId])

  // Realtime: rides for this user (both driver and guest channels)
  useEffect(() => {
    if (!userId) return

    const unsubDriver = realtimeService.subscribeRideByDriverId(
      `rides-driver-${userId}`,
      userId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsLoading(false); setPendingRequest(null) },
      () => {},
    )

    const unsubGuest = realtimeService.subscribeRideByGuestId(
      `rides-guest-${userId}`,
      userId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsLoading(false); setPendingRequest(null) },
      (ride) => {
        if (ride.status === 'cancelled') {
          setCurrentRide(null)
          setPendingRequest(null)
          setStatus('idle')
          setIsLoading(false)
          if (role === 'guest') setCancellationMessage('Fahrt wurde storniert, da du nicht am Abholort warst.')
          return
        }
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
      if (ride) { setCurrentRide(ride); setStatus('matched'); setIsLoading(false); setPendingRequest(null) }
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

  const requestRide = async (
    pickupLocation: string,
    destination: string,
    passengerCount: number,
    rickshawTypeId?: string | null,
  ) => {
    if (!userId) return
    setIsLoading(true); setError(null); setSearchTimeoutMessage(null); setStatus('waiting')
    setCancellationMessage(null)

    try {
      const existing = await dbService.getWaitingGuestRequest(userId)
      if (!existing) {
        await withTimeout(
          functionsService.invokeCreateRequest(pickupLocation, destination, passengerCount, rickshawTypeId),
        )
      }
      await loadPendingRequest()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStatus('error'); setIsLoading(false); setPendingRequest(null)
    }
  }

  const cancelRequest = async () => {
    if (!userId) return
    const { error: deleteError } = await dbService.deleteWaitingGuestRequest(userId)
    if (deleteError) { setError(deleteError.message); return }
    setStatus('idle'); setIsLoading(false); setError(null); setPendingRequest(null)
  }

  const confirmPickup = async () => {
    if (!currentRide?.id) return
    await dbService.confirmPickup(currentRide.id)
    setCurrentRide(prev => prev ? { ...prev, status: 'picked_up' } : null)
  }

  const resetToIdle = () => {
    setStatus('idle')
    setCurrentRide(null)
    setPendingRequest(null)
    setSearchTimeoutMessage(null)
    setCancellationMessage(null)
    setIsLoading(false)
    setError(null)
  }

  return {
    submitAvailability,
    requestRide,
    cancelRequest,
    confirmPickup,
    resetToIdle,
    currentRide,
    pendingRequest,
    searchTimeoutMessage,
    cancellationMessage,
    status,
    isLoading,
    error,
  }
}
