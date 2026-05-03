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

// Swap all five services here when VITE_USE_MOCK_BACKEND=true.
// Add src/services/mock/{auth,db,functions,realtime,presence}.ts and replace the
// supabase* imports above with mock* imports — no other file needs to change.
if (import.meta.env.VITE_USE_MOCK_BACKEND === 'true') {
  throw new Error(
    '[services] VITE_USE_MOCK_BACKEND=true but no mock implementations exist yet. ' +
    'Add src/services/mock/ and swap the imports in src/services/index.ts.',
  )
}

export const authService: AuthService = supabaseAuthService
export const dbService: DbService = supabaseDbService
export const functionsService: FunctionsService = supabaseFunctionsService
export const realtimeService: RealtimeService = supabaseRealtimeService
export const presenceService: PresenceService = supabasePresenceService
