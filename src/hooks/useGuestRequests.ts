import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import type { Ride } from '../types/ride'

type UseGuestRequestsResult = {
  requests: Ride[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useGuestRequests(): UseGuestRequestsResult {
  const [requests, setRequests] = useState<Ride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = () => setTick((t) => t + 1)

  useEffect(() => {
    let cancelled = false

    const fetchRequests = async () => {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRequests((data ?? []) as Ride[])
      }
      setIsLoading(false)
    }

    fetchRequests()

    // Real-time subscription: keep table in sync
    const channel = supabase
      .channel('rides-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests((prev) => [...prev, payload.new as Ride])
          } else if (payload.eventType === 'UPDATE') {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === (payload.new as Ride).id
                  ? (payload.new as Ride)
                  : r
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setRequests((prev) =>
              prev.filter((r) => r.id !== (payload.old as Ride).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [tick])

  return { requests, isLoading, error, refresh }
}
