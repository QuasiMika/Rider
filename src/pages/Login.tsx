import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEnvelope,
  faLock,
  faUser,
  faCar,
  faBicycle,
} from '@fortawesome/free-solid-svg-icons'
import './Login.css'

type Mode = 'login' | 'register'
type Role = 'customer' | 'driver'

interface Props { initialMode?: Mode }

export default function AuthPage({ initialMode = 'login' }: Props) {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>(initialMode)

  // login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // register extra fields
  const [firstName, setFirstName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [role, setRole] = useState<Role>('customer')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, navigate, from])

  // reset form + error when switching mode
  const switchMode = (next: Mode) => {
    setError(null)
    setEmail('')
    setPassword('')
    setFirstName('')
    setFamilyName('')
    setMode(next)
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) { setError(error); setLoading(false) }
    } else {
      if (password.length < 6) {
        setError('Passwort muss mindestens 6 Zeichen lang sein.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, firstName, familyName, role)
      if (error) { setError(error); setLoading(false) }
    }
  }

  return (
    <div className="login">
      <div className="login__left">
        <div className="login__brand">
          <span className="login__emoji">🛺</span>
          <h2>{mode === 'login' ? 'Willkommen zurück!' : 'Werde Teil von Rider'}</h2>
          <p>
            {mode === 'login'
              ? 'Melde dich an und buche deine nächste Fahrt mit Rider.'
              : 'Registriere dich kostenlos und starte sofort mit deiner ersten Fahrt.'}
          </p>
        </div>
        <ul className="login__features">
          <li><span className="login__feature-icon">🌿</span> 100 % emissionsfrei unterwegs</li>
          <li><span className="login__feature-icon">⚡</span> Fahrer in Sekunden gefunden</li>
          <li><span className="login__feature-icon">🤝</span> Lokale Fahrer, echte Verbindungen</li>
        </ul>
      </div>

      <div className="login__right">
        <div className="login__card">
          {/* Mobile tab switcher */}
          <div className="login__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`login__tab${mode === 'login' ? ' login__tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >Anmelden</button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={`login__tab${mode === 'register' ? ' login__tab--active' : ''}`}
              onClick={() => switchMode('register')}
            >Registrieren</button>
          </div>

          {/* Desktop heading + switch link */}
          <h1 className="login__heading">
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </h1>
          <p className="login__sub">
            {mode === 'login' ? (
              <>Noch kein Konto? <button className="login__switch" onClick={() => switchMode('register')}>Jetzt registrieren</button></>
            ) : (
              <>Bereits ein Konto? <button className="login__switch" onClick={() => switchMode('login')}>Anmelden</button></>
            )}
          </p>

          <form onSubmit={handleSubmit} className="login__form" key={mode}>
            {mode === 'register' && (
              <div className="login__row">
                <div className="login__field">
                  <label className="login__label">Vorname</label>
                  <div className="login__input-wrap">
                    <FontAwesomeIcon icon={faUser} className="login__input-icon" />
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                      required autoComplete="given-name" className="login__input" placeholder="Max" />
                  </div>
                </div>
                <div className="login__field">
                  <label className="login__label">Nachname</label>
                  <div className="login__input-wrap">
                    <FontAwesomeIcon icon={faUser} className="login__input-icon" />
                    <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
                      required autoComplete="family-name" className="login__input" placeholder="Mustermann" />
                  </div>
                </div>
              </div>
            )}

            <div className="login__field">
              <label className="login__label">E-Mail</label>
              <div className="login__input-wrap">
                <FontAwesomeIcon icon={faEnvelope} className="login__input-icon" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" className="login__input" placeholder="name@beispiel.de" />
              </div>
            </div>

            <div className="login__field">
              <label className="login__label">Passwort</label>
              <div className="login__input-wrap">
                <FontAwesomeIcon icon={faLock} className="login__input-icon" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="login__input" placeholder={mode === 'register' ? 'Mindestens 6 Zeichen' : '••••••••'} />
              </div>
            </div>

            {mode === 'register' && (
              <div className="login__field">
                <label className="login__label">Ich bin...</label>
                <div className="login__roles">
                  {(['customer', 'driver'] as Role[]).map(r => (
                    <label key={r} className={`login__role${role === r ? ' login__role--active' : ''}`}>
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                      <span className="login__role-icon">
                        <FontAwesomeIcon icon={r === 'customer' ? faCar : faBicycle} />
                      </span>
                      <span>{r === 'customer' ? 'Gast' : 'Fahrer'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="login__error">{error}</p>}

            <button type="submit" disabled={loading} className="login__btn">
              {loading
                ? (mode === 'login' ? 'Wird angemeldet...' : 'Wird registriert...')
                : (mode === 'login' ? 'Anmelden' : 'Konto erstellen')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
