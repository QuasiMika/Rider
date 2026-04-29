import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { supabase } from '../utils/supabase'
import type { Ride } from '../types/ride'
import './Profil.css'

function RideCta({ userId, role }: { userId: string; role: 'driver' | 'guest' }) {
  const { currentRide, status } = useRideMatching(userId, role)
  const navigate = useNavigate()

  if (status === 'waiting') {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">Suche Fahrer...</div>
        <div className="profil-radar">
          <div className="profil-radar__ring" />
          <div className="profil-radar__ring" />
          <div className="profil-radar__dot" />
        </div>
      </div>
    )
  }

  if (status === 'matched' && currentRide?.status === 'pending') {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">Dein Fahrer ist unterwegs</div>
        <div className="profil-arriving">
          <span className="profil-arriving__vehicle">🛺</span>
          <div className="profil-arriving__road" />
          <span className="profil-arriving__dest">📍</span>
        </div>
      </div>
    )
  }

  if (status === 'matched' && currentRide?.status === 'active') {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">Fahrt läuft</div>
        <div className="profil-card__value profil-active">
          <span className="profil-active__dot" /> Genieße die Fahrt!
        </div>
      </div>
    )
  }

  return (
    <div className="profil-card profil-card--cta" onClick={() => navigate('/ride')}>
      <div className="profil-card__label">Bereit?</div>
      <div className="profil-card__value">Fahrt buchen →</div>
    </div>
  )
}

// ─── Star rating widget ───────────────────────────────────────────────────────

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

