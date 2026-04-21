import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'

export function GuestPanel() {
  const { user } = useAuth()
  const { requestRide, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? ''
  )

  if (status === 'matched' && currentRide) {
    return (
      <div className="ride-panel ride-panel--matched">
        <h2>Fahrer gefunden!</h2>
        <div className="ride-info">
          <div className="ride-info__row">
            <span className="ride-info__label">Fahrt-ID</span>
            <code className="ride-info__value">{currentRide.id}</code>
          </div>
          <div className="ride-info__row">
            <span className="ride-info__label">Fahrer-ID</span>
            <code className="ride-info__value">{currentRide.driver_id}</code>
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
        <h2>Suche Fahrer...</h2>
        <div className="ride-spinner" aria-label="Lädt" />
        <p>Wir suchen einen verfügbaren Fahrer für dich.</p>
      </div>
    )
  }

  return (
    <div className="ride-panel">
      <h2>Gast-Dashboard</h2>
      {error && <p className="ride-error">{error}</p>}
      <button
        className="auth-button"
        onClick={requestRide}
        disabled={isLoading}
      >
        {isLoading ? 'Wird angefordert...' : 'Fahrer anfordern'}
      </button>
    </div>
  )
}
