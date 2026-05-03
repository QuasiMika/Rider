import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dbService } from '../services'
import type { UserProfile } from '../services'
import { useAuth } from '../auth/AuthUser'
import './Protected.css'

export default function Protected() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    dbService.getUserProfile(user.id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setProfile(data)
      setLoading(false)
    })
  }, [user])

  return (
    <div className="protected">
      <div className="protected-card">
        <div className="protected-header">
          <Link to="/" className="protected-back">← Home</Link>
          <button onClick={signOut} className="protected-signout">Abmelden</button>
        </div>

        <h1 className="protected-heading">Mein Profil</h1>

        {loading && <p className="protected-muted">Wird geladen...</p>}
        {error && <p className="protected-error">{error}</p>}

        {profile && (
          <div className="protected-rows">
            <Row label="Name" value={`${profile.first_name ?? '–'} ${profile.family_name ?? ''}`.trim()} />
            <Row label="E-Mail" value={user?.email ?? '–'} />
            <Row label="Rolle" value={profile.role === 'driver' ? '🚴 Fahrer' : '🚲 Kunde'} />
            <Row label="Aktiv" value={profile.currently_working ? 'Ja' : 'Nein'} />
            <Row
              label="Registriert"
              value={new Date(profile.created_at).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="protected-row">
      <span className="protected-row-label">{label}</span>
      <span className="protected-row-value">{value}</span>
    </div>
  )
}
