import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../auth/AuthUser'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { supabase } from '../utils/supabase'
import type { Ride } from '../types/ride'
import './ReportDetail.css'

type Report = {
  id: string
  notes: string | null
  created_at: string
}

export default function ReportDetail() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [report, setReport] = useState<Report | null>(null)
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user || !rideId) return
    Promise.all([
      supabase
        .from('ride_reports')
        .select('id, notes, created_at')
        .eq('ride_id', rideId)
        .eq('reporter_id', user.id)
        .maybeSingle(),
      supabase
        .from('rides')
        .select('id, driver_id, guest_id, status, pickup_location, destination, actual_end_location, created_at')
        .eq('id', rideId)
        .maybeSingle(),
    ]).then(([reportRes, rideRes]) => {
      if (!reportRes.data) { setNotFound(true) }
      else { setReport(reportRes.data); setRide(rideRes.data as Ride | null) }
      setLoading(false)
    })
  }, [user, rideId])

  const { pickupName, destName } = useResolvedNames(
    rideId ?? '',
    ride?.pickup_location,
    ride?.destination,
  )
  const { pickupName: actualEndName } = useResolvedNames(
    (rideId ?? '') + '-end',
    ride?.actual_end_location,
    undefined,
  )

  const destinationDiffers =
    !!ride?.actual_end_location && ride.actual_end_location !== ride.destination

  if (loading) return null

  if (notFound) {
    return (
      <div className="report-detail">
        <button className="report-detail__back" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} /> Zurück
        </button>
        <p className="report-detail__not-found">Keine Meldung gefunden.</p>
      </div>
    )
  }

  return (
    <div className="report-detail">
      <button className="report-detail__back" onClick={() => navigate(-1)}>
        <FontAwesomeIcon icon={faArrowLeft} /> Zurück
      </button>

      <div className="report-detail__inner">
        {/* Status banner */}
        <div className="report-detail__banner">
          <span className="report-detail__banner-icon">🔍</span>
          <div>
            <div className="report-detail__banner-title">Wir gehen diesem Fall nach</div>
            <div className="report-detail__banner-sub">
              Deine Meldung wurde am{' '}
              {report && new Date(report.created_at).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}{' '}
              um{' '}
              {report && new Date(report.created_at).toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit',
              })}{' '}
              Uhr eingereicht.
            </div>
          </div>
        </div>

        {/* Route */}
        <div className="report-detail__card">
          <h2 className="report-detail__section-title">Fahrt</h2>
          {ride && (
            <div className="report-detail__meta-date">
              {new Date(ride.created_at).toLocaleDateString('de-DE', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
            </div>
          )}
          <div className="report-detail__route">
            <div className="report-detail__loc">
              <span className="report-detail__dot report-detail__dot--from" />
              <div>
                <div className="report-detail__loc-label">Von</div>
                <div className="report-detail__loc-value">{pickupName || '–'}</div>
              </div>
            </div>
            <div className="report-detail__line" />
            <div className="report-detail__loc">
              <span className="report-detail__dot report-detail__dot--to" />
              <div>
                <div className="report-detail__loc-label">Geplantes Ziel</div>
                <div className="report-detail__loc-value">{destName || '–'}</div>
              </div>
            </div>
            {destinationDiffers && (
              <>
                <div className="report-detail__line" />
                <div className="report-detail__loc">
                  <span className="report-detail__dot report-detail__dot--reported" />
                  <div>
                    <div className="report-detail__loc-label">Tatsächliches Ende</div>
                    <div className="report-detail__loc-value">{actualEndName || '–'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="report-detail__card">
          <h2 className="report-detail__section-title">Deine Anmerkungen</h2>
          {report?.notes ? (
            <p className="report-detail__notes">{report.notes}</p>
          ) : (
            <p className="report-detail__notes report-detail__notes--empty">Keine Anmerkungen angegeben.</p>
          )}
        </div>
      </div>
    </div>
  )
}
