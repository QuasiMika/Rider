import { supabase } from './client'
import type { FunctionsService, CreateRequestResult } from '../types/functions'
import type { MatchResult, AcceptResult } from '../../types/ride'

async function getAccessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

export const supabaseFunctionsService: FunctionsService = {
  async invokeCreateRequest(pickupLocation, destination) {
    const token = await getAccessToken()
    const { data, error } = await supabase.functions.invoke<CreateRequestResult>('create-request', {
      body: { pickupLocation, destination },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw new Error(error.message)
    return data ?? { id: '', price_eur: null }
  },

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
    const token = await getAccessToken()
    const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
      body: { ride_id: rideId },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error || !data?.url) return null
    return data
  },
}
