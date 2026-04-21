import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../auth/AuthUser'

type AppRole = 'driver' | 'guest' | null

export function RideMatchingApp() {
  const { user } = useAuth()
  const [role, setRole] = useState<AppRole>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fetchRole = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('user_profile')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (fetchError) throw fetchError

        const normalized = data.role === 'driver' ? 'driver' : 'guest'
        setRole(normalized)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Laden des Profils'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchRole()
  }, [user])

  if (!user) return <Navigate to="/login" replace />
  if (loading) return <p>Lade Profil...</p>
  if (error) return <p className="ride-error">Fehler: {error}</p>
  if (!role) return <p>Keine Rolle gefunden.</p>

  return <Navigate to={`/${role}`} replace />
}
