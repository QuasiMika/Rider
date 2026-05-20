import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { dbService, presenceService } from '../services'
import type { UserProfile, AdminStats } from '../services'
import type { Ride } from '../types/ride'
import { StarDisplay } from '../components/rides/RideDetailDialog'
import './Admin.css'
import './Einnahmen.css'

type Tab = 'dashboard' | 'rides' | 'drivers'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Unterwegs',
  picked_up: 'Aufgenommen',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(minutes: number) {
  if (minutes < 1) return '< 1 Min.'
  return `${minutes.toFixed(1)} Min.`
}

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

type MonthBar = {
  key: string; label: string; year: number; month: number
  amount: number; rides: number; isCurrent: boolean
}

function buildMonthlyData(rides: Ride[]): MonthBar[] {
  const now = new Date()
  const bars: MonthBar[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    bars.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_DE[d.getMonth()], year: d.getFullYear(), month: d.getMonth(),
      amount: 0, rides: 0, isCurrent: i === 0,
    })
  }
  for (const ride of rides) {
    if (!ride.price_eur) continue
    const d = new Date(ride.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bar = bars.find(b => b.key === key)
    if (bar) { bar.amount += ride.price_eur; bar.rides++ }
  }
  bars.forEach(b => { b.amount = Math.round(b.amount * 100) / 100 })
  return bars
}

