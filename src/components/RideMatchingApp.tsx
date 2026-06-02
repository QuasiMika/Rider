import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { dbService } from '../services'
import { useAuth } from '../auth/AuthUser'
import { DriverPanel } from './DriverPanel'
import { GuestPanel } from './GuestPanel'
import { MaintenanceScreen } from './MaintenanceScreen'
import './RideMatching.css'

type AppRole = 'driver' | 'guest' | null

export function RideMatchingApp() {
  const { user } = useAuth()
  const [role, setRole] = useState<AppRole>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    dbService.getUserProfile(user.id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setRole(data?.role === 'driver' ? 'driver' : 'guest')
      setLoading(false)
    })
  }, [user])

  if (!user) return <Navigate to="/login" replace />

  // Schlägt das initiale Laden der Nutzerdaten fehl (z. B. 503 vom Backend),
  // zeigen wir den Wartungsmodus statt des kaputten Dashboards.
  if (error) return <MaintenanceScreen />

  return (
    <div className="rm">
      <section className="rm-content">
        {loading && <p style={{ color: 'var(--text)' }}>Lade...</p>}
        {!loading && role === 'driver' && <DriverPanel />}
        {!loading && role === 'guest' && <GuestPanel />}
      </section>
    </div>
  )
}
