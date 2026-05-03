import { useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useDriverRequests } from '../hooks/useDriverRequests'
import { presenceService } from '../services'
import { DriverWaiting } from './DriverWaiting'
import { DriverRideActive } from './DriverRideActive'

export function DriverPanel() {
  const { user } = useAuth()
  const { requests, currentRide, status, isAccepting, error, acceptRequest } = useDriverRequests(
    user?.id ?? ''
  )

  useEffect(() => {
    if (!user?.id || status === 'matched') return
    return presenceService.trackOnline('drivers-online', user.id)
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
