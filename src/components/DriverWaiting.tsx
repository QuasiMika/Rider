import { useResolvedNames } from '../hooks/useResolvedNames'
import type { RequestWithProfile } from '../hooks/useDriverRequests'

type RequestItemProps = {
  req: RequestWithProfile
  isAccepting: boolean
  onAccept: (id: string) => void
}

function RequestItem({ req, isAccepting, onAccept }: RequestItemProps) {
  const { pickupName, destName } = useResolvedNames(undefined, req.pickupLocation, req.destination)

  return (
    <div className="rm-request-item">
      <div className="rm-partner__avatar rm-partner__avatar--sm">{req.guestInitials}</div>
      <div className="rm-request-item__info">
        <div className="rm-partner__label">Fahrtanfrage</div>
        <div className="rm-partner__name">{req.guestName}</div>
        {(req.pickupLocation || req.destination) && (
          <div className="rm-request-item__route">
            {req.pickupLocation && (
              <span className="rm-route-stop rm-route-stop--from">
                <span className="rm-route-stop__dot" />
                {pickupName}
              </span>
            )}
            {req.destination && (
              <span className="rm-route-stop rm-route-stop--to">
                <span className="rm-route-stop__dot" />
                {destName}
              </span>
            )}
          </div>
        )}
        {req.price_eur != null && (
          <div className="rm-request-item__price">
            {req.price_eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
      </div>
      <button
        className="rm-btn rm-btn--accept"
        onClick={() => onAccept(req.id)}
        disabled={isAccepting}
      >
        {isAccepting ? '...' : 'Annehmen'}
      </button>
    </div>
  )
}

type Props = {
  requests: RequestWithProfile[]
  isAccepting: boolean
  error: string | null
  onAccept: (id: string) => void
}

export function DriverWaiting({ requests, isAccepting, error, onAccept }: Props) {
  return (
    <div className="driver-idle">
      {error && <p className="ride-error">{error}</p>}

      {requests.length === 0 ? (
        <div className="driver-idle__empty">
          <div className="driver-idle__pulse">
            <div className="driver-idle__pulse-ring" />
            <div className="driver-idle__pulse-ring driver-idle__pulse-ring--2" />
            <span className="driver-idle__pulse-icon">🚴</span>
          </div>
          <h2>Du bist online</h2>
          <p>Warte auf Fahrtanfragen in deiner Nähe</p>
        </div>
      ) : (
        <>
          <div className="driver-idle__req-header">
            <h2>Neue Anfragen</h2>
            <span className="rm-requests-badge">{requests.length}</span>
          </div>
          <div className="rm-requests-list">
            {requests.map(req => (
              <RequestItem key={req.id} req={req} isAccepting={isAccepting} onAccept={onAccept} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
