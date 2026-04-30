import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
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

async function fetchProfile(guestId: string): Promise<{ guestName: string; guestInitials: string }> {
  const { data } = await supabase
    .from('user_profile')
    .select('first_name, family_name')
    .eq('user_id', guestId)
    .single()

  const fullName = data ? `${data.first_name ?? ''} ${data.family_name ?? ''}`.trim() : ''
  const initials = data
    ? `${data.first_name?.[0] ?? ''}${data.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  return { guestName: fullName || 'Gast', guestInitials: initials }
}

export function useDriverRequests(driverId: string): UseDriverRequestsResult {
  const [requests, setRequests] = useState<RequestWithProfile[]>([])
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [status, setStatus] = useState<DriverStatus>('browsing')
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount: restore active ride if driver already has one
  useEffect(() => {
    if (!driverId) return
    supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['pending', 'picked_up', 'active'])
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCurrentRide(data as Ride)
          setStatus('matched')
        }
      })
  }, [driverId])

  // Initial fetch of waiting requests + their guest profiles
  useEffect(() => {
    if (!driverId) return

    const load = async () => {
      const { data: rows } = await supabase
        .from('guest_requests')
        .select('id, guest_id, created_at, pickup_location, destination')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })

      if (!rows || rows.length === 0) { setRequests([]); return }

      const guestIds = rows.map(r => r.guest_id)
      const { data: profiles } = await supabase
        .from('user_profile')
        .select('user_id, first_name, family_name')
        .in('user_id', guestIds)

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? [])

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

  // Realtime: watch guest_requests for new/removed entries
  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel(`guest-requests-driver-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guest_requests' },
        async (payload) => {
          const row = payload.new as { id: string; guest_id: string; created_at: string; pickup_location: string | null; destination: string | null }
          const profile = await fetchProfile(row.guest_id)
          setRequests(prev => [...prev, {
            id: row.id,
            guest_id: row.guest_id,
            created_at: row.created_at,
            pickupLocation: row.pickup_location ?? '',
            destination: row.destination ?? '',
            ...profile,
          }])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'guest_requests' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setRequests(prev => prev.filter(r => r.id !== deletedId))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId])

  // Realtime: watch for a ride being assigned to this driver
  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel(`rides-driver-accept-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          setCurrentRide(payload.new as Ride)
          setStatus('matched')
          setIsAccepting(false)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          setCurrentRide(payload.new as Ride)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId])

  const acceptRequest = useCallback(async (requestId: string) => {
    if (!driverId) return
    setIsAccepting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { data, error: fnError } = await supabase.functions.invoke<AcceptResult>('accept-ride', {
        body: { requestId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (fnError) throw new Error(fnError.message)

      if (data?.accepted && data.ride_id) {
        // Realtime will update state; fetch as fallback
        const { data: ride } = await supabase.from('rides').select('*').eq('id', data.ride_id).single()
        if (ride) {
          setCurrentRide(ride as Ride)
          setStatus('matched')
        }
      } else if (data && !data.accepted) {
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
