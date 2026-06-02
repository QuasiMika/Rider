import './MaintenanceScreen.css'

export function MaintenanceScreen() {
  return (
    <div className="maintenance" role="alert">
      <div className="maintenance-card">
        <div className="maintenance-icon" aria-hidden="true">🛠️</div>
        <h1 className="maintenance-title">Wir haben aktuell technische Probleme.</h1>
        <p className="maintenance-text">
          Unser Team arbeitet bereits an der Lösung. Bitte öffne die App später noch einmal.
        </p>
      </div>
    </div>
  )
}
