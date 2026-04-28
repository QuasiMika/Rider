import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import './DriverPage.css'

type RideStatus = 'open' | 'accepted' | 'cancelled' | 'completed'

type RideRequest = {
  id: string
  customer_id: string
  driver_id: string | null
  pickup_location: string
  dropoff_location: string
  status: RideStatus
  created_at: string
  accepted_at: string | null
  cancelled_at: string | null
}

type Notification = {
  id: number
  pickup: string
  dropoff: string
}

export default function DriverPage() {
  const [rides, setRides] = useState<RideRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifCounter = useRef(0)

  async function fetchRides() {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('ride_request')
      .select('id, customer_id, driver_id, pickup_location, dropoff_location, status, created_at, accepted_at, cancelled_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRides(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchRides()
  }, [])

  useEffect(() => {
    if (!active) return

    const channel = supabase
      .channel('ride_request_inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_request' },
        (payload) => {
          const ride = payload.new as RideRequest
          void fetchRides()
          const id = ++notifCounter.current
          setNotifications((prev) => [
            ...prev,
            { id, pickup: ride.pickup_location, dropoff: ride.dropoff_location },
          ])
          window.setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id))
          }, 4000)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [active])

  const statusLabel = (status: RideStatus) => {
    switch (status) {
      case 'open': return 'Offen'
      case 'accepted': return 'Angenommen'
      case 'cancelled': return 'Storniert'
      case 'completed': return 'Abgeschlossen'
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '–'
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="driver-page">
      <div className="driver-notifications">
        {notifications.map((n) => (
          <div key={n.id} className="driver-notif">
            <strong>Neue Fahrtanfrage!</strong>
            <span>{n.pickup} → {n.dropoff}</span>
          </div>
        ))}
      </div>

      <div className="driver-shell">
        <Link to="/protected" className="driver-back">← Zurück</Link>

        <div className="driver-header">
          <h1 className="driver-heading">Alle Fahrtanfragen</h1>
          <label className="driver-toggle">
            <span className={`driver-toggle-label ${active ? 'driver-toggle-label--active' : ''}`}>
              {active ? 'Aktiv – suche Fahrten' : 'Aus – nicht aktiv'}
            </span>
            <div className={`toggle-track ${active ? 'toggle-track--on' : ''}`} onClick={() => setActive((v) => !v)}>
              <div className="toggle-thumb" />
            </div>
          </label>
        </div>

        {error && <p className="driver-error">{error}</p>}

        {loading ? (
          <p className="driver-loading">Lade Fahrten…</p>
        ) : rides.length === 0 ? (
          <p className="driver-empty">Keine Fahrtanfragen vorhanden.</p>
        ) : (
          <div className="driver-table-wrap">
            <table className="driver-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Abholort</th>
                  <th>Zielort</th>
                  <th>Erstellt</th>
                  <th>Angenommen</th>
                  <th>Storniert</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((ride) => (
                  <tr key={ride.id} className={`status-${ride.status}`}>
                    <td><span className={`badge badge-${ride.status}`}>{statusLabel(ride.status)}</span></td>
                    <td>{ride.pickup_location}</td>
                    <td>{ride.dropoff_location}</td>
                    <td>{formatDate(ride.created_at)}</td>
                    <td>{formatDate(ride.accepted_at)}</td>
                    <td>{formatDate(ride.cancelled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
