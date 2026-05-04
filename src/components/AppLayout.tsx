import { useEffect, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useTheme } from '../hooks/useTheme'
import { dbService } from '../services'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHouse,
  faUser,
  faGear,
  faSun,
  faMoon,
  faRightFromBracket,
  faCar,
  faChartBar,
} from '@fortawesome/free-solid-svg-icons'
import '../pages/LandingPage.css'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isDriver, setIsDriver] = useState(false)

  useEffect(() => {
    if (!user) { setIsDriver(false); return }
    dbService.getUserProfile(user.id).then(({ data }) => setIsDriver(data?.role === 'driver'))
  }, [user])

  useEffect(() => {
    document.documentElement.classList.add('is-landing')
    return () => document.documentElement.classList.remove('is-landing')
  }, [])

  const handleSignOut = async () => {
    setSettingsOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <nav className="lp-nav">
        <Link to={user ? '/ride' : '/'} className="lp-nav__logo" style={{ textDecoration: 'none' }}>Rider</Link>
        <div className="lp-nav__actions">
          <button className="lp-theme-btn" onClick={toggle} aria-label="Theme wechseln">
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          </button>
          {user ? (
            <>
              {isDriver && (
                <Link to="/einnahmen">
                  <button className="lp-btn lp-btn--ghost">Einnahmen</button>
                </Link>
              )}
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

      <footer className="lp-footer lp-footer--desktop">
        <span className="lp-footer__logo">Rider</span>
        <span>© {new Date().getFullYear()} Rider. Alle Rechte vorbehalten.</span>
        <Link to="/impressum" className="lp-footer__link">Impressum</Link>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" aria-label="Navigation">
        {user ? (
          <>
            <NavLink
              to="/ride"
              className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            >
              <span className="bottom-nav__icon"><FontAwesomeIcon icon={faCar} /></span>
              <span className="bottom-nav__label">Fahrt</span>
            </NavLink>
            {isDriver && (
              <NavLink
                to="/einnahmen"
                className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
              >
                <span className="bottom-nav__icon"><FontAwesomeIcon icon={faChartBar} /></span>
                <span className="bottom-nav__label">Einnahmen</span>
              </NavLink>
            )}
            <NavLink
              to="/profil"
              className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            >
              <span className="bottom-nav__icon"><FontAwesomeIcon icon={faUser} /></span>
              <span className="bottom-nav__label">Profil</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            >
              <span className="bottom-nav__icon"><FontAwesomeIcon icon={faHouse} /></span>
              <span className="bottom-nav__label">Start</span>
            </NavLink>
            <NavLink
              to="/login"
              className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            >
              <span className="bottom-nav__icon"><FontAwesomeIcon icon={faUser} /></span>
              <span className="bottom-nav__label">Anmelden</span>
            </NavLink>
          </>
        )}
        <button className="bottom-nav__item" onClick={() => setSettingsOpen(true)}>
          <span className="bottom-nav__icon"><FontAwesomeIcon icon={faGear} /></span>
          <span className="bottom-nav__label">Einstellungen</span>
        </button>
      </nav>

      {/* Settings bottom sheet */}
      {settingsOpen && (
        <div className="nav-settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="nav-settings-sheet" onClick={e => e.stopPropagation()}>
            <div className="nav-settings-sheet__handle" />
            <button
              className="nav-settings-item"
              onClick={() => { toggle(); setSettingsOpen(false) }}
            >
              <span className="nav-settings-item__icon"><FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} /></span>
              {theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            </button>
            {user && (
              <button className="nav-settings-item nav-settings-item--danger" onClick={handleSignOut}>
                <span className="nav-settings-item__icon"><FontAwesomeIcon icon={faRightFromBracket} /></span>
                Abmelden
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
