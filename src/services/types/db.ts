import type { Ride } from '../../types/ride'

export type ServiceError = { message: string }

export type UserProfile = {
  user_id: string
  first_name: string | null
  family_name: string | null
  role: 'customer' | 'driver'
  currently_working: boolean
  created_at: string
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
}

export type ReportRow = {
  id: string
  notes: string | null
  created_at: string
}

export interface DbService {
  // user_profile
  getUserProfile(userId: string): Promise<{ data: UserProfile | null; error: ServiceError | null }>
  getUserProfiles(userIds: string[]): Promise<UserProfileBasic[]>

  // rides
  getActiveRide(userId: string, field: 'driver_id' | 'guest_id'): Promise<Ride | null>
  getRideById(rideId: string): Promise<Ride | null>
  getCompletedRides(userId: string, field: 'driver_id' | 'guest_id'): Promise<Ride[]>

  // guest_requests
  getWaitingGuestRequest(guestId: string): Promise<{ id: string } | null>
  getWaitingGuestRequests(): Promise<GuestRequestRow[]>
  insertGuestRequest(
    guestId: string,
    pickupLocation: string,
    destination: string,
  ): Promise<{ error: ServiceError | null }>
  deleteWaitingGuestRequest(guestId: string): Promise<{ error: ServiceError | null }>

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

  // RPCs
  confirmPickup(rideId: string): Promise<void>
  completeRide(rideId: string, location: string): Promise<void>
  getPublicStats(): Promise<{ total_users: number; completed_rides: number; total_distance_km: number } | null>
}
