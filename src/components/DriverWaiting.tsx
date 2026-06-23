import { useResolvedNames } from '../hooks/useResolvedNames'
import type { RequestWithProfile } from '../hooks/useDriverRequests'
import { RoundedSelect } from './common/RoundedSelect'

type RequestItemProps = {
  req: RequestWithProfile
  isAccepting: boolean
  onAccept: (id: string) => void
}

function RequestItem({ req, isAccepting, onAccept }: RequestItemProps) {
  const { pickupName, destName } = useResolvedNames(undefined, req.pickupLocation, req.destination)
  const displayedPrice = req.price_eur

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
          {` · ${req.rickshaw_type_name}`}
          {` · ${req.required_price_per_km.toFixed(2).replace('.', ',')} €/km`}
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
  onPassengerRangeChange,
}: Props) {
  const passengerOptions = Array.from({ length: capacity }, (_, index) => index + 1)

  return (
    <div className="driver-idle">
      {error && <p className="ride-error">{error}</p>}

      <div className="driver-filter">
        <div>
          <div className="driver-filter__label">Aufträge für</div>
          <div className="driver-filter__value">
            <span>{minPassengers} bis {maxPassengers} Personen</span>
          </div>
        </div>
        <div className="driver-filter__controls">
          <RoundedSelect
            className="driver-filter__select rounded-select--compact"
            value={String(minPassengers)}
            options={passengerOptions.map(count => ({ value: String(count), label: `ab ${count}` }))}
            onChange={value => {
              const nextMin = Number(value)
              onPassengerRangeChange(nextMin, Math.max(nextMin, maxPassengers))
            }}
          />
          <RoundedSelect
            className="driver-filter__select rounded-select--compact"
            value={String(maxPassengers)}
            options={passengerOptions.map(count => ({ value: String(count), label: `bis ${count}` }))}
            onChange={value => {
              const nextMax = Number(value)
              onPassengerRangeChange(Math.min(minPassengers, nextMax), nextMax)
            }}
          />
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
                onAccept={onAccept}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
