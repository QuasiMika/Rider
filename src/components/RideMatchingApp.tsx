import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../auth/AuthUser'
import { DriverPanel } from './DriverPanel'
import { GuestPanel } from './GuestPanel'
import './RideMatching.css'

type AppRole = 'driver' | 'guest' | null

export function RideMatchingApp() {
  const { user } = useAuth()
  const [role, setRole] = useState<AppRole>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('user_profile')
      .select('role')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRole(data.role === 'driver' ? 'driver' : 'guest')
        setLoading(false)
      })
  }, [user])

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="rm">
      <section className="rm-hero">
        <div className="rm-hero__inner">
          <span className="rm-hero__icon">{role === 'driver' ? '🚴' : '🛺'}</span>
          <div className="rm-hero__text">
            <h1>{role === 'driver' ? 'Fahrer-Dashboard' : 'Fahrt buchen'}</h1>
            <p>
              {role === 'driver'
                ? 'Melde dich verfügbar und warte auf deinen nächsten Gast.'
                : 'Fordere eine Fahrt an und wir finden den nächsten freien Fahrer für dich.'}
            </p>
          </div>
        </div>
      </section>

      <section className="rm-content">
        {loading && <p style={{ color: 'var(--text)' }}>Lade...</p>}
        {error && <p className="ride-error">{error}</p>}
        {!loading && !error && role === 'driver' && <DriverPanel />}
        {!loading && !error && role === 'guest' && <GuestPanel />}
      </section>
    </div>
  )
}
