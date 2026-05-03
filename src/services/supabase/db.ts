import { supabase } from './client'
import type { DbService, UserProfile, UserProfileBasic, GuestRequestRow, ReportRow, ServiceError } from '../types/db'
import type { Ride } from '../../types/ride'

function toError(e: unknown): ServiceError {
  return { message: e instanceof Error ? e.message : String(e) }
}

export const supabaseDbService: DbService = {
  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('user_profile')
      .select('user_id, first_name, family_name, role, currently_working, created_at')
      .eq('user_id', userId)
      .single()
    return {
      data: data as UserProfile | null,
      error: error ? { message: error.message } : null,
    }
  },

  async getUserProfiles(userIds) {
    const { data } = await supabase
      .from('user_profile')
      .select('user_id, first_name, family_name')
      .in('user_id', userIds)
    return (data ?? []) as UserProfileBasic[]
  },

  async getActiveRide(userId, field) {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq(field, userId)
      .in('status', ['pending', 'picked_up', 'active'])
      .maybeSingle()
    return (data as Ride | null) ?? null
  },

  async getRideById(rideId) {
    const { data } = await supabase.from('rides').select('*').eq('id', rideId).maybeSingle()
    return (data as Ride | null) ?? null
  },

  async getCompletedRides(userId, field) {
    const { data } = await supabase
      .from('rides')
      .select('id, driver_id, guest_id, status, pickup_location, destination, actual_end_location, created_at')
      .eq(field, userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    return (data as Ride[]) ?? []
  },

  async getWaitingGuestRequest(guestId) {
    const { data } = await supabase
      .from('guest_requests')
      .select('id')
      .eq('guest_id', guestId)
      .eq('status', 'waiting')
      .maybeSingle()
    return data as { id: string } | null
  },

  async getWaitingGuestRequests() {
    const { data } = await supabase
      .from('guest_requests')
      .select('id, guest_id, created_at, pickup_location, destination')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
    return (data ?? []) as GuestRequestRow[]
  },

  async insertGuestRequest(guestId, pickupLocation, destination) {
    const { error } = await supabase
      .from('guest_requests')
      .insert({ guest_id: guestId, status: 'waiting', pickup_location: pickupLocation, destination })
    return { error: error ? { message: error.message } : null }
  },

  async deleteWaitingGuestRequest(guestId) {
    const { error } = await supabase
      .from('guest_requests')
      .delete()
      .eq('guest_id', guestId)
      .eq('status', 'waiting')
    return { error: error ? { message: error.message } : null }
  },

  async getDriverAvailability(driverId) {
    const { data } = await supabase
      .from('driver_availability')
      .select('id')
      .eq('driver_id', driverId)
      .eq('status', 'available')
      .maybeSingle()
    return data as { id: string } | null
  },

  async insertDriverAvailability(driverId) {
    const { data, error } = await supabase
      .from('driver_availability')
      .insert({ driver_id: driverId, status: 'available' })
      .select('id')
      .single()
    return {
      data: data as { id: string } | null,
      error: error ? { message: error.message } : null,
    }
  },

  async getReview(rideId, reviewerId) {
    const { data } = await supabase
      .from('ride_reviews')
      .select('stars')
      .eq('ride_id', rideId)
      .eq('reviewer_id', reviewerId)
      .maybeSingle()
    return data as { stars: number } | null
  },

  async getReviews(revieweeId) {
    const { data } = await supabase
      .from('ride_reviews')
      .select('stars')
      .eq('reviewee_id', revieweeId)
    return (data ?? []) as Array<{ stars: number }>
  },

  async insertReview(rideId, reviewerId, revieweeId, stars) {
    const { error } = await supabase
      .from('ride_reviews')
      .insert({ ride_id: rideId, reviewer_id: reviewerId, reviewee_id: revieweeId, stars })
    return { error: error ? { message: error.message } : null }
  },

  async getReportDetail(rideId, reporterId) {
    const { data } = await supabase
      .from('ride_reports')
      .select('id, notes, created_at')
      .eq('ride_id', rideId)
      .eq('reporter_id', reporterId)
      .maybeSingle()
    return data as ReportRow | null
  },

  async getReportExists(rideId, reporterId) {
    const { data } = await supabase
      .from('ride_reports')
      .select('id')
      .eq('ride_id', rideId)
      .eq('reporter_id', reporterId)
      .maybeSingle()
    return data !== null
  },

  async insertReport(rideId, reporterId, notes) {
    const { error } = await supabase
      .from('ride_reports')
      .insert({ ride_id: rideId, reporter_id: reporterId, notes: notes ?? null })
    return { error: error ? { message: error.message } : null }
  },

  async confirmPickup(rideId) {
    await supabase.rpc('confirm_pickup', { p_ride_id: rideId })
  },

  async completeRide(rideId, location) {
    await supabase.rpc('complete_ride', { p_ride_id: rideId, p_location: location })
  },

  async getPublicStats() {
    const { data } = await supabase.rpc('get_public_stats')
    return data ?? null
  },
}

// keep toError available for future use
void toError
