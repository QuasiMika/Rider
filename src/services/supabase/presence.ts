import { supabase } from './client'
import type { PresenceService } from '../types/realtime'

export const supabasePresenceService: PresenceService = {
  trackOnline(channelId, userId) {
    const channel = supabase.channel(channelId, {
      config: { presence: { key: userId } },
    })
    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await channel.track({ online: true })
    })
    return () => { supabase.removeChannel(channel) }
  },

  subscribeOnlineCount(channelId, onCount) {
    const channel = supabase.channel(channelId)
    channel
      .on('presence', { event: 'sync' }, () => {
        onCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  },
}
