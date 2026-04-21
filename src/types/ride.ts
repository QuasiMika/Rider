export type DriverAvailability = {
  id: string
  driver_id: string
  status: 'available' | 'matched'
  location?: string
  ride_id?: string
  created_at: string
}

export type GuestRequest = {
  id: string
  guest_id: string
  status: 'waiting' | 'matched'
  pickup_location?: string
  ride_id?: string
  created_at: string
}

export type Ride = {
  id: string
  driver_id: string
  guest_id: string
  status: 'pending' | 'active' | 'completed'
  created_at: string
}

export type MatchResult =
  | { matched: true; ride_id: string }
  | { matched: false }