function StarDisplay({ value, count }: { value: number; count: number }) {
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

// ─── Ride detail dialog ───────────────────────────────────────────────────────

type PartnerProfile = { first_name: string | null; family_name: string | null }

function RideDetailDialog({
  ride,
  userId,
  userRole,
  onClose,
}: {
  ride: Ride
  userId: string
  userRole: 'driver' | 'guest'
  onClose: () => void
}) {
  const partnerId = userRole === 'guest' ? ride.driver_id : ride.guest_id

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

  const partnerName = partner
    ? `${partner.first_name ?? ''} ${partner.family_name ?? ''}`.trim() || '–'
    : '…'

  const partnerLabel = userRole === 'guest' ? 'Fahrer' : 'Gast'

  const destinationDiffers =
    !!ride.actual_end_location && ride.actual_end_location !== ride.destination

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
    if (error) setReportError(error.message)
    else setReported(true)
    setSubmitting(false)
  }

  return (
    <div className="ride-dialog-backdrop" onClick={onClose}>
      <div className="ride-dialog" onClick={e => e.stopPropagation()}>
        <button className="ride-dialog__close" onClick={onClose} aria-label="Schließen">✕</button>

        <h2 className="ride-dialog__title">Fahrtdetails</h2>
        <div className="ride-dialog__date">
          {new Date(ride.created_at).toLocaleDateString('de-DE', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          })}
        </div>

        {/* Partner */}
        {partnerId && (
          <div className="ride-dialog__partner">
            <span className="ride-dialog__partner-label">{partnerLabel}</span>
            <Link to={`/profile/${partnerId}`} className="ride-dialog__partner-link" onClick={onClose}>
              {partnerName} →
            </Link>
          </div>
        )}

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
            <span className="ride-dialog__loc-dot ride-dialog__loc-dot--to" />
            <div>
              <div className="ride-dialog__loc-label">Geplantes Ziel</div>
              <div className="ride-dialog__loc-value">{destName || '–'}</div>
            </div>
          </div>
          {ride.actual_end_location && (
            <>
              <div className="ride-dialog__line" />
              <div className="ride-dialog__loc">
                <span className={`ride-dialog__loc-dot ${destinationDiffers ? 'ride-dialog__loc-dot--warn' : 'ride-dialog__loc-dot--to'}`} />
                <div>
                  <div className="ride-dialog__loc-label">
                    Tatsächliches Ende
                    {destinationDiffers && (
                      <span className="ride-dialog__warn-badge">Abweichung</span>
                    )}
                  </div>
                  <div className="ride-dialog__loc-value">{actualEndName || '–'}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Star rating */}
        {existingStars === null && (
          <div className="ride-dialog__review">
            <h3 className="ride-dialog__section-title">
              {partnerLabel} bewerten
            </h3>
            <StarPicker value={selectedStars} onChange={setSelectedStars} />
            {reviewError && <p className="ride-dialog__error">{reviewError}</p>}
            <button
              className="ride-dialog__report-btn"
              onClick={submitReview}
              disabled={reviewSubmitting || selectedStars === 0}
            >
              {reviewSubmitting ? 'Wird gespeichert...' : 'Bewertung abgeben'}
            </button>
          </div>
        )}

        {existingStars !== null && existingStars !== 'loading' && (
          <div className="ride-dialog__review ride-dialog__review--done">
            <span className="ride-dialog__section-title">Deine Bewertung</span>
            <StarDisplay value={existingStars} count={1} />
          </div>
        )}

        {/* Report */}
        {destinationDiffers && !reported && (
          <div className="ride-dialog__report">
            <h3 className="ride-dialog__section-title">Fahrt melden</h3>
            <p className="ride-dialog__report-hint">
              Das tatsächliche Fahrtende weicht vom geplanten Ziel ab.
            </p>
            <textarea
              className="ride-dialog__notes"
              placeholder="Optionale Anmerkungen..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
            {reportError && <p className="ride-dialog__error">{reportError}</p>}
            <button
              className="ride-dialog__report-btn ride-dialog__report-btn--warn"
              onClick={submitReport}
              disabled={submitting}
            >
              {submitting ? 'Wird gesendet...' : 'Fahrt melden'}
            </button>
          </div>
        )}

        {reported && (
          <div className="ride-dialog__reported">
            Fahrt wurde gemeldet. Danke für dein Feedback!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main profile page ────────────────────────────────────────────────────────

type UserProfile = {
  first_name: string | null
  family_name: string | null
  role: 'customer' | 'driver'
  currently_working: boolean
  created_at: string
}

export default function Profil() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRides, setCompletedRides] = useState<Ride[]>([])
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number } | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_profile')
      .select('first_name, family_name, role, currently_working, created_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfile(data)
        setLoading(false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase
      .from('ride_reviews')
      .select('stars')
      .eq('reviewee_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const avg = data.reduce((s, r) => s + r.stars, 0) / data.length
          setReviewStats({ avg, count: data.length })
        } else {
          setReviewStats({ avg: 0, count: 0 })
        }
      })
  }, [user])

  useEffect(() => {
    if (!user || !profile) return
    const col = profile.role === 'driver' ? 'driver_id' : 'guest_id'
    supabase
      .from('rides')
      .select('id, driver_id, guest_id, status, pickup_location, destination, actual_end_location, created_at')
      .eq(col, user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setCompletedRides(data as Ride[]) })
  }, [user, profile])

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.family_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  const fullName = profile
    ? `${profile.first_name ?? ''} ${profile.family_name ?? ''}`.trim()
    : '–'

  const userRole = profile?.role === 'driver' ? 'driver' : 'guest'

  return (
    <div className="profil">
      <button className="profil-back" onClick={() => navigate(-1)}>← Zurück</button>

      <section className="profil-hero">
        <div className="profil-hero__inner">
          <div className="profil-avatar">{loading ? '…' : initials}</div>
          <div className="profil-hero__info">
            {loading && <p className="profil-muted">Wird geladen...</p>}
            {error && <p className="profil-error">{error}</p>}
            {profile && (
              <>
                <h1 className="profil-hero__name">{fullName}</h1>
                <div className="profil-hero__meta">
                  <span className="profil-badge">
                    {profile.role === 'driver' ? '🚴 Fahrer' : '🛺 Gast'}
                  </span>
                  {profile.role === 'driver' && (
                    <span className={`profil-badge profil-badge--status ${profile.currently_working ? 'profil-badge--active' : ''}`}>
                      {profile.currently_working ? '● Aktiv' : '○ Inaktiv'}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {profile && (
        <section className="profil-content">
          <div className="profil-grid">
            <div className="profil-card">
              <div className="profil-card__label">Rolle</div>
              <div className="profil-card__value">
                {profile.role === 'driver' ? '🚴 Fahrer' : '🛺 Gast'}
              </div>
            </div>

            {profile.role === 'driver' && (
              <div className="profil-card">
                <div className="profil-card__label">Status</div>
                <div className="profil-card__value">
                  {profile.currently_working ? 'Aktiv' : 'Inaktiv'}
                </div>
              </div>
            )}

            <div className="profil-card">
              <div className="profil-card__label">Registriert seit</div>
              <div className="profil-card__value">
                {new Date(profile.created_at).toLocaleDateString('de-DE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </div>
            </div>

            <div className="profil-card">
              <div className="profil-card__label">Meine Bewertung</div>
              <div className="profil-card__value">
                {reviewStats === null ? (
                  <span className="profil-muted">…</span>
                ) : reviewStats.count > 0 ? (
                  <StarDisplay value={reviewStats.avg} count={reviewStats.count} />
                ) : (
                  <span className="profil-muted">Noch keine Bewertungen</span>
                )}
              </div>
            </div>

            <RideCta
              userId={user?.id ?? ''}
              role={userRole}
            />
          </div>

          <div className="profil-rides">
            <h2 className="profil-rides__title">Abgeschlossene Fahrten</h2>
            {completedRides.length === 0 ? (
              <p className="profil-muted">Keine abgeschlossenen Fahrten.</p>
            ) : (
              <ul className="profil-rides__list">
                {completedRides.map(ride => (
                  <li
                    key={ride.id}
                    className="profil-rides__item profil-rides__item--clickable"
                    onClick={() => setSelectedRide(ride)}
                  >
                    <span className="profil-rides__date">
                      {new Date(ride.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </span>
                    <span className="profil-rides__badge">Abgeschlossen</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {selectedRide && user && profile && (
        <RideDetailDialog
          ride={selectedRide}
          userId={user.id}
          userRole={userRole}
          onClose={() => setSelectedRide(null)}
        />
      )}
    </div>
  )
}
