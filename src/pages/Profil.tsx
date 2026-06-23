import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useRideMatching } from '../hooks/useRideMatching'
import { authService, dbService, realtimeService } from '../services'
import type { UserProfile, RickshawType } from '../services'
import type { Ride } from '../types/ride'
import { RoundedSelect } from '../components/common/RoundedSelect'
import { RideTile } from '../components/rides/RideTile'
import { RideDetailDialog, StarDisplay } from '../components/rides/RideDetailDialog'
import './Profil.css'

type RideMatchingStatus = 'idle' | 'waiting' | 'matched' | 'completed' | 'error'

function RideCta({
  role,
  currentRide,
  status,
}: {
  role: 'driver' | 'guest'
  currentRide: Ride | null
  status: RideMatchingStatus
}) {
  const navigate = useNavigate()

  if (status === 'waiting') {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">Suche Fahrer...</div>
        <div className="profil-radar">
          <div className="profil-radar__ring" />
          <div className="profil-radar__ring" />
          <div className="profil-radar__dot" />
        </div>
      </div>
    )
  }

  if (status === 'matched' && (currentRide?.status === 'pending' || currentRide?.status === 'arrived')) {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">{currentRide.status === 'arrived' ? 'Dein Fahrer ist am Abholort' : 'Dein Fahrer ist unterwegs'}</div>
        <div className="profil-arriving">
          <span className="profil-arriving__vehicle">🛺</span>
          <div className="profil-arriving__road" />
          <span className="profil-arriving__dest">📍</span>
        </div>
      </div>
    )
  }

  if (status === 'matched' && (currentRide?.status === 'picked_up' || currentRide?.status === 'active')) {
    return (
      <div className="profil-card profil-card--cta profil-card--live" onClick={() => navigate('/ride')}>
        <div className="profil-card__label">Fahrt läuft</div>
        <div className="profil-card__value profil-active">
          <span className="profil-active__dot" /> Genieße die Fahrt!
        </div>
      </div>
    )
  }

  return (
    <div className="profil-card profil-card--cta" onClick={() => navigate('/ride')}>
      <div className="profil-card__label">Bereit?</div>
      <div className="profil-card__value">{role === 'driver' ? 'Online gehen →' : 'Fahrt buchen →'}</div>
    </div>
  )
}

