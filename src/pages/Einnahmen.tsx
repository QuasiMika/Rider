import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthUser'
import { dbService } from '../services'
import type { Ride } from '../types/ride'
import './Profil.css'
import './Einnahmen.css'

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

type MonthBar = {
  key: string
  label: string
  year: number
  month: number
  amount: number
  rides: number
  isCurrent: boolean
}

function buildMonthlyData(rides: Ride[]): MonthBar[] {
  const now = new Date()
  const bars: MonthBar[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    bars.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS_DE[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth(),
      amount: 0,
      rides: 0,
      isCurrent: i === 0,
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

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
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
                    {formatEur(bar.amount)}<br />
                    {bar.rides} {bar.rides === 1 ? 'Fahrt' : 'Fahrten'}
                  </span>
                )}
              </div>
            </div>
            <span className={`ein-chart__label${bar.isCurrent ? ' ein-chart__label--current' : ''}`}>
              {bar.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Einnahmen() {
  const { user } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [isDriver, setIsDriver] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    dbService.getUserProfile(user.id).then(({ data }) => {
      if (data?.role !== 'driver') { setIsDriver(false); setLoading(false); return }
      setIsDriver(true)
      dbService.getCompletedRides(user.id, 'driver_id').then(r => {
        setRides(r)
        setLoading(false)
      })
    })
  }, [user])

  const monthly = useMemo(() => buildMonthlyData(rides), [rides])

  const ridesWithPrice = rides.filter(r => r.price_eur)
  const totalIncome = ridesWithPrice.reduce((s, r) => s + (r.price_eur ?? 0), 0)
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonth = monthly.find(m => m.key === currentMonthKey)
  const avgPerRide = ridesWithPrice.length > 0 ? totalIncome / ridesWithPrice.length : 0

  if (loading) return <div className="profil" />

  if (isDriver === false) return (
    <div className="profil">
      <p className="profil-muted" style={{ padding: '6rem 2rem' }}>
        Diese Seite ist nur für Fahrer verfügbar.
      </p>
    </div>
  )

  return (
    <div className="profil">
      <section className="profil-hero ein-hero">
        <div className="profil-hero__inner">
          <div className="ein-hero__icon">€</div>
          <div className="profil-hero__info">
            <h1 className="profil-hero__name">Einnahmen</h1>
            <p className="ein-hero__sub">Deine monatlichen Einnahmen als Fahrer</p>
          </div>
        </div>
      </section>

      <section className="profil-content">
        <div className="profil-grid ein-summary">
          <div className="profil-card">
            <div className="profil-card__label">Gesamt</div>
            <div className="profil-card__value">{formatEur(Math.round(totalIncome * 100) / 100)}</div>
          </div>
          <div className="profil-card">
            <div className="profil-card__label">Dieser Monat</div>
            <div className="profil-card__value ein-accent">{formatEur(currentMonth?.amount ?? 0)}</div>
          </div>
          <div className="profil-card">
            <div className="profil-card__label">Fahrten gesamt</div>
            <div className="profil-card__value">{rides.length}</div>
          </div>
          <div className="profil-card">
            <div className="profil-card__label">Ø pro Fahrt</div>
            <div className="profil-card__value">{ridesWithPrice.length > 0 ? formatEur(Math.round(avgPerRide * 100) / 100) : '–'}</div>
          </div>
        </div>

        <div className="ein-chart-section">
          <h2 className="ein-section-title">Letzte 12 Monate</h2>
          <BarChart data={monthly} />
        </div>

        <div className="ein-list-section">
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
      </section>
    </div>
  )
}
