import { useState, useEffect, useRef, useCallback } from 'react'
import { dbService, realtimeService } from '../services'
import type { RideMessage } from '../services'

export function useChatMessages(rideId: string, currentUserId: string) {
  const [messages, setMessages] = useState<RideMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const lastReadAtRef = useRef<string>(new Date().toISOString())

  useEffect(() => {
    dbService.getChatMessages(rideId).then(setMessages)
  }, [rideId])

  useEffect(() => {
    return realtimeService.subscribeChatMessages(rideId, (msg) => {
      setMessages(prev => [...prev, msg])
      if (!isOpen && msg.sender_id !== currentUserId) {
        setUnreadCount(c => c + 1)
      }
    })
  }, [rideId, currentUserId, isOpen])

  const openChat = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
    lastReadAtRef.current = new Date().toISOString()
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    await dbService.sendChatMessage(rideId, trimmed)
  }, [rideId])

  return { messages, unreadCount, isOpen, openChat, closeChat, sendMessage }
}