export default function Profil() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRides, setCompletedRides] = useState<Ride[]>([])
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number } | null>(null)
  const [rickshawTypes, setRickshawTypes] = useState<RickshawType[]>([])
  const [savingRickshaw, setSavingRickshaw] = useState(false)
  const [rickshawMessage, setRickshawMessage] = useState<string | null>(null)

  // Profile edit state
  const [editFirstName, setEditFirstName] = useState('')
  const [editFamilyName, setEditFamilyName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedRideId = searchParams.get('ride')
  const selectedRide = completedRides.find(r => r.id === selectedRideId) ?? null
  const [showAllRides, setShowAllRides] = useState(false)

  const RIDES_INITIAL = 4

  useEffect(() => {
    if (!user) return
    dbService.getUserProfile(user.id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else setProfile(data)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    dbService.getReviews(user.id).then(data => {
      if (data.length > 0) {
        const avg = data.reduce((s, r) => s + r.stars, 0) / data.length
        setReviewStats({ avg, count: data.length })
      } else {
        setReviewStats({ avg: 0, count: 0 })
      }
    })
  }, [user])

  useEffect(() => {
    const loadTypes = () => dbService.getRickshawTypes().then(setRickshawTypes)
    loadTypes()
    return realtimeService.subscribeRickshawTypes(loadTypes)
  }, [])

  useEffect(() => {
    if (!user || !profile) return
    const col = profile.role === 'driver' ? 'driver_id' : 'guest_id'
    dbService.getCompletedRides(user.id, col).then(data => setCompletedRides(data))
  }, [user, profile])

  useEffect(() => {
    if (profile) {
      setEditFirstName(profile.first_name ?? '')
      setEditFamilyName(profile.family_name ?? '')
    }
  }, [profile])

  const handleSaveProfile = async () => {
    if (!user || !profile) return
    setSavingProfile(true)
    setProfileMessage(null)
    const { error: err } = await dbService.updateUserProfile(user.id, editFirstName.trim(), editFamilyName.trim())
    if (err) {
      setProfileMessage({ type: 'error', text: err.message })
    } else {
      setProfile({ ...profile, first_name: editFirstName.trim(), family_name: editFamilyName.trim() })
      setProfileMessage({ type: 'success', text: 'Profil erfolgreich gespeichert!' })
    }
    setSavingProfile(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || !oldPassword) return
    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage({ type: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' })
      return
    }
    setSavingPassword(true)
    setPasswordMessage(null)
    const { error: err } = await authService.updatePassword(oldPassword, newPassword)
    if (err) {
      setPasswordMessage({ type: 'error', text: err })
    } else {
      setPasswordMessage({ type: 'success', text: 'Passwort erfolgreich geändert!' })
      setOldPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    }
    setSavingPassword(false)
  }

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.family_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  const fullName = profile
    ? `${profile.first_name ?? ''} ${profile.family_name ?? ''}`.trim()
    : '–'

  const userRole = profile?.role === 'driver' ? 'driver' : 'guest'
  const { currentRide, status: rideStatus } = useRideMatching(user?.id ?? '', userRole)
  const selectedRickshaw = rickshawTypes.find(type => type.id === profile?.rickshaw_type_id) ?? null
  const lockedRideStatuses: Ride['status'][] = ['pending', 'arrived', 'picked_up', 'active']
  const isRickshawLocked = profile?.role === 'driver'
    && rideStatus === 'matched'
    && !!currentRide
    && lockedRideStatuses.includes(currentRide.status)
  const bookedRickshaw = rickshawTypes.find(type => type.id === currentRide?.rickshaw_type_id) ?? null
  const rickshawSelectValue = isRickshawLocked && currentRide?.rickshaw_type_id
    ? currentRide.rickshaw_type_id
    : profile?.rickshaw_type_id ?? ''

  const handleRickshawChange = async (rickshawTypeId: string) => {
    if (!user || !profile) return
    if (isRickshawLocked) return
    setSavingRickshaw(true)
    setRickshawMessage(null)
    const { error: updateError } = await dbService.updateDriverRickshawType(user.id, rickshawTypeId)
    if (updateError) {
      setRickshawMessage(updateError.message)
    } else {
      setProfile({ ...profile, rickshaw_type_id: rickshawTypeId })
      setRickshawMessage('Gespeichert')
    }
    setSavingRickshaw(false)
  }

  return (
    <div className="profil">
      <section className="profil-hero">
        <div className="profil-hero__inner">
          <div className="profil-avatar">{loading ? '…' : initials}</div>
          <div className="profil-hero__info">
            {loading && <p className="profil-muted">Wird geladen...</p>}
            {error && <p className="profil-error">{error}</p>}
            {profile && (
              <>
                <h1 className="profil-hero__name">{fullName}</h1>
                <div className="profil-hero__meta">
                  <span className="profil-badge">
                    {profile.role === 'driver' ? '🚴 Fahrer' : '🛺 Gast'}
                  </span>
                  {profile.role === 'driver' && (
                    <span className={`profil-badge profil-badge--status ${profile.currently_working ? 'profil-badge--active' : ''}`}>
                      {profile.currently_working ? '● Aktiv' : '○ Inaktiv'}
                    </span>
                  )}
                  {profile.role === 'driver' && selectedRickshaw && (
                    <span className="profil-badge">
                      {selectedRickshaw.name}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {profile && (
        <section className="profil-content">
          <div className="profil-grid">
            <div className="profil-card">
              <div className="profil-card__label">Rolle</div>
              <div className="profil-card__value">
                {profile.role === 'driver' ? '🚴 Fahrer' : '🛺 Gast'}
              </div>
            </div>

            {profile.role === 'driver' && (
              <div className="profil-card">
                <div className="profil-card__label">Status</div>
                <div className="profil-card__value">
                  {profile.currently_working ? 'Aktiv' : 'Inaktiv'}
                </div>
              </div>
            )}

            {profile.role === 'driver' && (
              <div className="profil-card">
                <div className="profil-card__label">Rikschatyp</div>
                <RoundedSelect
                  className="profil-select"
                  value={rickshawSelectValue}
                  onChange={handleRickshawChange}
                  disabled={savingRickshaw || rickshawTypes.length === 0 || isRickshawLocked}
                  options={rickshawTypes.map(type => ({
                    value: type.id,
                    label: `${type.name} · ${type.capacity} Personen · ${type.price_per_km.toFixed(2).replace('.', ',')} €/km`,
                  }))}
                />
                {isRickshawLocked && (
                  <div className="profil-card__hint">
                    Gesperrt während der laufenden Fahrt. Gebucht: {bookedRickshaw?.name ?? selectedRickshaw?.name ?? 'Rikscha-Modell'}
                  </div>
                )}
                {rickshawMessage && <div className="profil-card__hint">{rickshawMessage}</div>}
              </div>
            )}

            <div className="profil-card">
              <div className="profil-card__label">Registriert seit</div>
              <div className="profil-card__value">
                {new Date(profile.created_at).toLocaleDateString('de-DE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </div>
            </div>

            <div className="profil-card">
              <div className="profil-card__label">Meine Bewertung</div>
              <div className="profil-card__value">
                {reviewStats === null ? (
                  <span className="profil-muted">…</span>
                ) : reviewStats.count > 0 ? (
                  <StarDisplay value={reviewStats.avg} count={reviewStats.count} />
                ) : (
                  <span className="profil-muted">Noch keine Bewertungen</span>
                )}
              </div>
            </div>

            {profile.role === 'driver' && (
              <div className="profil-card profil-card--cta" onClick={() => navigate('/einnahmen')}>
                <div className="profil-card__label">Einnahmen</div>
                <div className="profil-card__value">Aufschlüsselung →</div>
              </div>
            )}

            <RideCta role={userRole} currentRide={currentRide} status={rideStatus} />
          </div>

          {/* ─── Profil bearbeiten ─────────────────────── */}
          <div className="profil-edit">
            <h2 className="profil-edit__title">Profil bearbeiten</h2>
            <div className="profil-edit__form">
              <label className="profil-edit__label">
                Vorname
                <input
                  className="profil-edit__input"
                  type="text"
                  value={editFirstName}
                  onChange={e => setEditFirstName(e.target.value)}
                />
              </label>
              <label className="profil-edit__label">
                Nachname
                <input
                  className="profil-edit__input"
                  type="text"
                  value={editFamilyName}
                  onChange={e => setEditFamilyName(e.target.value)}
                />
              </label>
              <button
                className="profil-edit__btn"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Speichern…' : 'Speichern'}
              </button>
              {profileMessage && (
                <div className={`profil-edit__msg profil-edit__msg--${profileMessage.type}`}>
                  {profileMessage.text}
                </div>
              )}
            </div>
          </div>

          {/* ─── Passwort ändern ───────────────────────── */}
          <div className="profil-edit profil-edit--password">
            <h2 className="profil-edit__title">Passwort ändern</h2>
            <div className="profil-edit__form">
              <label className="profil-edit__label">
                Altes Passwort
                <input
                  className="profil-edit__input"
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="profil-edit__label">
                Neues Passwort
                <input
                  className="profil-edit__input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="profil-edit__label">
                Neues Passwort bestätigen
                <input
                  className="profil-edit__input"
                  type="password"
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <button
                className="profil-edit__btn"
                onClick={handleChangePassword}
                disabled={savingPassword || !oldPassword || !newPassword || !newPasswordConfirm}
              >
                {savingPassword ? 'Ändern…' : 'Passwort ändern'}
              </button>
              {passwordMessage && (
                <div className={`profil-edit__msg profil-edit__msg--${passwordMessage.type}`}>
                  {passwordMessage.text}
                </div>
              )}
            </div>
          </div>

          <div className="profil-rides">
            <h2 className="profil-rides__title">Abgeschlossene Fahrten</h2>
            {completedRides.length === 0 ? (
              <p className="profil-muted">Keine abgeschlossenen Fahrten.</p>
            ) : (
              <>
                <div className="profil-rides__grid">
                  {(showAllRides ? completedRides : completedRides.slice(0, RIDES_INITIAL)).map(ride => (
                    <RideTile
                      key={ride.id}
                      ride={ride}
                      userId={user!.id}
                      userRole={userRole}
                      onClick={() => setSearchParams({ ride: ride.id })}
                    />
                  ))}
                </div>
                {completedRides.length > RIDES_INITIAL && (
                  <button className="profil-rides__toggle" onClick={() => setShowAllRides(v => !v)}>
                    {showAllRides
                      ? 'Weniger anzeigen'
                      : `Alle ${completedRides.length} Fahrten anzeigen`}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {selectedRide && user && profile && (
        <RideDetailDialog
          ride={selectedRide}
          userId={user.id}
          userRole={userRole}
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  )
}
