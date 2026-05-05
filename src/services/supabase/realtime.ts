import { supabase } from './client'
import type { RealtimeService, DriverLocationPayload, LocationBroadcast } from '../types/realtime'
import type { GuestRequestRow } from '../types/db'
import type { Ride } from '../../types/ride'

export const supabaseRealtimeService: RealtimeService = {
  subscribeGuestRequests(channelId, onInsert, onDelete) {
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guest_requests' },
        (payload) => onInsert(payload.new as GuestRequestRow),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'guest_requests' },
        (payload) => onDelete((payload.old as { id: string }).id),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },

  subscribeRideByDriverId(channelId, driverId, onInsert, onUpdate) {
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
        (payload) => onInsert(payload.new as Ride),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
        (payload) => onUpdate(payload.new as Ride),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },

  subscribeRideByGuestId(channelId, guestId, onInsert, onUpdate) {
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides', filter: `guest_id=eq.${guestId}` },
        (payload) => onInsert(payload.new as Ride),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `guest_id=eq.${guestId}` },
        (payload) => onUpdate(payload.new as Ride),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },

  subscribeDriverLocation(rideId, onLocation) {
    const channel = supabase
      .channel(`ride-location:${rideId}`)
      .on('broadcast', { event: 'driver-location' }, ({ payload }) => {
        onLocation(payload as DriverLocationPayload)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },

  createLocationBroadcast(rideId): LocationBroadcast {
    const channel = supabase.channel(`ride-location:${rideId}`)
    return {
      subscribe(onStatus) { channel.subscribe(onStatus) },
      send(payload) {
        channel.send({ type: 'broadcast', event: 'driver-location', payload })
      },
      close() { supabase.removeChannel(channel) },
    }
  },
}
