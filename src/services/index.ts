// Re-export all service types so consumers import from one place
export type { AuthService, AuthUser, AuthSession, UserRole } from './types/auth'
export type { DbService, UserProfile, UserProfileBasic, GuestRequestRow, ReportRow, ServiceError } from './types/db'
export type { FunctionsService } from './types/functions'
export type { RealtimeService, PresenceService, DriverLocationPayload, LocationBroadcast } from './types/realtime'

import type { AuthService } from './types/auth'
import type { DbService } from './types/db'
import type { FunctionsService } from './types/functions'
import type { RealtimeService, PresenceService } from './types/realtime'

import { supabaseAuthService } from './supabase/auth'
import { supabaseDbService } from './supabase/db'
import { supabaseFunctionsService } from './supabase/functions'
import { supabaseRealtimeService } from './supabase/realtime'
import { supabasePresenceService } from './supabase/presence'

import { restDbService } from './rest/db'
import { restFunctionsService } from './rest/functions'
import { setToken } from './rest/client'

// When VITE_BACKEND=rest the app talks to the Express REST API instead of Supabase directly.
// Auth, realtime, and presence still go through Supabase — only db and functions are swapped.
// Set VITE_API_URL (default: http://localhost:3001) to point at the REST API server.
const useRest = import.meta.env.VITE_BACKEND === 'rest'

export const authService: AuthService = supabaseAuthService
export const dbService: DbService = useRest ? restDbService : supabaseDbService
export const functionsService: FunctionsService = useRest ? restFunctionsService : supabaseFunctionsService
export const realtimeService: RealtimeService = supabaseRealtimeService
export const presenceService: PresenceService = supabasePresenceService

// Keep the REST client's token in sync with the auth session when using the REST backend
if (useRest) {
  authService.onAuthStateChange(session => setToken(session?.access_token ?? null))
}

export { setToken as setRestToken }
