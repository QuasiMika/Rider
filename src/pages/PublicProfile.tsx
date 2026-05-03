import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { dbService } from '../services'
import './PublicProfile.css'

type ReviewStats = { avg: number; count: number }

function StarDisplay({ value, count }: { value: number; count: number }) {
  const filled = Math.round(value)
  return (
    <span className="pub-stars" title={`${value.toFixed(1)} von 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`pub-stars__star ${n <= filled ? 'pub-stars__star--on' : ''}`}>★</span>
      ))}
      <span className="pub-stars__label">{value.toFixed(1)} · {count} Bewertung{count !== 1 ? 'en' : ''}</span>
    </span>
  )
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<{ first_name: string | null; family_name: string | null; role: 'customer' | 'driver'; created_at: string } | null>(null)
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      const { data: p } = await dbService.getUserProfile(id)

      if (!p) { setNotFound(true); setLoading(false); return }
      setProfile(p)

      const reviews = await dbService.getReviews(id)
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length
        setReviewStats({ avg, count: reviews.length })
      } else {
        setReviewStats({ avg: 0, count: 0 })
      }

      setLoading(false)
    }

    load()
  }, [id])

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  const fullName = profile
    ? `${profile.first_name ?? ''} ${profile.family_name ?? ''}`.trim() || '–'
    : '–'

  if (loading) {
    return (
      <div className="pub-profil">
        <button className="pub-back" onClick={() => navigate(-1)}>← Zurück</button>
        <p className="pub-muted" style={{ padding: '4rem 3rem' }}>Wird geladen...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="pub-profil">
        <button className="pub-back" onClick={() => navigate(-1)}>← Zurück</button>
        <p className="pub-muted" style={{ padding: '4rem 3rem' }}>Profil nicht gefunden.</p>
      </div>
    )
  }

  return (
    <div className="pub-profil">
      <button className="pub-back" onClick={() => navigate(-1)}>← Zurück</button>

      <section className="pub-hero">
        <div className="pub-hero__inner">
          <div className="pub-avatar">{initials}</div>
          <div className="pub-hero__info">
            <h1 className="pub-hero__name">{fullName}</h1>
            <div className="pub-hero__meta">
              <span className="pub-badge">
                {profile?.role === 'driver' ? '🚴 Fahrer' : '🛺 Gast'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-content">
        <div className="pub-grid">
          <div className="pub-card">
            <div className="pub-card__label">Registriert seit</div>
            <div className="pub-card__value">
              {profile && new Date(profile.created_at).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </div>
          </div>

          <div className="pub-card">
            <div className="pub-card__label">Bewertung</div>
            <div className="pub-card__value">
              {reviewStats && reviewStats.count > 0 ? (
                <StarDisplay value={reviewStats.avg} count={reviewStats.count} />
              ) : (
                <span className="pub-muted">Noch keine Bewertungen</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
