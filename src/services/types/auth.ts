export type UserRole = 'customer' | 'driver'

export type AuthUser = {
  id: string
  email?: string
}

export type AuthSession = {
  access_token: string
  user: AuthUser
}

export type Unsubscribe = () => void

export interface AuthService {
  getSession(): Promise<AuthSession | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): Unsubscribe
  signIn(email: string, password: string): Promise<{ error: string | null }>
  signUp(
    email: string,
    password: string,
    firstName: string,
    familyName: string,
    role: UserRole,
  ): Promise<{ error: string | null }>
  signOut(): Promise<void>
}
