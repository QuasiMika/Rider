import type { Ride } from '../../types/ride'
import type { GuestRequestRow } from './db'

export type DriverLocationPayload = {
  lat: number
  lng: number
  etaSeconds?: number
  approachPolyline?: [number, number][] | null
}

export interface LocationBroadcast {
  subscribe(onStatus: (status: string) => void): void
  send(payload: DriverLocationPayload): void
  close(): void
}

export interface RealtimeService {
  subscribeGuestRequests(
    channelId: string,
    onInsert: (row: GuestRequestRow) => void,
    onDelete: (id: string) => void,
  ): () => void

  subscribeRideByDriverId(
    channelId: string,
    driverId: string,
    onInsert: (ride: Ride) => void,
    onUpdate: (ride: Ride) => void,
  ): () => void

  subscribeRideByGuestId(
    channelId: string,
    guestId: string,
    onInsert: (ride: Ride) => void,
    onUpdate: (ride: Ride) => void,
  ): () => void

  subscribeDriverLocation(
    rideId: string,
    onLocation: (payload: DriverLocationPayload) => void,
  ): () => void

  createLocationBroadcast(rideId: string): LocationBroadcast
}

export interface PresenceService {
  trackOnline(channelId: string, userId: string): () => void
  subscribeOnlineCount(channelId: string, onCount: (count: number) => void): () => void
}
