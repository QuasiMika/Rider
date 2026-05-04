import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { dbService } from '../services'
import type { UserProfile } from '../services'
import type { Ride } from '../types/ride'
import { RideTile } from '../components/rides/RideTile'
import { RideDetailDialog, StarDisplay } from '../components/rides/RideDetailDialog'
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

export default function Profil() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRides, setCompletedRides] = useState<Ride[]>([])
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number } | null>(null)

  const selectedRideId = searchParams.get('ride')
  const selectedRide = completedRides.find(r => r.id === selectedRideId) ?? null
  const [showAllRides, setShowAllRides] = useState(false)

  const RIDES_INITIAL = 4

  useEffect(() => {
    if (!user) return
    dbService.getUserProfile(user.id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setProfile(data)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    dbService.getReviews(user.id).then(data => {
      if (data.length > 0) {
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
    dbService.getCompletedRides(user.id, col).then(data => setCompletedRides(data))
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

            <RideCta userId={user?.id ?? ''} role={userRole} />
          </div>

          <div className="profil-rides">
            <h2 className="profil-rides__title">Abgeschlossene Fahrten</h2>
            {completedRides.length === 0 ? (
              <p className="profil-muted">Keine abgeschlossenen Fahrten.</p>
            ) : (
              <>
                <div className="profil-rides__grid">
                  {(showAllRides ? completedRides : completedRides.slice(0, RIDES_INITIAL)).map(ride => (
                    <RideTile
                      key={ride.id}
                      ride={ride}
                      userId={user!.id}
                      userRole={userRole}
                      onClick={() => setSearchParams({ ride: ride.id })}
                    />
                  ))}
                </div>
                {completedRides.length > RIDES_INITIAL && (
                  <button className="profil-rides__toggle" onClick={() => setShowAllRides(v => !v)}>
                    {showAllRides
                      ? 'Weniger anzeigen'
                      : `Alle ${completedRides.length} Fahrten anzeigen`}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {selectedRide && user && profile && (
        <RideDetailDialog
          ride={selectedRide}
          userId={user.id}
          userRole={userRole}
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  )
}
