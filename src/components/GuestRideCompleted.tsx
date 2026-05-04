import { useState, useEffect } from 'react'
import { dbService, functionsService } from '../services'
import type { Ride } from '../types/ride'

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-picker__star ${n <= (hovered || value) ? 'star-picker__star--on' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} Stern${n > 1 ? 'e' : ''}`}
        >★</button>
      ))}
    </div>
  )
}

function formatEur(amount: number) {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

type Props = {
  ride: Ride
  userId: string
  onNewRide: () => void
}

export function GuestRideCompleted({ ride, userId, onNewRide }: Props) {
  const [existingStars, setExistingStars] = useState<number | null | 'loading'>('loading')
  const [selectedStars, setSelectedStars] = useState(0)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [cashConfirmed, setCashConfirmed] = useState(false)

  useEffect(() => {
    if (!userId) return
    dbService.getReview(ride.id, userId).then(r => setExistingStars(r?.stars ?? null))
  }, [ride.id, userId])

  const submitReview = async () => {
    if (!selectedStars || !ride.driver_id || !userId) return
    setReviewSubmitting(true); setReviewError(null)
    const { error } = await dbService.insertReview(ride.id, userId, ride.driver_id, selectedStars)
    if (error) setReviewError(error.message)
    else setExistingStars(selectedStars)
    setReviewSubmitting(false)
  }

  const handleStripePayment = async () => {
    setPaymentLoading(true); setPaymentError(null)
    const result = await functionsService.invokeCreateCheckout(ride.id)
    if (!result?.url) {
      setPaymentError('Zahlung konnte nicht gestartet werden.')
      setPaymentLoading(false)
      return
    }
    window.location.href = result.url
  }

  const priceEur = typeof ride.price_eur === 'number' ? ride.price_eur : null

  return (
    <div className="guest-completed">

      <div className="completed-card">

        {/* ── Payment ── */}
        <div className="completed-card__pay">
          <div className="completed-card__label">Jetzt bezahlen</div>

          <div className="completed-card__amount-row">
            <div className="completed-card__amount-icon">💶</div>
            <div>
              <div className="completed-card__amount-value">
                {priceEur != null ? formatEur(priceEur) : '— €'}
              </div>
              <div className="completed-card__amount-sub">Fahrpreis</div>
            </div>
          </div>

          {paymentError && <div className="completed-card__error">{paymentError}</div>}

          {cashConfirmed ? (
            <div className="completed-card__cash-note">
              💵 Bitte gib deinem Fahrer{priceEur != null ? ` ${formatEur(priceEur)}` : ' den Betrag'} in bar.
            </div>
          ) : (
            <>
              <button
                className="completed-card__stripe"
                onClick={handleStripePayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? 'Wird gestartet…' : '💳 Mit Karte bezahlen'}
              </button>
              <div className="completed-card__cash">
                oder{' '}
                <button onClick={() => setCashConfirmed(true)}>bar bezahlen</button>
              </div>
            </>
          )}
        </div>

        {/* ── Review ── */}
        {existingStars !== 'loading' && (
          <>
            <div className="completed-card__sep" />
            <div className="completed-card__review">
              {existingStars === null ? (
                <>
                  <div className="completed-card__review-label">Wie war deine Fahrt?</div>
                  <StarPicker value={selectedStars} onChange={setSelectedStars} />
                  {reviewError && <p className="ride-error">{reviewError}</p>}
                  {selectedStars > 0 && (
                    <button
                      className="rm-btn"
                      onClick={submitReview}
                      disabled={reviewSubmitting}
                    >
                      {reviewSubmitting ? 'Wird gespeichert...' : 'Bewertung abgeben'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="completed-card__review-label">Deine Bewertung</div>
                  <div className="star-picker">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} className={`star-picker__star ${n <= existingStars ? 'star-picker__star--on' : ''}`}>★</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </div>

      <button className="completed-new-ride" onClick={onNewRide}>
        Neue Fahrt buchen →
      </button>

    </div>
  )
}
