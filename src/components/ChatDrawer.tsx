import { useState, useEffect, useRef } from 'react'
import type { RideMessage } from '../services'

type Props = {
  messages: RideMessage[]
  currentUserId: string
  onClose: () => void
  onSend: (content: string) => void
}

export function ChatDrawer({ messages, currentUserId, onClose, onSend }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-drawer" role="dialog" aria-label="Chat">
      <div className="chat-drawer__header">
        <span className="chat-drawer__title">Nachrichten</span>
        <button className="chat-drawer__close" onClick={onClose} aria-label="Chat schließen">✕</button>
      </div>

      <div className="chat-drawer__messages">
        {messages.length === 0 && (
          <div className="chat-drawer__empty">Noch keine Nachrichten. Schreib etwas!</div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-msg ${msg.sender_id === currentUserId ? 'chat-msg--own' : 'chat-msg--other'}`}
          >
            <div className="chat-msg__bubble">{msg.content}</div>
            <div className="chat-msg__time">
              {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-drawer__input-row">
        <input
          className="chat-drawer__input"
          type="text"
          placeholder="Nachricht…"
          maxLength={500}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button
          className="chat-drawer__send rm-btn rm-btn--accept"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          Senden
        </button>
      </div>
    </div>
  )
}
