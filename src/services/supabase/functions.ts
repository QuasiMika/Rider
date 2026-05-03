import { supabase } from './client'
import type { FunctionsService } from '../types/functions'
import type { MatchResult, AcceptResult } from '../../types/ride'

async function getAccessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

export const supabaseFunctionsService: FunctionsService = {
  async invokeMatchRide(role, recordId) {
    const token = await getAccessToken()
    const { data, error } = await supabase.functions.invoke<MatchResult>('match-ride', {
      body: { role, recordId },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw new Error(error.message)
    return data ?? { matched: false }
  },

  async invokeAcceptRide(requestId) {
    const token = await getAccessToken()
    const { data, error } = await supabase.functions.invoke<AcceptResult>('accept-ride', {
      body: { requestId },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw new Error(error.message)
    return data ?? { accepted: false, reason: 'No response' }
  },

  async invokeCreateCheckout(rideId) {
    const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
      body: { ride_id: rideId },
    })
    if (error || !data?.url) return null
    return data
  },
}
