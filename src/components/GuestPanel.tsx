import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { supabase } from '../utils/supabase'
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

  useEffect(() => {
    if (status !== 'idle') return
    const channel = supabase.channel('drivers-online')
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineDrivers(Object.keys(channel.presenceState()).length)
      })
      .subscribe()
    return () => {
      setOnlineDrivers(null)
      supabase.removeChannel(channel)
    }
  }, [status])

  if (status === 'matched' && currentRide) {
    return <GuestRideActive ride={currentRide} userId={user?.id ?? ''} onConfirmPickup={confirmPickup} />
  }
  if (status === 'waiting') {
    return <GuestSearching onCancel={cancelRequest} />
  }
  return (
    <GuestBooking
      onlineDrivers={onlineDrivers}
      isLoading={isLoading}
      error={error}
      onRequest={requestRide}
    />
  )
}
