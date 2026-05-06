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
  destination?: string
  price_eur?: number | null
  ride_id?: string
  created_at: string
}

export type Ride = {
  id: string
  driver_id: string
  guest_id: string
  status: 'pending' | 'picked_up' | 'active' | 'completed'
  pickup_location?: string
  destination?: string
  actual_end_location?: string
  price_eur?: number | null
  pickup_code?: string | null
  created_at: string
}

export type RideReport = {
  id: string
  ride_id: string
  reporter_id: string
  notes: string | null
  created_at: string
}

export type MatchResult =
  | { matched: true; ride_id: string }
  | { matched: false }

export type AcceptResult =
  | { accepted: true; ride_id: string; price_eur?: number | null }
  | { accepted: false; reason: string }
