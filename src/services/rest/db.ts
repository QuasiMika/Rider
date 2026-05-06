import { apiFetch } from './client'
import type { DbService, UserProfile, UserProfileBasic, GuestRequestRow, ReportRow, ServiceError } from '../types/db'
import type { Ride } from '../../types/ride'

function toError(e: unknown): ServiceError {
  return { message: e instanceof Error ? e.message : String(e) }
}

export const restDbService: DbService = {
  async getUserProfile(userId) {
    try {
      const data = await apiFetch<UserProfile>(`/users/${userId}`)
      return { data, error: null }
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getUserProfiles(userIds) {
    if (!userIds.length) return []
    try {
      return await apiFetch<UserProfileBasic[]>(`/users?ids=${userIds.join(',')}`)
    } catch {
      return []
    }
  },

  async getActiveRide(_userId, field) {
    try {
      return await apiFetch<Ride | null>(`/rides/active?field=${field}`)
    } catch {
      return null
    }
  },

  async getRideById(rideId) {
    try {
      return await apiFetch<Ride | null>(`/rides/${rideId}`)
    } catch {
      return null
    }
  },

  async getCompletedRides(_userId, field) {
    try {
      return await apiFetch<Ride[]>(`/rides/completed?field=${field}`)
    } catch {
      return []
    }
  },

  // Called only from GuestPanel (role=customer) — server returns { id } | null for guests
  async getWaitingGuestRequest(_guestId) {
    try {
      return await apiFetch<{ id: string } | null>('/guest-requests')
    } catch {
      return null
    }
  },

  // Called only from DriverPanel (role=driver) — server returns GuestRequestRow[] for drivers
  async getWaitingGuestRequests() {
    try {
      return await apiFetch<GuestRequestRow[]>('/guest-requests')
    } catch {
      return []
    }
  },

  async insertGuestRequest(_guestId, pickupLocation, destination) {
    try {
      await apiFetch('/guest-requests', {
        method: 'POST',
        body: JSON.stringify({ pickupLocation, destination }),
      })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async deleteWaitingGuestRequest(_guestId) {
    try {
      await apiFetch('/guest-requests', { method: 'DELETE' })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async getDriverAvailability(driverId) {
    try {
      return await apiFetch<{ id: string } | null>(`/driver-availability/${driverId}`)
    } catch {
      return null
    }
  },

  async insertDriverAvailability(_driverId) {
    try {
      const res = await apiFetch<{ data: { id: string } | null; error: null }>('/driver-availability', {
        method: 'POST',
      })
      return res
    } catch (e) {
      return { data: null, error: toError(e) }
    }
  },

  async getReview(rideId, reviewerId) {
    try {
      return await apiFetch<{ stars: number } | null>(
        `/reviews?rideId=${rideId}&reviewerId=${reviewerId}`,
      )
    } catch {
      return null
    }
  },

  async getReviews(revieweeId) {
    try {
      return await apiFetch<Array<{ stars: number }>>(`/reviews?revieweeId=${revieweeId}`)
    } catch {
      return []
    }
  },

  async insertReview(rideId, _reviewerId, revieweeId, stars) {
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ rideId, revieweeId, stars }),
      })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async getReportDetail(rideId, _reporterId) {
    try {
      return await apiFetch<ReportRow | null>(`/reports/${rideId}`)
    } catch {
      return null
    }
  },

  async getReportExists(rideId, _reporterId) {
    try {
      const data = await apiFetch<{ exists: boolean }>(`/reports/${rideId}?detail=false`)
      return data.exists
    } catch {
      return false
    }
  },

  async insertReport(rideId, _reporterId, notes) {
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ rideId, notes: notes ?? null }),
      })
      return { error: null }
    } catch (e) {
      return { error: toError(e) }
    }
  },

  async confirmPickup(rideId) {
    await apiFetch(`/rides/${rideId}/confirm-pickup`, { method: 'POST' })
  },

  async confirmPickupByDriver(rideId, code) {
    try {
      const result = await apiFetch<{ success: boolean }>(`/rides/${rideId}/confirm-pickup-by-driver`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      return result.success === true
    } catch {
      return false
    }
  },

  async completeRide(rideId, location) {
    await apiFetch(`/rides/${rideId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ location }),
    })
  },

  async getPublicStats() {
    try {
      return await apiFetch<{ total_users: number; completed_rides: number; total_distance_km: number }>(
        '/stats',
      )
    } catch {
      return null
    }
  },
}
