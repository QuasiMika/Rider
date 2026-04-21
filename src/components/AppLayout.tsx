import { useEffect } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useTheme } from '../hooks/useTheme'
import '../pages/LandingPage.css'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.add('is-landing')
    return () => document.documentElement.classList.remove('is-landing')
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <nav className="lp-nav">
        <Link to="/" className="lp-nav__logo" style={{ textDecoration: 'none' }}>Rider</Link>
        <div className="lp-nav__actions">
          <button className="lp-theme-btn" onClick={toggle} aria-label="Theme wechseln">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {user ? (
            <>
              <Link to="/ride">
                <button className="lp-btn lp-btn--ghost">Fahrt buchen</button>
              </Link>
              <Link to="/profil">
                <button className="lp-btn lp-btn--ghost">Profil</button>
              </Link>
              <button className="lp-btn lp-btn--outline" onClick={handleSignOut}>
                Abmelden
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="lp-btn lp-btn--ghost">Anmelden</button>
              </Link>
              <Link to="/register">
                <button className="lp-btn lp-btn--primary">Registrieren</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="app-shell__main">
        <Outlet />
      </main>

      <footer className="lp-footer">
        <span className="lp-footer__logo">Rider</span>
        <span>© {new Date().getFullYear()} Rider. Alle Rechte vorbehalten.</span>
      </footer>
    </div>
  )
}
