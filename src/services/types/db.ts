import type { Ride } from '../../types/ride'

export type ServiceError = { message: string }

export type UserProfile = {
  user_id: string
  first_name: string | null
  family_name: string | null
  role: 'customer' | 'driver' | 'admin'
  currently_working: boolean
  rickshaw_type_id: string | null
  created_at: string
  email?: string | null
  last_ride_at?: string | null
}

export type AdminStats = {
  rides_today: number
  active_drivers: number
  avg_duration_minutes: number
}

export type UserProfileBasic = {
  user_id: string
  first_name: string | null
  family_name: string | null
}

export type GuestRequestRow = {
  id: string
  guest_id: string
  created_at: string
  pickup_location: string | null
  destination: string | null
  price_eur: number | null
  passenger_count: number
  rickshaw_type_id: string | null
  rickshaw_price_multiplier?: number
  rickshaw_price_per_km: number
}

export type RickshawType = {
  id: string
  name: string
  capacity: number
  price_per_km: number
  price_multiplier?: number
  is_active?: boolean
  assigned_drivers?: number
  created_at?: string
}

export type RickshawTypeInput = {
  id?: string | null
  name: string
  capacity: number
  price_per_km: number
}

export type ReportRow = {
  id: string
  notes: string | null
  created_at: string
}

export type RideMessage = {
  id: string
  ride_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface DbService {
  // user_profile
  getUserProfile(userId: string): Promise<{ data: UserProfile | null; error: ServiceError | null }>
  getUserProfiles(userIds: string[]): Promise<UserProfileBasic[]>
  updateUserProfile(userId: string, firstName: string, familyName: string): Promise<{ error: ServiceError | null }>
  updateDriverRickshawType(userId: string, rickshawTypeId: string): Promise<{ error: ServiceError | null }>

  // rickshaw_types
  getRickshawTypes(): Promise<RickshawType[]>
  getAdminRickshawTypes(): Promise<RickshawType[]>
  saveRickshawType(input: RickshawTypeInput): Promise<{ error: ServiceError | null }>
  setRickshawTypeActive(id: string, active: boolean): Promise<{ error: ServiceError | null }>
  deleteRickshawType(id: string): Promise<{ error: ServiceError | null }>

  // rides
  getActiveRide(userId: string, field: 'driver_id' | 'guest_id'): Promise<Ride | null>
  getRideById(rideId: string): Promise<Ride | null>
  getCompletedRides(userId: string, field: 'driver_id' | 'guest_id'): Promise<Ride[]>

  // guest_requests
  getWaitingGuestRequest(guestId: string): Promise<GuestRequestRow | null>
  getWaitingGuestRequests(): Promise<GuestRequestRow[]>
  insertGuestRequest(
    guestId: string,
    pickupLocation: string,
    destination: string,
    passengerCount: number,
  ): Promise<{ error: ServiceError | null }>
  deleteWaitingGuestRequest(guestId: string): Promise<{ error: ServiceError | null }>
  expireWaitingGuestRequest(guestId: string): Promise<{ error: ServiceError | null }>

  // driver_availability
  getDriverAvailability(driverId: string): Promise<{ id: string } | null>
  insertDriverAvailability(
    driverId: string,
  ): Promise<{ data: { id: string } | null; error: ServiceError | null }>

  // ride_reviews
  getReview(rideId: string, reviewerId: string): Promise<{ stars: number } | null>
  getReviews(revieweeId: string): Promise<Array<{ stars: number }>>
  insertReview(
    rideId: string,
    reviewerId: string,
    revieweeId: string,
    stars: number,
  ): Promise<{ error: ServiceError | null }>

  // ride_reports
  getReportDetail(rideId: string, reporterId: string): Promise<ReportRow | null>
  getReportExists(rideId: string, reporterId: string): Promise<boolean>
  insertReport(
    rideId: string,
    reporterId: string,
    notes: string | null,
  ): Promise<{ error: ServiceError | null }>

  // ride_messages
  getChatMessages(rideId: string): Promise<RideMessage[]>
  sendChatMessage(rideId: string, content: string): Promise<{ error: ServiceError | null }>

  // RPCs
  confirmPickup(rideId: string): Promise<void>
  confirmPickupByDriver(rideId: string, code: string): Promise<boolean>
  completeRide(rideId: string, location: string): Promise<void>
  getPublicStats(): Promise<{ total_users: number; completed_rides: number; total_distance_km: number } | null>

  // admin
  getAdminStats(): Promise<AdminStats | null>
  getAllRides(): Promise<Ride[]>
  getAllDrivers(): Promise<UserProfile[]>
  getAdminDriverRides(driverId: string): Promise<Ride[]>
  setDriverWorking(userId: string, working: boolean): Promise<{ error: ServiceError | null }>
}
