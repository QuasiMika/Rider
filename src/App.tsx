import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthUser'
import { AppLayout } from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Help from './pages/Help'
import Profil from './pages/Profil'
import PublicProfile from './pages/PublicProfile'
import LandingPage from './pages/LandingPage'
import { RideMatchingApp } from './components/RideMatchingApp'
import Impressum from './pages/Impressum'
import ReportDetail from './pages/ReportDetail'
import Einnahmen from './pages/Einnahmen'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/help" element={<Help />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
            <Route path="/report/:rideId" element={<ProtectedRoute><ReportDetail /></ProtectedRoute>} />
            <Route path="/ride" element={<ProtectedRoute><RideMatchingApp /></ProtectedRoute>} />
            <Route path="/einnahmen" element={<ProtectedRoute><Einnahmen /></ProtectedRoute>} />
            <Route path="/driver" element={<Navigate to="/ride" replace />} />
            <Route path="/guest" element={<Navigate to="/ride" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
