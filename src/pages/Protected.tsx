import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../auth/AuthUser'
import './Protected.css'

type Notification = {
  id: number
  pickup: string
  dropoff: string
}

type UserProfile = {
  first_name: string | null
  family_name: string | null
  role: 'customer' | 'driver'
  currently_working: boolean
  created_at: string
}

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

export default function Protected() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [customerRides, setCustomerRides] = useState<RideRequest[]>([])
  const [openDriverRides, setOpenDriverRides] = useState<RideRequest[]>([])
  const [acceptedDriverRides, setAcceptedDriverRides] = useState<RideRequest[]>([])
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropoffLocation, setDropoffLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [busyRideId, setBusyRideId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notifCounter = useRef(0)

  const loadDashboard = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    const { data: profileData, error: profileError } = await supabase
      .from('user_profile')
      .select('first_name, family_name, role, currently_working, created_at')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    setProfile(profileData)

    if (profileData.role === 'customer') {
      const { data: rideData, error: rideError } = await supabase
        .from('ride_request')
        .select('id, customer_id, driver_id, pickup_location, dropoff_location, status, created_at, accepted_at, cancelled_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (rideError) {
        setError(rideError.message)
      } else {
        setCustomerRides(rideData ?? [])
      }

      setOpenDriverRides([])
      setAcceptedDriverRides([])
      setLoading(false)
      return
    }

    const [
      { data: openRideData, error: openRideError },
      { data: acceptedRideData, error: acceptedRideError },
    ] = await Promise.all([
      supabase
        .from('ride_request')
        .select('id, customer_id, driver_id, pickup_location, dropoff_location, status, created_at, accepted_at, cancelled_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('ride_request')
        .select('id, customer_id, driver_id, pickup_location, dropoff_location, status, created_at, accepted_at, cancelled_at')
        .eq('driver_id', user.id)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false }),
    ])

    const dashboardError = openRideError ?? acceptedRideError

    if (dashboardError) {
      setError(dashboardError.message)
      setLoading(false)
      return
    }

    setOpenDriverRides(openRideData ?? [])
    setAcceptedDriverRides(acceptedRideData ?? [])
    setCustomerRides([])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    const timeoutId = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [user, loadDashboard])

  useEffect(() => {
    if (!active || !user) return

    const channel = supabase
      .channel('driver-ride-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_request' },
        (payload) => {
          const ride = payload.new as RideRequest
          void loadDashboard()
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
  }, [active, user, loadDashboard])

  const handleCreateRide = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) return

    setSubmitting(true)
    setError(null)
    setMessage(null)

    const { error: insertError } = await supabase.from('ride_request').insert({
      customer_id: user.id,
      pickup_location: pickupLocation.trim(),
      dropoff_location: dropoffLocation.trim(),
      status: 'open',
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setPickupLocation('')
    setDropoffLocation('')
    setMessage('Deine Fahrt wurde erfolgreich angelegt.')
    setSubmitting(false)
    await loadDashboard()
  }

  const handleCancelRide = async (rideId: string) => {
    setBusyRideId(rideId)
    setError(null)
    setMessage(null)

    const { error: cancelError } = await supabase
      .from('ride_request')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', rideId)

    if (cancelError) {
      setError(cancelError.message)
      setBusyRideId(null)
      return
    }

    setMessage('Die Fahrt wurde storniert.')
    setBusyRideId(null)
    await loadDashboard()
  }

  const handleAcceptRide = async (rideId: string) => {
    if (!user) return

    setBusyRideId(rideId)
    setError(null)
    setMessage(null)

    const { count, error: acceptError } = await supabase
      .from('ride_request')
      .update({
        status: 'accepted',
        driver_id: user.id,
        accepted_at: new Date().toISOString(),
      }, { count: 'exact' })
      .eq('id', rideId)
      .eq('status', 'open')

    if (acceptError) {
      setError(acceptError.message)
      setBusyRideId(null)
      return
    }

    if (count === 0) {
      setError('Update fehlgeschlagen: Prüfe ob dein Konto als Fahrer in user_profile eingetragen ist (role = driver).')
      setBusyRideId(null)
      await loadDashboard()
      return
    }

    setMessage('Auftrag erfolgreich angenommen.')
    setBusyRideId(null)
    await loadDashboard()
  }

  const handleCompleteRide = async (rideId: string) => {
    if (!user) return

    setBusyRideId(rideId)
    setError(null)
    setMessage(null)

    const { error: completeError } = await supabase
      .from('ride_request')
      .update({ status: 'completed' })
      .eq('id', rideId)
      .eq('driver_id', user.id)
      .eq('status', 'accepted')

    if (completeError) {
      setError(completeError.message)
      setBusyRideId(null)
      return
    }

    setMessage('Fahrt erfolgreich abgeschlossen.')
    setBusyRideId(null)
    await loadDashboard()
  }

  const displayName = [profile?.first_name, profile?.family_name].filter(Boolean).join(' ')

  return (
    <div className="protected">
      <div className="driver-notifications">
        {notifications.map((n) => (
          <div key={n.id} className="driver-notif">
            <strong>Neue Fahrtanfrage!</strong>
            <span>{n.pickup} → {n.dropoff}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-shell">
        <div className="dashboard-header">
          <div>
            <Link to="/" className="protected-back">Zur Startseite</Link>
            <h1 className="protected-heading">
              {profile?.role === 'driver' ? 'Fahrer-Dashboard' : 'Kunden-Dashboard'}
            </h1>
            <p className="protected-subheading">
              {displayName || user?.email}
              {profile?.role ? ` · ${profile.role === 'driver' ? 'Fahrer' : 'Kunde'}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
            {profile?.role === 'driver' && (
              <label className="driver-toggle">
                <span className={`driver-toggle-label${active ? ' driver-toggle-label--active' : ''}`}>
                  {active ? 'Aktiv – suche Fahrten' : 'Aus – nicht aktiv'}
                </span>
                <div className={`toggle-track${active ? ' toggle-track--on' : ''}`} onClick={() => setActive((v) => !v)}>
                  <div className="toggle-thumb" />
                </div>
              </label>
            )}
            <button onClick={signOut} className="protected-signout">Abmelden</button>
          </div>
        </div>

        {loading && <p className="protected-muted">Dashboard wird geladen...</p>}
        {error && <p className="protected-error">{error}</p>}
        {message && <p className="protected-message">{message}</p>}

        {!loading && profile?.role === 'customer' && (
          <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="panel-header">
                <h2>Fahrt buchen</h2>
                <p>Start und Ziel eingeben, dann landet der Auftrag direkt bei allen Fahrern.</p>
              </div>

              <form className="ride-form" onSubmit={handleCreateRide}>
                <label className="dashboard-label">
                  Start
                  <input
                    className="dashboard-input"
                    type="text"
                    value={pickupLocation}
                    onChange={(event) => setPickupLocation(event.target.value)}
                    placeholder="z. B. Hauptbahnhof"
                    required
                  />
                </label>

                <label className="dashboard-label">
                  Ziel
                  <input
                    className="dashboard-input"
                    type="text"
                    value={dropoffLocation}
                    onChange={(event) => setDropoffLocation(event.target.value)}
                    placeholder="z. B. Flughafen"
                    required
                  />
                </label>

                <button className="dashboard-button dashboard-button--primary" type="submit" disabled={submitting}>
                  {submitting ? 'Wird gespeichert...' : 'Fahrt buchen'}
                </button>
              </form>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <h2>Meine Fahrten</h2>
                <p>Alle angelegten Fahrten bleiben fuer dich sichtbar, neueste zuerst.</p>
              </div>

              {customerRides.length === 0 ? (
                <p className="protected-muted">Noch keine Fahrten vorhanden.</p>
              ) : (
                <div className="ride-list">
                  {customerRides.map((ride) => (
                    <article className="ride-card" key={ride.id}>
                      <div className="ride-card-top">
                        <span className={`ride-status ride-status--${ride.status}`}>
                          {getCustomerStatusLabel(ride.status)}
                        </span>
                        <span className="ride-date">{formatDate(ride.created_at)}</span>
                      </div>

                      <div className="ride-route">
                        <div>
                          <span className="ride-route-label">Start</span>
                          <strong>{ride.pickup_location}</strong>
                        </div>
                        <div>
                          <span className="ride-route-label">Ziel</span>
                          <strong>{ride.dropoff_location}</strong>
                        </div>
                      </div>

                      <div className="ride-card-actions">
                        <button
                          className="dashboard-button dashboard-button--danger"
                          type="button"
                          disabled={ride.status === 'cancelled' || busyRideId === ride.id}
                          onClick={() => void handleCancelRide(ride.id)}
                        >
                          {busyRideId === ride.id ? 'Wird storniert...' : 'Stornieren'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {!loading && profile?.role === 'driver' && (
          <>
            <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="panel-header">
                <h2>Offene Auftraege</h2>
                <p>Alle verfuegbaren Buchungen werden mit dem neuesten Auftrag ganz oben angezeigt.</p>
              </div>

              {openDriverRides.length === 0 ? (
                <p className="protected-muted">Aktuell gibt es keine offenen Auftraege.</p>
              ) : (
                <div className="ride-list">
                  {openDriverRides.map((ride) => (
                    <article className="ride-card" key={ride.id}>
                      <div className="ride-card-top">
                        <span className="ride-status ride-status--open">Offen</span>
                        <span className="ride-date">{formatDate(ride.created_at)}</span>
                      </div>

                      <div className="ride-route">
                        <div>
                          <span className="ride-route-label">Start</span>
                          <strong>{ride.pickup_location}</strong>
                        </div>
                        <div>
                          <span className="ride-route-label">Ziel</span>
                          <strong>{ride.dropoff_location}</strong>
                        </div>
                      </div>

                      <div className="ride-card-actions">
                        <button
                          className="dashboard-button dashboard-button--primary"
                          type="button"
                          disabled={busyRideId === ride.id}
                          onClick={() => void handleAcceptRide(ride.id)}
                        >
                          {busyRideId === ride.id ? 'Wird verarbeitet...' : 'Annehmen'}
                        </button>

                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <h2>Meine angenommenen Fahrten</h2>
                <p>Hier bleiben die von dir angenommenen Auftraege sichtbar.</p>
              </div>

              {acceptedDriverRides.length === 0 ? (
                <p className="protected-muted">Du hast noch keine Fahrt angenommen.</p>
              ) : (
                <div className="ride-list">
                  {acceptedDriverRides.map((ride) => (
                    <article className="ride-card" key={ride.id}>
                      <div className="ride-card-top">
                        <span className="ride-status ride-status--accepted">Angenommen</span>
                        <span className="ride-date">
                          {formatDate(ride.accepted_at ?? ride.created_at)}
                        </span>
                      </div>

                      <div className="ride-route">
                        <div>
                          <span className="ride-route-label">Start</span>
                          <strong>{ride.pickup_location}</strong>
                        </div>
                        <div>
                          <span className="ride-route-label">Ziel</span>
                          <strong>{ride.dropoff_location}</strong>
                        </div>
                      </div>

                      <div className="ride-card-actions">
                        <button
                          className="dashboard-button dashboard-button--primary"
                          type="button"
                          disabled={busyRideId === ride.id}
                          onClick={() => void handleCompleteRide(ride.id)}
                        >
                          {busyRideId === ride.id ? 'Wird abgeschlossen...' : 'Fahrt abschließen'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCustomerStatusLabel(status: RideStatus) {
  if (status === 'accepted') return 'Angenommen'
  if (status === 'cancelled') return 'Storniert'
  if (status === 'completed') return 'Abgeschlossen'
  return 'Offen'
}
