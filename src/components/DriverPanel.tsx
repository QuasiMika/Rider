import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'

export function DriverPanel() {
  const { user } = useAuth()
  const { submitAvailability, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? ''
  )

  if (status === 'matched' && currentRide) {
    return (
      <div className="ride-panel ride-panel--matched">
        <h2>Fahrt gefunden!</h2>
        <div className="ride-info">
          <div className="ride-info__row">
            <span className="ride-info__label">Fahrt-ID</span>
            <code className="ride-info__value">{currentRide.id}</code>
          </div>
          <div className="ride-info__row">
            <span className="ride-info__label">Gast-ID</span>
            <code className="ride-info__value">{currentRide.guest_id}</code>
          </div>
          <div className="ride-info__row">
            <span className="ride-info__label">Status</span>
            <span className="ride-info__value">{currentRide.status}</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'waiting') {
    return (
      <div className="ride-panel ride-panel--waiting">
        <h2>Warte auf Gast...</h2>
        <div className="ride-spinner" aria-label="Lädt" />
        <p>Du wirst benachrichtigt, sobald ein Gast gefunden wird.</p>
      </div>
    )
  }

  return (
    <div className="ride-panel">
      <h2>Fahrer-Dashboard</h2>
      {error && <p className="ride-error">{error}</p>}
      <button
        className="auth-button"
        onClick={submitAvailability}
        disabled={isLoading}
      >
        {isLoading ? 'Wird gemeldet...' : 'Als Fahrer verfügbar melden'}
      </button>
    </div>
  )
}
