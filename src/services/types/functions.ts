import type { MatchResult, AcceptResult } from '../../types/ride'

export type CreateRequestResult = { id: string; price_eur: number | null }

export interface FunctionsService {
  invokeCreateRequest(pickupLocation: string, destination: string): Promise<CreateRequestResult>
  invokeMatchRide(role: string, recordId: string): Promise<MatchResult>
  invokeAcceptRide(requestId: string): Promise<AcceptResult>
  invokeCreateCheckout(rideId: string): Promise<{ url: string } | null>
}
