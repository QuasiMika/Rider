import { supabase } from './client'
import type { AuthService, AuthSession, UserRole } from '../types/auth'

export const supabaseAuthService: AuthService = {
  async getSession(): Promise<AuthSession | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return {
      access_token: session.access_token,
      user: { id: session.user.id, email: session.user.email },
    }
  },

  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(
        session
          ? { access_token: session.access_token, user: { id: session.user.id, email: session.user.email } }
          : null,
      )
    })
    return () => subscription.unsubscribe()
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  async signUp(email, password, firstName, familyName, role: UserRole) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, family_name: familyName, role } },
    })
    return { error: error?.message ?? null }
  },

  async signOut() {
    await supabase.auth.signOut()
  },
}
