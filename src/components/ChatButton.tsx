type Props = {
  unreadCount: number
  onClick: () => void
}

export function ChatButton({ unreadCount, onClick }: Props) {
  return (
    <button className="chat-btn" onClick={onClick} aria-label="Chat öffnen">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadCount > 0 && (
        <span className="chat-btn__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}
    </button>
  )
}
