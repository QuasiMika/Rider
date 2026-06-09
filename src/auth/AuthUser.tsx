import { createContext, useContext, useEffect, useState } from 'react'
import { authService, dbService } from '../services'
import type { AuthUser, AuthSession, UserRole } from '../services'

type AuthContextType = {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  // true, wenn das initiale Laden der Nutzerdaten fehlschlägt (z. B. 503 vom Backend)
  backendError: boolean
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    firstName: string,
    familyName: string,
    role: UserRole,
    rickshawTypeId?: string | null,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPasswordEmail: (email: string) => Promise<{ error: string | null }>
  updatePasswordReset: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    authService.getSession().then((s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const unsubscribe = authService.onAuthStateChange((s, event) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'USER_UPDATED') setIsPasswordRecovery(false)
    })

    return unsubscribe
  }, [])

  // Backend-Health-Check: sobald ein User eingeloggt ist, laden wir dessen Profil.
  // Schlägt das fehl (Backend down / 503), schalten wir global den Wartungsmodus an.
  useEffect(() => {
    if (!user) { setBackendError(false); return }
    let cancelled = false
    dbService.getUserProfile(user.id).then(({ error }) => {
      if (!cancelled) setBackendError(!!error)
    })
    return () => { cancelled = true }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        backendError,
        isPasswordRecovery,
        signIn: authService.signIn.bind(authService),
        signUp: authService.signUp.bind(authService),
        signOut: authService.signOut.bind(authService),
        resetPasswordEmail: authService.resetPasswordEmail.bind(authService),
        updatePasswordReset: authService.updatePasswordReset.bind(authService),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
