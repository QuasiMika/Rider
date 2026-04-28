import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthUser'
import Login from './pages/Login'
import Register from './pages/Register'
import Help from './pages/Help'
import Protected from './pages/Protected'
import DriverPage from './pages/DriverPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  return <>{children}</>
}

function Home() {
  const { user } = useAuth()

  const btnStyle: React.CSSProperties = {
    fontFamily: 'var(--sans)',
    fontSize: '15px',
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    color: 'var(--text-h)',
    cursor: 'pointer',
    marginBottom: '1.5rem',
    display: 'block',
  }

  const btnDisabled: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'left' }}>
      <Link to="/help">
        <button style={btnStyle}>Help</button>
      </Link>

      {user ? (
        <Link to="/protected">
          <button style={btnStyle}>Dashboard</button>
        </Link>
      ) : (
        <button style={btnDisabled} disabled title="Bitte zuerst anmelden">
          Dashboard
        </button>
      )}

      {!user && (
        <Link to="/login">
          <button style={{ ...btnStyle, background: 'var(--accent)', color: '#fff', border: 'none' }}>
            Anmelden
          </button>
        </Link>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/help" element={<Help />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <Protected />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver"
            element={
              <ProtectedRoute>
                <DriverPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
