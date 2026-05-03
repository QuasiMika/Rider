import type { MatchResult, AcceptResult } from '../../types/ride'

export interface FunctionsService {
  invokeMatchRide(role: string, recordId: string): Promise<MatchResult>
  invokeAcceptRide(requestId: string): Promise<AcceptResult>
  invokeCreateCheckout(rideId: string): Promise<{ url: string } | null>
}
