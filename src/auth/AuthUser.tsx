import { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '../services'
import type { AuthUser, AuthSession, UserRole } from '../services'

type AuthContextType = {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    firstName: string,
    familyName: string,
    role: UserRole,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authService.getSession().then((s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const unsubscribe = authService.onAuthStateChange((s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn: authService.signIn.bind(authService),
        signUp: authService.signUp.bind(authService),
        signOut: authService.signOut.bind(authService),
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
