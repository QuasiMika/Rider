import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { supabase } from '../utils/supabase'
import './GuestPanel.css'

type PartnerProfile = { first_name: string | null; family_name: string | null }

export function GuestPanel() {
  const { user } = useAuth()
  const { requestRide, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? '',
    'guest'
  )
  const [driver, setDriver] = useState<PartnerProfile | null>(null)

  useEffect(() => {
    if (!currentRide?.driver_id) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', currentRide.driver_id)
      .single()
      .then(({ data }) => { if (data) setDriver(data) })
  }, [currentRide?.driver_id])

  const driverName = driver
    ? `${driver.first_name ?? ''} ${driver.family_name ?? ''}`.trim() || 'Fahrer'
    : 'Fahrer'

  const initials = driver
    ? `${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  // Driver is on the way
  if (status === 'matched' && currentRide?.status === 'pending') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrer ist unterwegs!</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Fahrer</div>
            <div className="rm-partner__name">{driverName}</div>
          </div>
        </div>
        <div className="guest-arriving" aria-label="Fahrer kommt">
          <span className="guest-arriving__vehicle">🛺</span>
          <div className="guest-arriving__road" />
          <span className="guest-arriving__dest">📍</span>
        </div>
        <p>{driverName} ist auf dem Weg zu dir.</p>
      </div>
    )
  }

  // Ride is active
  if (status === 'matched' && currentRide?.status === 'active') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt läuft 🚴</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Fahrer</div>
            <div className="rm-partner__name">{driverName}</div>
          </div>
        </div>
        <div className="guest-active">
          <div className="guest-active__dot" />
          <span>Genieße die Fahrt!</span>
        </div>
      </div>
    )
  }

  // Ride completed
  if (status === 'matched' && currentRide?.status === 'completed') {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt beendet ✓</h2>
        <p>Danke, dass du Rider genutzt hast!</p>
      </div>
    )
  }

  // Searching for driver
  if (status === 'waiting') {
    return (
      <div className="rm-card">
        <h2>Suche Fahrer...</h2>
        <div className="guest-radar" aria-label="Suche läuft">
          <div className="guest-radar__ring" />
          <div className="guest-radar__ring" />
          <div className="guest-radar__ring" />
          <div className="guest-radar__dot" />
        </div>
        <p>Wir suchen einen verfügbaren Fahrer für dich.</p>
      </div>
    )
  }

  return (
    <div className="rm-card">
      <h2>Wohin soll's gehen?</h2>
      <p>Fordere eine Fahrt an und wir verbinden dich mit dem nächsten freien Fahrer.</p>
      {error && <p className="ride-error">{error}</p>}
      <button className="rm-btn" onClick={requestRide} disabled={isLoading}>
        {isLoading ? 'Wird angefordert...' : 'Fahrer anfordern'}
      </button>
    </div>
  )
}
