import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { useGuestRequests } from '../hooks/useGuestRequests'
import './DriverPage.css'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`driver-page__badge driver-page__badge--${status}`}>
      {status === 'waiting' ? 'Wartend' : status === 'matched' ? 'Zugewiesen' : status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function DriverPage() {
  const { user } = useAuth()
  const { submitAvailability, currentRide, status, isLoading, error } = useRideMatching(
    user?.id ?? ''
  )
  const { requests, isLoading: requestsLoading, error: requestsError, refresh } = useGuestRequests()

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const activeCount = requests.filter((r) => r.status === 'active').length
  const completedCount = requests.filter((r) => r.status === 'completed').length

  return (
    <div className="driver-page">
      {/* Header */}
      <div className="driver-page__header">
        <h1 className="driver-page__title">Fahrer-Dashboard</h1>
        <p className="driver-page__subtitle">
          Aktuelle Fahrtanfragen im Überblick
        </p>
      </div>

      {/* Stats row */}
      <div className="driver-page__stats">
        <div className="driver-page__stat">
          <span className="driver-page__stat-value">{requests.length}</span>
          <span className="driver-page__stat-label">Gesamt</span>
        </div>
        <div className="driver-page__stat">
          <span className="driver-page__stat-value">{pendingCount}</span>
          <span className="driver-page__stat-label">Ausstehend</span>
        </div>
        <div className="driver-page__stat">
          <span className="driver-page__stat-value">{activeCount}</span>
          <span className="driver-page__stat-label">Aktiv</span>
        </div>
        <div className="driver-page__stat">
          <span className="driver-page__stat-value">{completedCount}</span>
          <span className="driver-page__stat-label">Abgeschlossen</span>
        </div>
      </div>

      {/* Availability panel */}
      <div className="driver-page__availability">
        {status === 'matched' && currentRide ? (
          <div className="driver-page__match-info">
            <h2>Fahrt zugewiesen!</h2>
            <div className="driver-page__match-row">
              <span>Fahrt-ID</span>
              <code>{currentRide.id}</code>
            </div>
            <div className="driver-page__match-row">
              <span>Gast-ID</span>
              <code>{currentRide.guest_id}</code>
            </div>
            <div className="driver-page__match-row">
              <span>Status</span>
              <StatusBadge status={currentRide.status} />
            </div>
          </div>
        ) : status === 'waiting' ? (
          <div className="driver-page__waiting">
            <div className="driver-page__spinner" aria-label="Suche läuft" />
            <p>Warte auf Gast-Zuweisung…</p>
          </div>
        ) : (
          <div className="driver-page__idle">
            {error && <p className="driver-page__error">{error}</p>}
            <button
              className="driver-page__cta"
              onClick={submitAvailability}
              disabled={isLoading}
            >
              {isLoading ? 'Wird gemeldet…' : 'Als Fahrer verfügbar melden'}
            </button>
          </div>
        )}
      </div>

      {/* Requests table */}
      <div className="driver-page__table-section">
        <div className="driver-page__table-header">
          <h2 className="driver-page__table-title">Fahrten (Rides)</h2>
          <button
            className="driver-page__refresh"
            onClick={refresh}
            disabled={requestsLoading}
            title="Aktualisieren"
          >
            {requestsLoading ? '…' : '↻'}
          </button>
        </div>

        {requestsError && (
          <p className="driver-page__error">
            Fehler beim Laden: {requestsError}
          </p>
        )}

        {!requestsLoading && requests.length === 0 ? (
          <p className="driver-page__empty">Keine Fahrtanfragen vorhanden.</p>
        ) : (
          <div className="driver-page__table-wrapper">
            <table className="driver-page__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ride-ID</th>
                  <th>Fahrer-ID</th>
                  <th>Gast-ID</th>
                  <th>Status</th>
                  <th>Erstellt am</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((ride, idx) => (
                  <tr key={ride.id} className={ride.status === 'completed' ? 'driver-page__row--matched' : ''}>
                    <td className="driver-page__cell--center">{idx + 1}</td>
                    <td>
                      <code className="driver-page__code">{ride.id.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <code className="driver-page__code">{ride.driver_id.slice(0, 8)}…</code>
                    </td>
                    <td>
                      <code className="driver-page__code">{ride.guest_id.slice(0, 8)}…</code>
                    </td>
                    <td><StatusBadge status={ride.status} /></td>
                    <td>{formatDate(ride.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
