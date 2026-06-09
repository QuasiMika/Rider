import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import './Login.css'

export default function ResetPassword() {
  const { isPasswordRecovery, updatePasswordReset } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setLoading(true)
    const { error } = await updatePasswordReset(password)
    setLoading(false)
    if (error) { setError(error) } else { setDone(true) }
  }

  if (!isPasswordRecovery && !done) {
    return (
      <div className="login">
        <div className="login__right" style={{ flex: 1 }}>
          <div className="login__card">
            <h1 className="login__heading">Link ungültig</h1>
            <p className="login__sub" style={{ marginBottom: '1.5rem' }}>
              Dieser Link ist abgelaufen oder wurde bereits verwendet.
            </p>
            <button className="login__btn" onClick={() => navigate('/login')}>
              Zurück zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="login">
        <div className="login__right" style={{ flex: 1 }}>
          <div className="login__card">
            <div className="login__reset-success">
              <p>✅ Passwort erfolgreich geändert!</p>
              <button className="login__switch" onClick={() => navigate('/login')}>
                Jetzt anmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login">
      <div className="login__right" style={{ flex: 1 }}>
        <div className="login__card">
          <h1 className="login__heading">Neues Passwort</h1>
          <p className="login__sub">Gib dein neues Passwort ein.</p>

          <form onSubmit={handleSubmit} className="login__form">
            <div className="login__field">
              <label className="login__label">Neues Passwort</label>
              <div className="login__input-wrap">
                <FontAwesomeIcon icon={faLock} className="login__input-icon" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="login__input"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>
            </div>

            <div className="login__field">
              <label className="login__label">Passwort bestätigen</label>
              <div className="login__input-wrap">
                <FontAwesomeIcon icon={faLock} className="login__input-icon" />
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="login__input"
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>

            {error && <p className="login__error">{error}</p>}

            <button type="submit" disabled={loading} className="login__btn">
              {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
