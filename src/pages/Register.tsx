import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import './Login.css'
import './Register.css'

type Role = 'customer' | 'driver'

export default function Register() {
  const { signUp, user } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('customer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password, firstName, familyName, role)

    if (error) {
      setError(error)
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card auth-card--wide">
        <h1 className="auth-heading">Registrieren</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-row">
            <div className="auth-field">
              <label className="auth-label">Vorname</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="auth-input"
                placeholder="Max"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Nachname</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                autoComplete="family-name"
                className="auth-input"
                placeholder="Mustermann"
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="auth-input"
              placeholder="name@beispiel.de"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
              placeholder="Mindestens 6 Zeichen"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Ich bin...</label>
            <div className="role-group">
              {(['customer', 'driver'] as Role[]).map((r) => (
                <label
                  key={r}
                  className={`role-option${role === r ? ' role-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  <span className="role-icon">{r === 'customer' ? '🚲' : '🚴'}</span>
                  <span className="role-label">{r === 'customer' ? 'Kunde' : 'Fahrer'}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Wird registriert...' : 'Konto erstellen'}
          </button>
        </form>

        <p className="auth-footer">
          Bereits ein Konto?{' '}
          <Link to="/login" className="auth-link">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
