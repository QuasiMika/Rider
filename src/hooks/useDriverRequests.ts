import { useState, useEffect, useCallback } from 'react'
import { dbService, realtimeService, functionsService } from '../services'
import type { GuestRequestRow } from '../services'
import type { Ride, AcceptResult } from '../types/ride'

export type RequestWithProfile = {
  id: string
  guest_id: string
  created_at: string
  pickupLocation: string
  destination: string
  guestName: string
  guestInitials: string
}

type DriverStatus = 'browsing' | 'matched' | 'error'

type UseDriverRequestsResult = {
  requests: RequestWithProfile[]
  currentRide: Ride | null
  status: DriverStatus
  isAccepting: boolean
  error: string | null
  acceptRequest: (requestId: string) => Promise<void>
}

async function enrichRow(row: GuestRequestRow): Promise<RequestWithProfile> {
  const profiles = await dbService.getUserProfiles([row.guest_id])
  const p = profiles[0]
  const fullName = p ? `${p.first_name ?? ''} ${p.family_name ?? ''}`.trim() : ''
  const initials = p
    ? `${p.first_name?.[0] ?? ''}${p.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  return {
    id: row.id,
    guest_id: row.guest_id,
    created_at: row.created_at,
    pickupLocation: row.pickup_location ?? '',
    destination: row.destination ?? '',
    guestName: fullName || 'Gast',
    guestInitials: initials,
  }
}

export function useDriverRequests(driverId: string): UseDriverRequestsResult {
  const [requests, setRequests] = useState<RequestWithProfile[]>([])
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [status, setStatus] = useState<DriverStatus>('browsing')
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore active ride on mount
  useEffect(() => {
    if (!driverId) return
    dbService.getActiveRide(driverId, 'driver_id').then((ride) => {
      if (ride) { setCurrentRide(ride); setStatus('matched') }
    })
  }, [driverId])

  // Initial fetch of waiting requests + profiles
  useEffect(() => {
    if (!driverId) return
    const load = async () => {
      const rows = await dbService.getWaitingGuestRequests()
      if (rows.length === 0) { setRequests([]); return }

      const guestIds = rows.map(r => r.guest_id)
      const profiles = await dbService.getUserProfiles(guestIds)
      const profileMap = new Map(profiles.map(p => [p.user_id, p]))

      setRequests(rows.map(r => {
        const p = profileMap.get(r.guest_id)
        const fullName = p ? `${p.first_name ?? ''} ${p.family_name ?? ''}`.trim() : ''
        const initials = p
          ? `${p.first_name?.[0] ?? ''}${p.family_name?.[0] ?? ''}`.toUpperCase() || '?'
          : '?'
        return {
          id: r.id,
          guest_id: r.guest_id,
          created_at: r.created_at,
          pickupLocation: r.pickup_location ?? '',
          destination: r.destination ?? '',
          guestName: fullName || 'Gast',
          guestInitials: initials,
        }
      }))
    }
    load()
  }, [driverId])

  // Realtime: guest_requests INSERT / DELETE
  useEffect(() => {
    if (!driverId) return
    return realtimeService.subscribeGuestRequests(
      `guest-requests-driver-${driverId}`,
      async (row) => {
        const enriched = await enrichRow(row)
        setRequests(prev => [...prev, enriched])
      },
      (deletedId) => setRequests(prev => prev.filter(r => r.id !== deletedId)),
    )
  }, [driverId])

  // Realtime: rides INSERT/UPDATE for this driver
  useEffect(() => {
    if (!driverId) return
    return realtimeService.subscribeRideByDriverId(
      `rides-driver-accept-${driverId}`,
      driverId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsAccepting(false) },
      (ride) => setCurrentRide(ride),
    )
  }, [driverId])

  const acceptRequest = useCallback(async (requestId: string) => {
    if (!driverId) return
    setIsAccepting(true)
    setError(null)

    try {
      const result: AcceptResult = await functionsService.invokeAcceptRide(requestId)

      if (result.accepted && result.ride_id) {
        const ride = await dbService.getRideById(result.ride_id)
        if (ride) { setCurrentRide(ride); setStatus('matched') }
      } else if (!result.accepted) {
        setError('Diese Anfrage wurde bereits von einem anderen Fahrer angenommen.')
        setRequests(prev => prev.filter(r => r.id !== requestId))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsAccepting(false)
    }
  }, [driverId])

  return { requests, currentRide, status, isAccepting, error, acceptRequest }
}
