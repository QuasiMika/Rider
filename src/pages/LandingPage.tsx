import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { dbService } from '../services'
import './LandingPage.css'

type PublicStats = {
  total_users: number
  completed_rides: number
  total_distance_km: number
}

const fmt = (n: number) => new Intl.NumberFormat('de-DE').format(Math.round(n))

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<PublicStats | null>(null)

  useEffect(() => {
    dbService.getPublicStats().then(data => { if (data) setStats(data) })
  }, [])

  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-hero__badge">🌊 Konstanz am Bodensee</div>
          <h1 className="lp-hero__title">
            Dein Rikscha-<br />Service in<br />Konstanz.
          </h1>
          <p className="lp-hero__sub">
            Vom Bahnhof in die Altstadt, zur Uni oder ans Ufer —
            lokal, emissionsfrei und mit einem Lächeln gefahren.
          </p>
          <div className="lp-hero__cta">
            {user ? (
              <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={() => navigate('/ride')}>
                Jetzt einsteigen →
              </button>
            ) : (
              <>
                <Link to="/register">
                  <button className="lp-btn lp-btn--primary lp-btn--lg">Kostenlos starten</button>
                </Link>
                <Link to="/login">
                  <button className="lp-btn lp-btn--ghost lp-btn--lg">Anmelden</button>
                </Link>
              </>
            )}
            <Link to="/help" className="lp-help-link">Häufige Fragen →</Link>
          </div>
        </div>

        <div className="lp-hero__visual" aria-hidden="true">
          <div className="lp-hero__circle lp-hero__circle--1" />
          <div className="lp-hero__circle lp-hero__circle--2" />
          <span className="lp-hero__emoji">🛺</span>
        </div>
      </section>

      <section className="lp-stats">
        <div className="lp-stats__item">
          <span className="lp-stats__value">
            {stats ? fmt(stats.total_users) : '—'}
          </span>
          <span className="lp-stats__label">Nutzer in Konstanz</span>
        </div>
        <div className="lp-stats__sep" aria-hidden="true" />
        <div className="lp-stats__item">
          <span className="lp-stats__value">
            {stats ? fmt(stats.completed_rides) : '—'}
          </span>
          <span className="lp-stats__label">Fahrten</span>
        </div>
        <div className="lp-stats__sep" aria-hidden="true" />
        <div className="lp-stats__item">
          <span className="lp-stats__value">
            {stats ? `${fmt(stats.total_distance_km)} km` : '—'}
          </span>
          <span className="lp-stats__label">emissionsfrei gefahren</span>
        </div>
      </section>

      <section className="lp-features">
        <h2 className="lp-features__title">Warum Konstanz Rider liebt</h2>
        <div className="lp-features__grid">
          <div className="lp-card">
            <div className="lp-card__icon">🛺</div>
            <h3>Durch die Altstadt</h3>
            <p>Enge Gassen, kein Parkplatzstress — dein Fahrer kennt jeden Winkel der Konstanzer Innenstadt.</p>
          </div>
          <div className="lp-card">
            <div className="lp-card__icon">🎓</div>
            <h3>Zur Uni & zurück</h3>
            <p>Vom Bahnhof auf den Uni-Berg und wieder runter — entspannt, ohne auf den Bus zu warten.</p>
          </div>
          <div className="lp-card">
            <div className="lp-card__icon">🌊</div>
            <h3>100 % emissionsfrei</h3>
            <p>Für den Bodensee und die Stadt — keine Abgase, kein Lärm, nur frische Seeluft.</p>
          </div>
          <div className="lp-card">
            <div className="lp-card__icon">🇨🇭</div>
            <h3>Bis nach Kreuzlingen</h3>
            <p>Grenzgänger willkommen — wir fahren auch rüber auf die Schweizer Seite.</p>
          </div>
        </div>
      </section>

      <section className="lp-reviews">
        <h2 className="lp-reviews__title">Was unsere Fahrgäste sagen</h2>
        <div className="lp-reviews__grid">
          <figure className="lp-review">
            <div className="lp-review__stars">★★★★★</div>
            <blockquote className="lp-review__text">
              „Ich fahre seit Jahren mit dem Bus, aber Rider ist einfach eine andere Welt. Der Fahrer hat mir sogar geholfen, meine Einkaufstüten zu tragen. So einen Service findet man heute kaum noch."
            </blockquote>
            <figcaption className="lp-review__author">
              <span className="lp-review__name">Hildegard M.</span>
              <span className="lp-review__meta">72 Jahre · Konstanz Altstadt</span>
            </figcaption>
          </figure>

          <figure className="lp-review">
            <div className="lp-review__stars">★★★★★</div>
            <blockquote className="lp-review__text">
              „Nach meiner Hüft-OP war ich froh, nicht mehr auf den steilen Weg zur Uni angewiesen zu sein. Rider hat mir echte Unabhängigkeit zurückgegeben. Meine Tochter hat die App eingerichtet — kinderleicht."
            </blockquote>
            <figcaption className="lp-review__author">
              <span className="lp-review__name">Werner K.</span>
              <span className="lp-review__meta">68 Jahre · Petershausen</span>
            </figcaption>
          </figure>

          <figure className="lp-review">
            <div className="lp-review__stars">★★★★★</div>
            <blockquote className="lp-review__text">
              „Endlich mal wieder entspannt zum Wochenmarkt am Hafen, ohne Parkplatzsuche. Die Rikscha ist schneller als gedacht und der junge Fahrer war ausgesprochen höflich. Ich komme wieder!"
            </blockquote>
            <figcaption className="lp-review__author">
              <span className="lp-review__name">Gertraud S.</span>
              <span className="lp-review__meta">74 Jahre · Fürstenberg</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="lp-cta">
        <h2>Bereit für deine erste Fahrt?</h2>
        <p>Melde dich an und buche in unter einer Minute.</p>
        {user ? (
          <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={() => navigate('/ride')} style={{ marginTop: '1.75rem' }}>
            Zur App →
          </button>
        ) : (
          <Link to="/register">
            <button className="lp-btn lp-btn--primary lp-btn--lg" style={{ marginTop: '1.75rem' }}>
              Jetzt kostenlos registrieren
            </button>
          </Link>
        )}
      </section>
    </div>
  )
}
