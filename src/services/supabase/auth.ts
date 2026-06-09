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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(
        session
          ? { access_token: session.access_token, user: { id: session.user.id, email: session.user.email } }
          : null,
        event,
      )
    })
    return () => subscription.unsubscribe()
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  async signUp(email, password, firstName, familyName, role: UserRole, rickshawTypeId?: string | null) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          family_name: familyName,
          role,
          ...(role === 'driver' && rickshawTypeId ? { rickshaw_type_id: rickshawTypeId } : {}),
        },
      },
    })
    return { error: error?.message ?? null }
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async resetPasswordEmail(email) {
    const baseUrl = window.location.href.split('#')[0]
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: baseUrl,
    })
    return { error: error?.message ?? null }
  },

  async updatePasswordReset(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },

  async updatePassword(currentPassword, newPassword) {
    // Verify old password by attempting a sign-in with current session email
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return { error: 'Nicht eingeloggt' }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })
    if (verifyError) return { error: 'Altes Passwort ist falsch' }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },
}
