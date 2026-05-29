import { useResolvedNames } from '../hooks/useResolvedNames'
import type { RequestWithProfile } from '../hooks/useDriverRequests'

type RequestItemProps = {
  req: RequestWithProfile
  isAccepting: boolean
  driverPriceMultiplier: number
  onAccept: (id: string) => void
}

function RequestItem({ req, isAccepting, driverPriceMultiplier, onAccept }: RequestItemProps) {
  const { pickupName, destName } = useResolvedNames(undefined, req.pickupLocation, req.destination)
  const displayedPrice = req.price_eur == null
    ? null
    : (req.price_eur / (req.rickshaw_price_multiplier || 1)) * driverPriceMultiplier

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
        {displayedPrice != null && (
          <div className="rm-request-item__price">
            {displayedPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
        <div className="rm-request-item__passengers">
          {req.passenger_count} {req.passenger_count === 1 ? 'Person' : 'Personen'}
        </div>
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
  minPassengers: number
  maxPassengers: number
  capacity: number
  driverPriceMultiplier: number
  onPassengerRangeChange: (min: number, max: number) => void
}

export function DriverWaiting({
  requests,
  isAccepting,
  error,
  onAccept,
  minPassengers,
  maxPassengers,
  capacity,
  driverPriceMultiplier,
  onPassengerRangeChange,
}: Props) {
  const passengerOptions = Array.from({ length: capacity }, (_, index) => index + 1)

  return (
    <div className="driver-idle">
      {error && <p className="ride-error">{error}</p>}

      <div className="driver-filter">
        <div>
          <div className="driver-filter__label">Aufträge für</div>
          <div className="driver-filter__value">{minPassengers} bis {maxPassengers} Personen</div>
        </div>
        <div className="driver-filter__controls">
          <select
            className="driver-filter__select"
            value={minPassengers}
            onChange={e => {
              const nextMin = Number(e.target.value)
              onPassengerRangeChange(nextMin, Math.max(nextMin, maxPassengers))
            }}
          >
            {passengerOptions.map(count => (
              <option key={count} value={count}>ab {count}</option>
            ))}
          </select>
          <select
            className="driver-filter__select"
            value={maxPassengers}
            onChange={e => {
              const nextMax = Number(e.target.value)
              onPassengerRangeChange(Math.min(minPassengers, nextMax), nextMax)
            }}
          >
            {passengerOptions.map(count => (
              <option key={count} value={count}>bis {count}</option>
            ))}
          </select>
        </div>
      </div>

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
              <RequestItem
                key={req.id}
                req={req}
                isAccepting={isAccepting}
                driverPriceMultiplier={driverPriceMultiplier}
                onAccept={onAccept}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
