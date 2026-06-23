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
  passenger_count?: number
  rickshaw_type_id?: string | null
  rickshaw_price_multiplier?: number
  rickshaw_price_per_km?: number
  ride_id?: string
  created_at: string
}

export type Ride = {
  id: string
  driver_id: string
  guest_id: string
  status: 'pending' | 'arrived' | 'picked_up' | 'active' | 'completed' | 'cancelled'
  pickup_location?: string
  destination?: string
  actual_end_location?: string
  price_eur?: number | null
  passenger_count?: number
  rickshaw_type_id?: string | null
  rickshaw_price_multiplier?: number
  rickshaw_price_per_km?: number
  pickup_code?: string | null
  created_at: string
  arrived_at?: string | null
  completed_at?: string | null
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
