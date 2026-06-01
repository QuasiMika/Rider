import { useState, useEffect, useCallback } from 'react'
import { dbService, realtimeService, functionsService } from '../services'
import type { GuestRequestRow, RickshawType } from '../services'
import type { Ride, AcceptResult } from '../types/ride'

export type RequestWithProfile = {
  id: string
  guest_id: string
  created_at: string
  pickupLocation: string
  destination: string
  price_eur: number | null
  passenger_count: number
  rickshaw_price_per_km: number
  required_capacity: number
  required_price_per_km: number
  rickshaw_type_name: string
  guestName: string
  guestInitials: string
}

export type DriverModelFilter = 'all' | 'same'

type DriverStatus = 'browsing' | 'matched' | 'error'

type UseDriverRequestsResult = {
  requests: RequestWithProfile[]
  currentRide: Ride | null
  status: DriverStatus
  isAccepting: boolean
  error: string | null
  acceptRequest: (requestId: string) => Promise<void>
  resetToIdle: () => void
}

function getRequiredCapacity(row: GuestRequestRow, typeMap: Map<string, RickshawType>): number {
  return Math.max(row.passenger_count ?? 1, typeMap.get(row.rickshaw_type_id ?? '')?.capacity ?? 1)
}

function getRequiredPricePerKm(row: GuestRequestRow, typeMap: Map<string, RickshawType>): number {
  return row.rickshaw_price_per_km
    ?? typeMap.get(row.rickshaw_type_id ?? '')?.price_per_km
    ?? (row.rickshaw_price_multiplier ?? 1) * 2
}

function getTypeName(row: GuestRequestRow, typeMap: Map<string, RickshawType>): string {
  const type = typeMap.get(row.rickshaw_type_id ?? '')
  if (type) return type.name
  return `Modell bis ${getRequiredCapacity(row, typeMap)}`
}

function matchesModelFilter(requiredPricePerKm: number, driverPricePerKm: number, filter: DriverModelFilter): boolean {
  if (filter === 'same') return Math.abs(requiredPricePerKm - driverPricePerKm) < 0.01
  return requiredPricePerKm <= driverPricePerKm
}

function requestFitsDriver(
  row: GuestRequestRow,
  typeMap: Map<string, RickshawType>,
  minPassengers: number,
  maxPassengers: number,
  driverCapacity: number,
  driverPricePerKm: number,
  modelFilter: DriverModelFilter,
): boolean {
  const passengerCount = row.passenger_count ?? 1
  const requiredCapacity = getRequiredCapacity(row, typeMap)
  const requiredPricePerKm = getRequiredPricePerKm(row, typeMap)
  return passengerCount >= minPassengers
    && passengerCount <= maxPassengers
    && requiredCapacity <= driverCapacity
    && matchesModelFilter(requiredPricePerKm, driverPricePerKm, modelFilter)
}

