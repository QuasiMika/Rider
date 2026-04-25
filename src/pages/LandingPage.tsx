import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import './LandingPage.css'

export default function LandingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="lp">
      <section className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-hero__badge">🌿 Nachhaltig in der Stadt unterwegs</div>
          <h1 className="lp-hero__title">
            Die neue Art,<br />die Stadt zu<br />erleben.
          </h1>
          <p className="lp-hero__sub">
            Rikschas und Tandems auf Abruf — lokal, emissionsfrei
            und mit einem Lächeln gefahren.
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
          </div>
        </div>

        <div className="lp-hero__visual" aria-hidden="true">
          <div className="lp-hero__circle lp-hero__circle--1" />
          <div className="lp-hero__circle lp-hero__circle--2" />
          <span className="lp-hero__emoji">🛺</span>
        </div>
      </section>

      <section className="lp-features">
        <h2 className="lp-features__title">Wie Rider funktioniert</h2>
        <div className="lp-features__grid">
          <div className="lp-card">
            <div className="lp-card__icon">🛺</div>
            <h3>Rikscha</h3>
            <p>Bequem durch die Altstadt – dein Fahrer kennt jede Gasse und jede Abkürzung.</p>
          </div>
          <div className="lp-card">
            <div className="lp-card__icon">🚴</div>
            <h3>Fahrrad für zwei</h3>
            <p>Zu zweit unterwegs? Unsere Tandems bringen euch entspannt und gemeinsam ans Ziel.</p>
          </div>
          <div className="lp-card">
            <div className="lp-card__icon">🌿</div>
            <h3>100 % emissionsfrei</h3>
            <p>Keine Abgase, kein Lärm – nur du, dein Fahrer und die Straße vor euch.</p>
          </div>
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
