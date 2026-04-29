import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
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
    if (!user || !profile) return
    const col = profile.role === 'driver' ? 'driver_id' : 'guest_id'
    supabase
      .from('rides')
      .select('id, driver_id, guest_id, status, created_at')
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

            <RideCta
              userId={user?.id ?? ''}
              role={profile.role === 'driver' ? 'driver' : 'guest'}
            />
          </div>

          <div className="profil-rides">
            <h2 className="profil-rides__title">Abgeschlossene Fahrten</h2>
            {completedRides.length === 0 ? (
              <p className="profil-muted">Keine abgeschlossenen Fahrten.</p>
            ) : (
              <ul className="profil-rides__list">
                {completedRides.map(ride => (
                  <li key={ride.id} className="profil-rides__item">
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
    </div>
  )
}
