import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import type { Ride, MatchResult } from '../types/ride'

type Status = 'idle' | 'waiting' | 'matched' | 'error'

type UseRideMatchingResult = {
  submitAvailability: () => Promise<void>
  requestRide: () => Promise<void>
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

  // On mount: restore state if user already has a pending request or an active ride
  useEffect(() => {
    if (!userId) return

    const checkExistingState = async () => {
      // Check for an active ride first
      const rideField = role === 'driver' ? 'driver_id' : 'guest_id'
      const { data: ride } = await supabase
        .from('rides')
        .select('*')
        .eq(rideField, userId)
        .in('status', ['pending', 'active'])
        .maybeSingle()

      if (ride) {
        setCurrentRide(ride as Ride)
        setStatus('matched')
        return
      }

      // Check for a waiting availability / request
      const table = role === 'driver' ? 'driver_availability' : 'guest_requests'
      const userField = role === 'driver' ? 'driver_id' : 'guest_id'
      const waitingStatus = role === 'driver' ? 'available' : 'waiting'

      const { data: existing } = await supabase
        .from(table)
        .select('id')
        .eq(userField, userId)
        .eq('status', waitingStatus)
        .maybeSingle()

      if (existing) {
        setStatus('waiting')
        setIsLoading(true)
      }
    }

    checkExistingState()
  }, [userId, role])

  // Realtime subscription: listen for a new ride being created for this user
  useEffect(() => {
    if (!userId) return

    // Two channels because Supabase Realtime doesn't support OR filters
    const driverChannel = supabase
      .channel(`rides-driver-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${userId}`,
        },
        (payload) => {
          setCurrentRide(payload.new as Ride)
          setStatus('matched')
          setIsLoading(false)
        }
      )
      .subscribe()

    const guestChannel = supabase
      .channel(`rides-guest-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: `guest_id=eq.${userId}`,
        },
        (payload) => {
          setCurrentRide(payload.new as Ride)
          setStatus('matched')
          setIsLoading(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(driverChannel)
      supabase.removeChannel(guestChannel)
    }
  }, [userId])

  const callMatchFunction = async (recordId: string) => {
    const { data: { session } } = await supabase.auth.getSession()

    const { data, error: fnError } = await supabase.functions.invoke<MatchResult>('match-ride', {
      body: { role, recordId },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (fnError) {
      console.error('[useRideMatching] Edge function error:', fnError)
      throw new Error(fnError.message)
    }

    if (data?.matched && data.ride_id) {
      console.log('[useRideMatching] Match found immediately, ride_id:', data.ride_id)
      // Realtime subscription will set currentRide; fetch as fallback
      const { data: ride } = await supabase
        .from('rides')
        .select('*')
        .eq('id', data.ride_id)
        .single()
      if (ride) {
        setCurrentRide(ride as Ride)
        setStatus('matched')
        setIsLoading(false)
      }
    }
  }

  const submitAvailability = async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    setStatus('waiting')

    try {
      // Reuse existing record if one already exists (prevents duplicates)
      const { data: existing } = await supabase
        .from('driver_availability')
        .select('id')
        .eq('driver_id', userId)
        .eq('status', 'available')
        .maybeSingle()

      let recordId: string

      if (existing) {
        recordId = existing.id
      } else {
        const { data, error: insertError } = await supabase
          .from('driver_availability')
          .insert({ driver_id: userId, status: 'available' })
          .select('id')
          .single()

        if (insertError) throw insertError
        recordId = data.id
      }

      await callMatchFunction(recordId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(message)
      setStatus('error')
      setIsLoading(false)
    }
  }

  const requestRide = async () => {
    if (!userId) return
    setIsLoading(true)
    setError(null)
    setStatus('waiting')

    try {
      // Reuse existing record if one already exists (prevents duplicates)
      const { data: existing } = await supabase
        .from('guest_requests')
        .select('id')
        .eq('guest_id', userId)
        .eq('status', 'waiting')
        .maybeSingle()

      let recordId: string

      if (existing) {
        recordId = existing.id
      } else {
        const { data, error: insertError } = await supabase
          .from('guest_requests')
          .insert({ guest_id: userId, status: 'waiting' })
          .select('id')
          .single()

        if (insertError) throw insertError
        recordId = data.id
      }

      await callMatchFunction(recordId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(message)
      setStatus('error')
      setIsLoading(false)
    }
  }

  return { submitAvailability, requestRide, currentRide, status, isLoading, error }
}
