import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useResolvedNames } from '../../hooks/useResolvedNames'
import { supabase } from '../../utils/supabase'
import type { Ride } from '../../types/ride'
import './RideDetailDialog.css'

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="star-picker" aria-label="Bewertung auswählen">
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

export function StarDisplay({ value, count }: { value: number; count: number }) {
  const filled = Math.round(value)
  return (
    <span className="star-display" title={`${value.toFixed(1)} von 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`star-display__star ${n <= filled ? 'star-display__star--on' : ''}`}>★</span>
      ))}
      <span className="star-display__label">{value.toFixed(1)} ({count})</span>
    </span>
  )
}

type PartnerProfile = { first_name: string | null; family_name: string | null }

type Props = {
  ride: Ride
  userId: string
  userRole: 'driver' | 'guest'
  onClose: () => void
}

export function RideDetailDialog({ ride, userId, userRole, onClose }: Props) {
  const partnerId = userRole === 'guest' ? ride.driver_id : ride.guest_id
  const partnerLabel = userRole === 'guest' ? 'Fahrer' : 'Gast'

  const { pickupName, destName } = useResolvedNames(ride.id, ride.pickup_location, ride.destination)
  const { pickupName: actualEndName } = useResolvedNames(
    ride.id + '-end',
    ride.actual_end_location,
    undefined,
  )

  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [existingStars, setExistingStars] = useState<number | null | 'loading'>('loading')
  const [selectedStars, setSelectedStars] = useState(0)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    if (!partnerId) return
    supabase
      .from('user_profile')
      .select('first_name, family_name')
      .eq('user_id', partnerId)
      .single()
      .then(({ data }) => { if (data) setPartner(data) })
  }, [partnerId])

  useEffect(() => {
    supabase
      .from('ride_reviews')
      .select('stars')
      .eq('ride_id', ride.id)
      .eq('reviewer_id', userId)
      .maybeSingle()
      .then(({ data }) => setExistingStars(data?.stars ?? null))
  }, [ride.id, userId])

  useEffect(() => {
    supabase
      .from('ride_reports')
      .select('id')
      .eq('ride_id', ride.id)
      .eq('reporter_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setReported(true) })
  }, [ride.id, userId])

  const partnerName = partner
    ? `${partner.first_name ?? ''} ${partner.family_name ?? ''}`.trim() || '–'
    : '…'

  const destinationDiffers = !!ride.actual_end_location && ride.actual_end_location !== ride.destination

  const submitReview = async () => {
    if (!selectedStars || !partnerId) return
    setReviewSubmitting(true)
    setReviewError(null)
    const { error } = await supabase.from('ride_reviews').insert({
      ride_id: ride.id,
      reviewer_id: userId,
      reviewee_id: partnerId,
      stars: selectedStars,
    })
    if (error) setReviewError(error.message)
    else setExistingStars(selectedStars)
    setReviewSubmitting(false)
  }

  const submitReport = async () => {
    setSubmitting(true)
    setReportError(null)
    const { error } = await supabase.from('ride_reports').insert({
      ride_id: ride.id,
      reporter_id: userId,
      notes: notes.trim() || null,
    })
    if (error) {
      console.error('ride_reports insert failed:', error)
      setReportError(error.message)
    } else {
      setReported(true)
      setReportOpen(false)
    }
    setSubmitting(false)
  }

  return (
    <div className="ride-dialog-backdrop" onClick={onClose}>
      <div className="ride-dialog" onClick={e => e.stopPropagation()}>
        <button className="ride-dialog__close" onClick={onClose} aria-label="Schließen">✕</button>

        {/* Header */}
        <h2 className="ride-dialog__title">Fahrtdetails</h2>
        <div className="ride-dialog__date">
          {new Date(ride.created_at).toLocaleDateString('de-DE', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          })}
        </div>

        {/* Meta row: partner + existing rating */}
        <div className="ride-dialog__meta">
          {partnerId && (
            <div className="ride-dialog__partner">
              <span className="ride-dialog__partner-label">{partnerLabel}</span>
              <Link to={`/profile/${partnerId}`} className="ride-dialog__partner-link">
                {partnerName} →
              </Link>
            </div>
          )}
          {existingStars !== null && existingStars !== 'loading' && (
            <StarDisplay value={existingStars} count={1} />
          )}
        </div>

        {/* Route */}
        <div className="ride-dialog__route">
          <div className="ride-dialog__loc">
            <span className="ride-dialog__loc-dot ride-dialog__loc-dot--from" />
            <div>
              <div className="ride-dialog__loc-label">Von</div>
              <div className="ride-dialog__loc-value">{pickupName || '–'}</div>
            </div>
          </div>
          <div className="ride-dialog__line" />
          <div className="ride-dialog__loc">
            <span className={`ride-dialog__loc-dot ${destinationDiffers ? 'ride-dialog__loc-dot--warn' : 'ride-dialog__loc-dot--to'}`} />
            <div>
              <div className="ride-dialog__loc-label">
                {destinationDiffers ? 'Geplantes Ziel' : 'Nach'}
                {destinationDiffers && !reported && (
                  <button
                    type="button"
                    className="ride-dialog__warn-badge"
                    onClick={() => setReportOpen(v => !v)}
                    title="Fahrt melden"
                  >
                    ⚠ Abweichung
                  </button>
                )}
                {reported && (
                  <Link
                    to={`/report/${ride.id}`}
                    className="ride-dialog__reported-badge"
                  >
                    ✓ Gemeldet →
                  </Link>
                )}
              </div>
              <div className="ride-dialog__loc-value">{destName || '–'}</div>
            </div>
          </div>
          {destinationDiffers && (
            <>
              <div className="ride-dialog__line" />
              <div className="ride-dialog__loc">
                <span className="ride-dialog__loc-dot ride-dialog__loc-dot--warn" />
                <div>
                  <div className="ride-dialog__loc-label">Tatsächliches Ende</div>
                  <div className="ride-dialog__loc-value">{actualEndName || '–'}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Report form — expands when "Abweichung" badge is clicked */}
        {destinationDiffers && reportOpen && !reported && (
          <div className="ride-dialog__report">
            <p className="ride-dialog__report-hint">
              Das tatsächliche Fahrtende weicht vom geplanten Ziel ab. Möchtest du die Fahrt melden?
            </p>
            <textarea
              className="ride-dialog__notes"
              placeholder="Optionale Anmerkungen..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="ride-dialog__report-actions">
              <button
                type="button"
                className="ride-dialog__btn ride-dialog__btn--ghost"
                onClick={() => setReportOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="ride-dialog__btn ride-dialog__btn--warn"
                onClick={submitReport}
                disabled={submitting}
              >
                {submitting ? 'Wird gesendet...' : 'Fahrt melden'}
              </button>
            </div>
          </div>
        )}
        {reportError && <p className="ride-dialog__error ride-dialog__error--standalone">{reportError}</p>}

        {/* Star rating form */}
        {existingStars === null && (
          <div className="ride-dialog__review">
            <span className="ride-dialog__section-title">{partnerLabel} bewerten</span>
            <StarPicker value={selectedStars} onChange={setSelectedStars} />
            {reviewError && <p className="ride-dialog__error">{reviewError}</p>}
            <button
              type="button"
              className="ride-dialog__btn"
              onClick={submitReview}
              disabled={reviewSubmitting || selectedStars === 0}
            >
              {reviewSubmitting ? 'Wird gespeichert...' : 'Bewertung abgeben'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
