import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { supabase } from '../utils/supabase'

type PartnerProfile = { first_name: string | null; family_name: string | null }

export function DriverPanel() {
  const { user } = useAuth()
  const { submitAvailability, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? '',
    'driver'
  )
  const [guest, setGuest] = useState<PartnerProfile | null>(null)

  useEffect(() => {
    if (!currentRide?.guest_id) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', currentRide.guest_id)
      .single()
      .then(({ data }) => { if (data) setGuest(data) })
  }, [currentRide?.guest_id])

  const guestName = guest
    ? `${guest.first_name ?? ''} ${guest.family_name ?? ''}`.trim() || 'Gast'
    : 'Gast'

  const initials = guest
    ? `${guest.first_name?.[0] ?? ''}${guest.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  if (status === 'matched' && currentRide) {
    return (
      <div className="rm-card rm-card--matched">
        <h2>Fahrt gefunden! 🎉</h2>
        <div className="rm-partner">
          <div className="rm-partner__avatar">{initials}</div>
          <div>
            <div className="rm-partner__label">Dein Gast</div>
            <div className="rm-partner__name">{guestName}</div>
          </div>
        </div>
        <p>
          Status:{' '}
          <strong style={{ color: 'var(--accent)' }}>
            {currentRide.status === 'pending' ? 'Unterwegs zum Gast' : currentRide.status}
          </strong>
        </p>
      </div>
    )
  }

  if (status === 'waiting') {
    return (
      <div className="rm-card">
        <h2>Warte auf Gast...</h2>
        <div className="ride-spinner" aria-label="Lädt" />
        <p>Du wirst benachrichtigt, sobald ein Gast gefunden wird.</p>
      </div>
    )
  }

  return (
    <div className="rm-card">
      <h2>Bereit loszufahren?</h2>
      <p>Melde dich als verfügbar und wir verbinden dich mit dem nächsten Gast.</p>
      {error && <p className="ride-error">{error}</p>}
      <button className="rm-btn" onClick={submitAvailability} disabled={isLoading}>
        {isLoading ? 'Wird gemeldet...' : 'Als Fahrer verfügbar melden'}
      </button>
    </div>
  )
}
