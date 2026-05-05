import { useState, useEffect } from 'react'
import { dbService } from '../services'
import type { Ride } from '../types/ride'

type PartnerProfile = { first_name: string | null; family_name: string | null }

type Props = { ride: Ride; onReset: () => void }

export function DriverRideCompleted({ ride, onReset }: Props) {
  const [guest, setGuest] = useState<PartnerProfile | null>(null)

  useEffect(() => {
    if (!ride.guest_id) return
    dbService.getUserProfiles([ride.guest_id]).then(profiles => {
      if (profiles[0]) setGuest(profiles[0])
    })
  }, [ride.guest_id])

  const guestName = guest
    ? `${guest.first_name ?? ''} ${guest.family_name ?? ''}`.trim() || 'Gast'
    : 'Gast'

  const priceEur = typeof ride.price_eur === 'number' ? ride.price_eur : null
  const priceLabel = priceEur != null
    ? priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    : null

  return (
    <div className="driver-completed">
      <div className="driver-completed__card">
        <div className="driver-completed__icon">✓</div>
        <div className="driver-completed__title">Fahrt abgeschlossen</div>
        <div className="driver-completed__sub">
          Gut gemacht{guestName !== 'Gast' ? `, du hast ${guestName} sicher ans Ziel gebracht` : ''}!
        </div>
        {priceLabel && (
          <div className="driver-completed__earnings">
            <span className="driver-completed__earnings-label">Deine Einnahme</span>
            <span className="driver-completed__earnings-value">{priceLabel}</span>
          </div>
        )}
      </div>
      <button className="driver-completed__cta" onClick={onReset}>
        Neue Anfragen ansehen →
      </button>
    </div>
  )
}
