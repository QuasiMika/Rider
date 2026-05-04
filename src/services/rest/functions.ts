import { apiFetch } from './client'
import type { FunctionsService, CreateRequestResult } from '../types/functions'
import type { AcceptResult } from '../../types/ride'

export const restFunctionsService: FunctionsService = {
  async invokeCreateRequest(pickupLocation, destination) {
    try {
      return await apiFetch<CreateRequestResult>('/guest-requests', {
        method: 'POST',
        body: JSON.stringify({ pickupLocation, destination }),
      })
    } catch {
      return { id: '', price_eur: null }
    }
  },

  // match-ride is legacy/no-op in both the Supabase and REST backends
  async invokeMatchRide(_role, _recordId) {
    return { matched: false }
  },

  async invokeAcceptRide(requestId) {
    try {
      return await apiFetch<AcceptResult>('/rides/accept', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      })
    } catch {
      return { accepted: false, reason: 'Network error' }
    }
  },

  // Not implemented in the REST API
  async invokeCreateCheckout(_rideId) {
    return null
  },
}