function BarChart({ data }: { data: MonthBar[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount), 0.01)
  return (
    <div className="ein-chart">
      {data.map((bar, i) => {
        const pct = (bar.amount / maxAmount) * 100
        return (
          <div key={bar.key} className="ein-chart__col">
            <div className="ein-chart__bar-area">
              <div
                className={`ein-chart__bar${bar.amount === 0 ? ' ein-chart__bar--empty' : ''}${bar.isCurrent ? ' ein-chart__bar--current' : ''}`}
                style={{ '--h': `${Math.max(pct, bar.amount > 0 ? 2 : 0)}%`, '--i': i } as React.CSSProperties}
              >
                {bar.amount > 0 && (
                  <span className="ein-chart__tooltip">
                    {formatEur(bar.amount)}<br />{bar.rides} {bar.rides === 1 ? 'Fahrt' : 'Fahrten'}
                  </span>
                )}
              </div>
            </div>
            <span className={`ein-chart__label${bar.isCurrent ? ' ein-chart__label--current' : ''}`}>{bar.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function profileName(p: { first_name: string | null; family_name: string | null } | undefined) {
  if (!p) return '–'
  return `${p.first_name ?? ''} ${p.family_name ?? ''}`.trim() || '–'
}

const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_ADMIN_BYPASS === 'true'

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(!DEV_BYPASS)

  useEffect(() => {
    if (DEV_BYPASS) return
    if (loading) return
    if (!user) { navigate('/login', { replace: true }); return }
    dbService.getUserProfile(user.id).then(({ data }) => {
      if (data?.role !== 'admin') navigate('/', { replace: true })
      else setChecking(false)
    })
  }, [user, loading, navigate])

  if (loading || checking) return null
  return <>{children}</>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-card__label">{label}</div>
      <div className="admin-stat-card__value">{value}</div>
      {sub && <div className="admin-stat-card__sub">{sub}</div>}
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)

  useEffect(() => {
    dbService.getAdminStats().then(data => { setStats(data); setLoading(false) })
  }, [])

  useEffect(() => {
    return presenceService.subscribeOnlineCount('drivers-online', setOnlineCount)
  }, [])

  if (loading) return <div className="admin-loading">Lade Statistiken…</div>
  if (!stats) return <div className="admin-error">Statistiken konnten nicht geladen werden.</div>

  return (
    <div className="admin-stats-grid">
      <StatCard label="Fahrten heute" value={stats.rides_today} />
      <StatCard label="Fahrer online" value={onlineCount ?? '…'} sub="gerade aktiv in der App" />
      <StatCard label="Nicht deaktiviert" value={stats.active_drivers} sub="Fahrer-Konten" />
      <StatCard
        label="Ø Fahrtdauer"
        value={stats.avg_duration_minutes > 0 ? formatDuration(stats.avg_duration_minutes) : '–'}
        sub={stats.avg_duration_minutes > 0 ? 'aller abgeschl. Fahrten' : 'Keine Daten'}
      />
    </div>
  )
}

type SortCol = 'status' | 'driver' | 'guest' | 'pickup' | 'destination' | 'price' | 'created_at' | 'completed_at'
type SortDir = 'asc' | 'desc'

function RideList() {
  const [rides, setRides] = useState<Ride[]>([])
  const [profiles, setProfiles] = useState<Record<string, { first_name: string | null; family_name: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [driverSearch, setDriverSearch] = useState('')
  const [guestSearch, setGuestSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    dbService.getAllRides().then(async data => {
      setRides(data)
      const ids = [...new Set(data.flatMap(r => [r.driver_id, r.guest_id]).filter(Boolean))]
      if (ids.length) {
        const ps = await dbService.getUserProfiles(ids)
        const map: Record<string, { first_name: string | null; family_name: string | null }> = {}
        ps.forEach(p => { map[p.user_id] = p })
        setProfiles(map)
      }
      setLoading(false)
    })
  }, [])

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortIcon = (col: SortCol) => {
    if (sortCol !== col) return <span className="admin-sort-icon admin-sort-icon--idle">↕</span>
    return <span className="admin-sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = useMemo(() => {
    const list = rides.filter(ride => {
      if (statusFilter !== 'all' && ride.status !== statusFilter) return false
      if (driverSearch && !profileName(profiles[ride.driver_id]).toLowerCase().includes(driverSearch.toLowerCase())) return false
      if (guestSearch && !profileName(profiles[ride.guest_id]).toLowerCase().includes(guestSearch.toLowerCase())) return false
      return true
    })

    list.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortCol === 'status')       { av = a.status;                         bv = b.status }
      else if (sortCol === 'driver')  { av = profileName(profiles[a.driver_id]); bv = profileName(profiles[b.driver_id]) }
      else if (sortCol === 'guest')   { av = profileName(profiles[a.guest_id]);  bv = profileName(profiles[b.guest_id]) }
      else if (sortCol === 'pickup')  { av = a.pickup_location ?? '';           bv = b.pickup_location ?? '' }
      else if (sortCol === 'destination') { av = a.destination ?? '';           bv = b.destination ?? '' }
      else if (sortCol === 'price')   { av = a.price_eur ?? -1;                bv = b.price_eur ?? -1 }
      else if (sortCol === 'created_at')  { av = a.created_at;                 bv = b.created_at }
      else if (sortCol === 'completed_at') { av = a.completed_at ?? '';        bv = b.completed_at ?? '' }

      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [rides, statusFilter, driverSearch, guestSearch, profiles, sortCol, sortDir])

  if (loading) return <div className="admin-loading">Lade Fahrten…</div>

  return (
    <div className="admin-rides">
      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Alle Status</option>
          <option value="pending">Unterwegs</option>
          <option value="picked_up">Aufgenommen</option>
          <option value="active">Aktiv</option>
          <option value="completed">Abgeschlossen</option>
        </select>
        <input className="admin-input" placeholder="Fahrer suchen…" value={driverSearch} onChange={e => setDriverSearch(e.target.value)} />
        <input className="admin-input" placeholder="Fahrgast suchen…" value={guestSearch} onChange={e => setGuestSearch(e.target.value)} />
        <span className="admin-filter-bar__count">{filtered.length} Fahrten</span>
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">Keine Fahrten gefunden.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('status')}     className="admin-th--sortable">Status {sortIcon('status')}</th>
                <th onClick={() => handleSort('driver')}     className="admin-th--sortable">Fahrer {sortIcon('driver')}</th>
                <th onClick={() => handleSort('guest')}      className="admin-th--sortable">Fahrgast {sortIcon('guest')}</th>
                <th onClick={() => handleSort('pickup')}     className="admin-th--sortable">Abholung {sortIcon('pickup')}</th>
                <th onClick={() => handleSort('destination')} className="admin-th--sortable">Ziel {sortIcon('destination')}</th>
                <th onClick={() => handleSort('price')}      className="admin-th--sortable">Preis {sortIcon('price')}</th>
                <th onClick={() => handleSort('created_at')} className="admin-th--sortable">Start {sortIcon('created_at')}</th>
                <th onClick={() => handleSort('completed_at')} className="admin-th--sortable">Ende {sortIcon('completed_at')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ride => (
                <tr key={ride.id}>
                  <td data-label="Status">
                    <span className={`admin-badge admin-badge--${ride.status}`}>
                      {STATUS_LABELS[ride.status] ?? ride.status}
                    </span>
                  </td>
                  <td data-label="Fahrer">{profileName(profiles[ride.driver_id])}</td>
                  <td data-label="Fahrgast">{profileName(profiles[ride.guest_id])}</td>
                  <td data-label="Abholung" className="admin-table__location">{ride.pickup_location ?? '–'}</td>
                  <td data-label="Ziel" className="admin-table__location">{ride.destination ?? '–'}</td>
                  <td data-label="Preis">{ride.price_eur != null ? `${ride.price_eur.toFixed(2)} €` : '–'}</td>
                  <td data-label="Start" className="admin-table__time">{formatDateTime(ride.created_at)}</td>
                  <td data-label="Ende" className="admin-table__time">{ride.completed_at ? formatDateTime(ride.completed_at) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type DriverActivityStatus = 'active' | 'inactive' | 'deactivated'

function driverActivityStatus(driver: UserProfile): DriverActivityStatus {
  if (!driver.currently_working) return 'deactivated'
  if (!driver.last_ride_at) {
    const days = (Date.now() - new Date(driver.created_at).getTime()) / 86_400_000
    return days > 30 ? 'inactive' : 'active'
  }
  const days = (Date.now() - new Date(driver.last_ride_at).getTime()) / 86_400_000
  return days <= 30 ? 'active' : 'inactive'
}

function DriverStatusBadge({ driver }: { driver: UserProfile }) {
  const s = driverActivityStatus(driver)
  if (s === 'deactivated') return <span className="admin-badge admin-badge--deactivated">✕ Konto deaktiviert</span>
  if (s === 'active')      return <span className="admin-badge admin-badge--active">● Aktiv</span>
  return                          <span className="admin-badge admin-badge--inactive">○ Inaktiv</span>
}

function DriverDetailCard({ driver, onClose, onToggled }: {
  driver: UserProfile
  onClose: () => void
  onToggled: (userId: string, working: boolean) => void
}) {
  const [rides, setRides] = useState<Ride[]>([])
  const [reviews, setReviews] = useState<Array<{ stars: number }>>([])
  const [guestProfiles, setGuestProfiles] = useState<Record<string, { first_name: string | null; family_name: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [working, setWorking] = useState(driver.currently_working)
  const [view, setView] = useState<null | 'earnings' | 'rides' | 'ride-detail'>(null)
  const [rideSearch, setRideSearch] = useState('')
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)

  useEffect(() => {
    Promise.all([
      dbService.getAdminDriverRides(driver.user_id),
      dbService.getReviews(driver.user_id),
    ]).then(async ([r, rev]) => {
      setRides(r)
      setReviews(rev)
      const guestIds = [...new Set(r.map(ride => ride.guest_id).filter(Boolean))]
      if (guestIds.length) {
        const ps = await dbService.getUserProfiles(guestIds)
        const map: Record<string, { first_name: string | null; family_name: string | null }> = {}
        ps.forEach(p => { map[p.user_id] = p })
        setGuestProfiles(map)
      }
      setLoading(false)
    })
  }, [driver.user_id])

  const handleToggle = async () => {
    setToggling(true)
    const next = !working
    const { error } = await dbService.setDriverWorking(driver.user_id, next)
    if (!error) { setWorking(next); onToggled(driver.user_id, next) }
    setToggling(false)
  }

  const handleBack = () => {
    if (view === 'ride-detail') { setSelectedRide(null); setView('rides') }
    else setView(null)
  }

  const openRide = (ride: Ride) => { setSelectedRide(ride); setView('ride-detail') }

  const totalEarnings = Math.round(rides.reduce((s, r) => s + (r.price_eur ?? 0), 0) * 100) / 100
  const avgStars = reviews.length > 0 ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0
  const monthly = useMemo(() => buildMonthlyData(rides), [rides])

  const filteredRides = useMemo(() => {
    const q = rideSearch.trim().toLowerCase()
    const list = q
      ? rides.filter(r =>
          profileName(guestProfiles[r.guest_id]).toLowerCase().includes(q) ||
          (r.pickup_location ?? '').toLowerCase().includes(q) ||
          (r.destination ?? '').toLowerCase().includes(q)
        )
      : rides
    return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [rides, rideSearch, guestProfiles])

  const initials = `${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonth = monthly.find(m => m.key === currentMonthKey)
  const ridesWithPrice = rides.filter(r => r.price_eur)
  const avgPerRide = ridesWithPrice.length > 0 ? totalEarnings / ridesWithPrice.length : 0

  const isWide = view === 'rides' || view === 'ride-detail'

  return (
    <div className="admin-detail-backdrop" onClick={onClose}>
      <div className={`admin-detail-card${isWide ? ' admin-detail-card--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="admin-detail-card__handle" />

        {view !== null && (
          <button className="admin-detail-back" onClick={handleBack}>← Zurück</button>
        )}

        {/* ── Main view ── */}
        {view === null && (
          <>
            <div className="admin-detail-header">
              <div className="admin-detail-avatar">{initials}</div>
              <div className="admin-detail-header__info">
                <div className="admin-detail-header__name">{profileName(driver)}</div>
                {driver.email && <div className="admin-detail-header__email">{driver.email}</div>}
                <div className="admin-detail-header__date">
                  Registriert seit {new Date(driver.created_at).toLocaleDateString('de-DE')}
                </div>
              </div>
            </div>

            <div className="admin-detail-status-row">
              <DriverStatusBadge driver={{ ...driver, currently_working: working }} />
              <button
                className={`admin-toggle-btn ${working ? 'admin-toggle-btn--deactivate' : 'admin-toggle-btn--activate'}`}
                onClick={handleToggle}
                disabled={toggling}
              >
                {toggling ? '…' : working ? 'Konto deaktivieren' : 'Konto aktivieren'}
              </button>
            </div>

            <div className="admin-detail-stats">
              <div className="admin-detail-stat admin-detail-stat--clickable" onClick={() => setView('rides')}>
                <div className="admin-detail-stat__label">Abgeschlossene Fahrten</div>
                <div className="admin-detail-stat__value">{loading ? '…' : rides.length}</div>
                <div className="admin-detail-stat__hint">Alle anzeigen →</div>
              </div>
              <div className="admin-detail-stat admin-detail-stat--clickable" onClick={() => setView('earnings')}>
                <div className="admin-detail-stat__label">Gesamteinnahmen</div>
                <div className="admin-detail-stat__value">
                  {loading ? '…' : totalEarnings > 0 ? formatEur(totalEarnings) : '–'}
                </div>
                <div className="admin-detail-stat__hint">Aufschlüsselung →</div>
              </div>
              <div className="admin-detail-stat admin-detail-stat--full">
                <div className="admin-detail-stat__label">Bewertung</div>
                <div className="admin-detail-stat__value">
                  {loading ? '…' : reviews.length > 0
                    ? <StarDisplay value={avgStars} count={reviews.length} />
                    : <span className="admin-detail-stat__empty">Noch keine Bewertungen</span>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Earnings sub-view ── */}
        {view === 'earnings' && (
          <>
            <h3 className="admin-detail-sub-title">Einnahmen — {profileName(driver)}</h3>

            <div className="admin-detail-ein-summary">
              <div className="admin-detail-ein-card">
                <div className="admin-detail-stat__label">Gesamt</div>
                <div className="admin-detail-stat__value">{formatEur(totalEarnings)}</div>
              </div>
              <div className="admin-detail-ein-card">
                <div className="admin-detail-stat__label">Dieser Monat</div>
                <div className="admin-detail-stat__value ein-accent">{formatEur(currentMonth?.amount ?? 0)}</div>
              </div>
              <div className="admin-detail-ein-card">
                <div className="admin-detail-stat__label">Ø pro Fahrt</div>
                <div className="admin-detail-stat__value">
                  {ridesWithPrice.length > 0 ? formatEur(Math.round(avgPerRide * 100) / 100) : '–'}
                </div>
              </div>
            </div>

            <div className="ein-chart-section" style={{ marginTop: '1rem' }}>
              <h2 className="ein-section-title">Letzte 12 Monate</h2>
              <BarChart data={monthly} />
            </div>

            <div className="ein-list-section" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <h2 className="ein-section-title">Monatsübersicht</h2>
              <div className="ein-list">
                {[...monthly].reverse().map(bar => (
                  <div key={bar.key} className={`ein-list-row${bar.isCurrent ? ' ein-list-row--current' : ''}`}>
                    <div className="ein-list-row__month">
                      {MONTHS_DE[bar.month]} {bar.year}
                      {bar.isCurrent && <span className="ein-list-row__badge">Aktuell</span>}
                    </div>
                    <div className="ein-list-row__rides">
                      {bar.rides > 0 ? `${bar.rides} ${bar.rides === 1 ? 'Fahrt' : 'Fahrten'}` : '–'}
                    </div>
                    <div className={`ein-list-row__amount${bar.amount > 0 ? ' ein-accent' : ''}`}>
                      {bar.amount > 0 ? formatEur(bar.amount) : '–'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Rides sub-view ── */}
        {view === 'rides' && (
          <>
            <h3 className="admin-detail-sub-title">Fahrten — {profileName(driver)}</h3>

            <div className="admin-detail-search-row">
              <input
                className="admin-input"
                placeholder="Fahrgast, Abholung oder Ziel…"
                value={rideSearch}
                onChange={e => setRideSearch(e.target.value)}
              />
              <span className="admin-filter-bar__count">{filteredRides.length} Fahrten</span>
            </div>

            {filteredRides.length === 0 ? (
              <p className="admin-empty" style={{ padding: '2rem 0' }}>Keine Fahrten gefunden.</p>
            ) : (
              <div className="admin-ride-list">
                {filteredRides.map(ride => (
                  <div key={ride.id} className="admin-ride-item admin-ride-item--clickable" onClick={() => openRide(ride)}>
                    <div className="admin-ride-item__main">
                      <span className="admin-ride-item__guest">
                        {profileName(guestProfiles[ride.guest_id])}
                      </span>
                      <span className="admin-ride-item__date">{formatDateTime(ride.created_at)}</span>
                    </div>
                    <div className="admin-ride-item__meta">
                      <span className="admin-ride-item__route-hint">
                        {ride.pickup_location && ride.destination
                          ? `${ride.pickup_location} → ${ride.destination}`
                          : ride.pickup_location ?? ride.destination ?? '–'}
                      </span>
                      {ride.price_eur != null && (
                        <span className="admin-ride-item__price">{formatEur(ride.price_eur)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Ride detail sub-view ── */}
        {view === 'ride-detail' && selectedRide && (
          <>
            <div className="admin-ride-detail__header">
              <span className={`admin-badge admin-badge--${selectedRide.status}`}>
                {STATUS_LABELS[selectedRide.status] ?? selectedRide.status}
              </span>
              <span className="admin-ride-detail__ts">{formatDateTime(selectedRide.created_at)}</span>
            </div>

            <div className="admin-ride-detail__grid">
              <div className="admin-ride-detail__field admin-ride-detail__field--full">
                <div className="admin-ride-detail__label">Fahrgast</div>
                <div className="admin-ride-detail__value admin-ride-detail__value--name">
                  {profileName(guestProfiles[selectedRide.guest_id])}
                </div>
              </div>
              <div className="admin-ride-detail__field admin-ride-detail__field--full">
                <div className="admin-ride-detail__label">Abholung</div>
                <div className="admin-ride-detail__value">{selectedRide.pickup_location ?? '–'}</div>
              </div>
              <div className="admin-ride-detail__field admin-ride-detail__field--full">
                <div className="admin-ride-detail__label">Ziel</div>
                <div className="admin-ride-detail__value">{selectedRide.destination ?? '–'}</div>
              </div>
              <div className="admin-ride-detail__field">
                <div className="admin-ride-detail__label">Preis</div>
                <div className="admin-ride-detail__value admin-ride-detail__value--accent">
                  {selectedRide.price_eur != null ? formatEur(selectedRide.price_eur) : '–'}
                </div>
              </div>
              <div className="admin-ride-detail__field">
                <div className="admin-ride-detail__label">Dauer</div>
                <div className="admin-ride-detail__value">
                  {selectedRide.completed_at
                    ? formatDuration((new Date(selectedRide.completed_at).getTime() - new Date(selectedRide.created_at).getTime()) / 60000)
                    : '–'}
                </div>
              </div>
              <div className="admin-ride-detail__field">
                <div className="admin-ride-detail__label">Startzeit</div>
                <div className="admin-ride-detail__value admin-ride-detail__value--sm">
                  {formatDateTime(selectedRide.created_at)}
                </div>
              </div>
              <div className="admin-ride-detail__field">
                <div className="admin-ride-detail__label">Endzeit</div>
                <div className="admin-ride-detail__value admin-ride-detail__value--sm">
                  {selectedRide.completed_at ? formatDateTime(selectedRide.completed_at) : '–'}
                </div>
              </div>
            </div>
          </>
        )}

        <button className="admin-detail-close" onClick={onClose}>Schließen</button>
      </div>
    </div>
  )
}

function DriverList() {
  const [drivers, setDrivers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDriver, setSelectedDriver] = useState<UserProfile | null>(null)

  useEffect(() => {
    dbService.getAllDrivers().then(data => { setDrivers(data); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return drivers
    const q = search.toLowerCase()
    return drivers.filter(d =>
      profileName(d).toLowerCase().includes(q) ||
      (d.email ?? '').toLowerCase().includes(q)
    )
  }, [drivers, search])

  const handleToggled = (userId: string, working: boolean) => {
    setDrivers(prev => prev.map(d => d.user_id === userId ? { ...d, currently_working: working } : d))
    setSelectedDriver(prev => prev?.user_id === userId ? { ...prev, currently_working: working } : prev)
  }

  if (loading) return <div className="admin-loading">Lade Fahrer…</div>
  if (drivers.length === 0) return <p className="admin-empty">Keine Fahrer registriert.</p>

  return (
    <>
      <div className="admin-filter-bar" style={{ marginBottom: '1rem' }}>
        <input
          className="admin-input"
          style={{ flex: 1 }}
          placeholder="Nach Name oder E-Mail suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="admin-filter-bar__count">{filtered.length} Fahrer</span>
      </div>

      {filtered.length === 0
        ? <p className="admin-empty">Keine Fahrer gefunden.</p>
        : (
          <div className="admin-driver-list">
            {filtered.map(driver => (
              <div key={driver.user_id} className="admin-driver-row">
                <div className="admin-driver-row__avatar">
                  {`${driver.first_name?.[0] ?? ''}${driver.family_name?.[0] ?? ''}`.toUpperCase() || '?'}
                </div>
                <div className="admin-driver-row__info">
                  <div className="admin-driver-row__name">{profileName(driver)}</div>
                  <div className="admin-driver-row__meta">
                    {driver.email ?? `Registriert seit ${new Date(driver.created_at).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                <div className="admin-driver-row__status">
                  <DriverStatusBadge driver={driver} />
                </div>
                <button className="admin-toggle-btn admin-toggle-btn--details" onClick={() => setSelectedDriver(driver)}>
                  Details
                </button>
              </div>
            ))}
          </div>
        )
      }

      {selectedDriver && (
        <DriverDetailCard
          driver={selectedDriver}
          onClose={() => setSelectedDriver(null)}
          onToggled={handleToggled}
        />
      )}
    </>
  )
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-header">
          <h1 className="admin-header__title">Admin</h1>
          <p className="admin-header__sub">Betriebsübersicht</p>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab${tab === 'dashboard' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`admin-tab${tab === 'rides' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('rides')}
          >
            Fahrten
          </button>
          <button
            className={`admin-tab${tab === 'drivers' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('drivers')}
          >
            Fahrer
          </button>
        </div>

        <div className="admin-content">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'rides' && <RideList />}
          {tab === 'drivers' && <DriverList />}
        </div>
      </div>
    </AdminRoute>
  )
}
