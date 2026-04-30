import { useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useDriverRequests } from '../hooks/useDriverRequests'
import { supabase } from '../utils/supabase'
import { DriverWaiting } from './DriverWaiting'
import { DriverRideActive } from './DriverRideActive'

export function DriverPanel() {
  const { user } = useAuth()
  const { requests, currentRide, status, isAccepting, error, acceptRequest } = useDriverRequests(
    user?.id ?? ''
  )

  useEffect(() => {
    if (!user?.id || status === 'matched') return
    const channel = supabase.channel('drivers-online', {
      config: { presence: { key: user.id } },
    })
    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await channel.track({ online: true })
    })
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, status])

  if (status === 'matched' && currentRide) {
    return <DriverRideActive ride={currentRide} />
  }
  return (
    <DriverWaiting
      requests={requests}
      isAccepting={isAccepting}
      error={error}
      onAccept={acceptRequest}
    />
  )
}
