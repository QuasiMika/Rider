type Props = {
  onCancel: () => void
}

export function GuestSearching({ onCancel }: Props) {
  return (
    <div className="rm-card">
      <h2>Suche Fahrer...</h2>
      <div className="guest-radar" aria-label="Suche läuft">
        <div className="guest-radar__ring" />
        <div className="guest-radar__ring" />
        <div className="guest-radar__ring" />
        <div className="guest-radar__dot" />
      </div>
      <p>Wir suchen einen verfügbaren Fahrer für dich.</p>
      <button className="rm-btn rm-btn--cancel" onClick={onCancel}>
        Abbrechen
      </button>
    </div>
  )
}