async function enrichRow(row: GuestRequestRow, typeMap: Map<string, RickshawType>): Promise<RequestWithProfile> {
  const profiles = await dbService.getUserProfiles([row.guest_id])
  const p = profiles[0]
  const fullName = p ? `${p.first_name ?? ''} ${p.family_name ?? ''}`.trim() : ''
  const initials = p
    ? `${p.first_name?.[0] ?? ''}${p.family_name?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'
  return {
    id: row.id,
    guest_id: row.guest_id,
    created_at: row.created_at,
    pickupLocation: row.pickup_location ?? '',
    destination: row.destination ?? '',
    price_eur: row.price_eur,
    passenger_count: row.passenger_count ?? 1,
    rickshaw_price_per_km: getRequiredPricePerKm(row, typeMap),
    required_capacity: getRequiredCapacity(row, typeMap),
    required_price_per_km: getRequiredPricePerKm(row, typeMap),
    rickshaw_type_name: getTypeName(row, typeMap),
    guestName: fullName || 'Gast',
    guestInitials: initials,
  }
}

export function useDriverRequests(
  driverId: string,
  minPassengers = 1,
  maxPassengers = Number.MAX_SAFE_INTEGER,
  driverCapacity = Number.MAX_SAFE_INTEGER,
  driverPricePerKm = Number.MAX_SAFE_INTEGER,
  modelFilter: DriverModelFilter = 'all',
): UseDriverRequestsResult {
  const [requests, setRequests] = useState<RequestWithProfile[]>([])
  const [currentRide, setCurrentRide] = useState<Ride | null>(null)
  const [status, setStatus] = useState<DriverStatus>('browsing')
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore active ride on mount
  useEffect(() => {
    if (!driverId) return
    dbService.getActiveRide(driverId, 'driver_id').then((ride) => {
      if (ride) { setCurrentRide(ride); setStatus('matched') }
    })
  }, [driverId])

  // Initial fetch of waiting requests + profiles
  useEffect(() => {
    if (!driverId) return
    const load = async () => {
      const [allRows, rickshawTypes] = await Promise.all([
        dbService.getWaitingGuestRequests(),
        dbService.getRickshawTypes(),
      ])
      const typeMap = new Map(rickshawTypes.map(type => [type.id, type]))
      const rows = allRows.filter(r => requestFitsDriver(r, typeMap, minPassengers, maxPassengers, driverCapacity, driverPricePerKm, modelFilter))
      if (rows.length === 0) { setRequests([]); return }

      const guestIds = rows.map(r => r.guest_id)
      const profiles = await dbService.getUserProfiles(guestIds)
      const profileMap = new Map(profiles.map(p => [p.user_id, p]))

      setRequests(rows.map(r => {
        const p = profileMap.get(r.guest_id)
        const fullName = p ? `${p.first_name ?? ''} ${p.family_name ?? ''}`.trim() : ''
        const initials = p
          ? `${p.first_name?.[0] ?? ''}${p.family_name?.[0] ?? ''}`.toUpperCase() || '?'
          : '?'
        return {
          id: r.id,
          guest_id: r.guest_id,
          created_at: r.created_at,
          pickupLocation: r.pickup_location ?? '',
          destination: r.destination ?? '',
          price_eur: r.price_eur,
          passenger_count: r.passenger_count ?? 1,
          rickshaw_price_per_km: getRequiredPricePerKm(r, typeMap),
          required_capacity: getRequiredCapacity(r, typeMap),
          required_price_per_km: getRequiredPricePerKm(r, typeMap),
          rickshaw_type_name: getTypeName(r, typeMap),
          guestName: fullName || 'Gast',
          guestInitials: initials,
        }
      }))
    }
    load()
  }, [driverId, minPassengers, maxPassengers, driverCapacity, driverPricePerKm, modelFilter])

  // Realtime: guest_requests INSERT / DELETE
  useEffect(() => {
    if (!driverId) return
    return realtimeService.subscribeGuestRequests(
      `guest-requests-driver-${driverId}`,
      async (row) => {
        const types = await dbService.getRickshawTypes()
        const typeMap = new Map(types.map(type => [type.id, type]))
        if (!requestFitsDriver(row, typeMap, minPassengers, maxPassengers, driverCapacity, driverPricePerKm, modelFilter)) return
        const enriched = await enrichRow(row, typeMap)
        setRequests(prev => [...prev, enriched])
      },
      (deletedId) => setRequests(prev => prev.filter(r => r.id !== deletedId)),
    )
  }, [driverId, minPassengers, maxPassengers, driverCapacity, driverPricePerKm, modelFilter])

  // Realtime: rides INSERT/UPDATE for this driver
  useEffect(() => {
    if (!driverId) return
    return realtimeService.subscribeRideByDriverId(
      `rides-driver-accept-${driverId}`,
      driverId,
      (ride) => { setCurrentRide(ride); setStatus('matched'); setIsAccepting(false) },
      (ride) => setCurrentRide(ride),
    )
  }, [driverId])

  const acceptRequest = useCallback(async (requestId: string) => {
    if (!driverId) return
    setIsAccepting(true)
    setError(null)

    try {
      const result: AcceptResult = await functionsService.invokeAcceptRide(requestId)

      if (result.accepted && result.ride_id) {
        const ride = await dbService.getRideById(result.ride_id)
        if (ride) { setCurrentRide(ride); setStatus('matched') }
      } else if (!result.accepted) {
        setError(result.reason === 'capacity_too_small' || result.reason === 'price_class_too_low'
          ? 'Diese Anfrage ist größer als deine aktuelle Rikscha-Kapazität.'
          : 'Diese Anfrage wurde bereits von einem anderen Fahrer angenommen.')
        if (result.reason !== 'capacity_too_small' && result.reason !== 'price_class_too_low') {
          setRequests(prev => prev.filter(r => r.id !== requestId))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsAccepting(false)
    }
  }, [driverId])

  const resetToIdle = useCallback(() => {
    setStatus('browsing')
    setCurrentRide(null)
    setError(null)
  }, [])

  return { requests, currentRide, status, isAccepting, error, acceptRequest, resetToIdle }
}
