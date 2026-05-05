import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthUser'
import { useResolvedNames } from '../hooks/useResolvedNames'
import { dbService } from '../services'
import type { ReportRow } from '../services'
import type { Ride } from '../types/ride'
import './ReportDetail.css'

export default function ReportDetail() {
  const { rideId } = useParams<{ rideId: string }>()
  const { user } = useAuth()

  const [report, setReport] = useState<ReportRow | null>(null)
  const [ride, setRide] = useState<Ride | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user || !rideId) return
    Promise.all([
      dbService.getReportDetail(rideId, user.id),
      dbService.getRideById(rideId),
    ]).then(([reportData, rideData]) => {
      if (!reportData) { setNotFound(true) }
      else { setReport(reportData); setRide(rideData) }
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
        <p className="report-detail__not-found">Keine Meldung gefunden.</p>
      </div>
    )
  }

  return (
    <div className="report-detail">
      <div className="report-detail__inner">
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
