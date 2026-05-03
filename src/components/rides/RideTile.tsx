import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useResolvedNames } from '../../hooks/useResolvedNames'
import { supabase } from '../../utils/supabase'
import type { Ride } from '../../types/ride'
import './RideTile.css'

type Props = {
  ride: Ride
  userId: string
  userRole: 'driver' | 'guest'
  onClick: () => void
}

export function RideTile({ ride, userId, userRole, onClick }: Props) {
  const partnerId = userRole === 'guest' ? ride.driver_id : ride.guest_id
  const partnerLabel = userRole === 'guest' ? 'Fahrer' : 'Gast'

  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)

  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [stars, setStars] = useState<number | null | 'loading'>('loading')
  const [isReported, setIsReported] = useState(false)

  useEffect(() => {
    if (!partnerId) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', partnerId)
      .single()
      .then(({ data }) => {
        if (data) setPartnerName(`${data.first_name ?? ''} ${data.family_name ?? ''}`.trim() || '–')
      })
  }, [partnerId])

  useEffect(() => {
    supabase
      .from('ride_reviews')
      .select('stars')
      .eq('ride_id', ride.id)
      .eq('reviewer_id', userId)
      .maybeSingle()
      .then(({ data }) => setStars(data?.stars ?? null))
  }, [ride.id, userId])

  useEffect(() => {
    supabase
      .from('ride_reports')
      .select('id')
      .eq('ride_id', ride.id)
      .eq('reporter_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setIsReported(true) })
  }, [ride.id, userId])

  const date = new Date(ride.created_at).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
  const time = new Date(ride.created_at).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit',
  })

  const destinationDiffers = !!ride.actual_end_location && ride.actual_end_location !== ride.destination

  return (
    <button className="ride-tile" onClick={onClick} type="button">
      <div className="ride-tile__header">
        <div className="ride-tile__datetime">
          <span className="ride-tile__date">{date}</span>
          <span className="ride-tile__time">{time} Uhr</span>
        </div>
        <span className="ride-tile__status">Abgeschlossen</span>
      </div>

      <div className="ride-tile__route">
        <div className="ride-tile__loc">
          <span className="ride-tile__dot ride-tile__dot--from" />
          <div>
            <div className="ride-tile__loc-label">Von</div>
            <div className="ride-tile__loc-name">{pickupName || '–'}</div>
          </div>
        </div>
        <div className="ride-tile__line" />
        <div className="ride-tile__loc">
          <span className={`ride-tile__dot ${destinationDiffers && !isReported ? 'ride-tile__dot--warn' : destinationDiffers && isReported ? 'ride-tile__dot--reported' : 'ride-tile__dot--to'}`} />
          <div>
            <div className="ride-tile__loc-label">
              Nach
              {isReported ? (
                <Link
                  to={`/report/${ride.id}`}
                  className="ride-tile__reported-badge"
                  onClick={e => e.stopPropagation()}
                >
                  ● Gemeldet
                </Link>
              ) : destinationDiffers ? (
                <span className="ride-tile__warn-badge">Abweichung</span>
              ) : null}
            </div>
            <div className="ride-tile__loc-name">{destName || '–'}</div>
          </div>
        </div>
      </div>

      <div className="ride-tile__footer">
        <div className="ride-tile__partner">
          <span className="ride-tile__partner-label">{partnerLabel}</span>
          <span className="ride-tile__partner-name">{partnerName ?? '…'}</span>
        </div>
        <div className="ride-tile__rating">
          {stars === 'loading' ? null : stars !== null ? (
            <div className="ride-tile__stars">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={`ride-tile__star ${n <= stars ? 'ride-tile__star--on' : ''}`}>★</span>
              ))}
            </div>
          ) : (
            <span className="ride-tile__unrated">Nicht bewertet</span>
          )}
        </div>
      </div>
    </button>
  )
}
