import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /reports/:rideId  — own report for a ride
router.get('/:rideId', requireAuth, async (req, res: Response) => {
  const reporterId = (req as AuthRequest).userId
  const { detail } = req.query

  if (detail === 'false') {
    // existence check only
    const { rows } = await pool.query(
      'SELECT 1 FROM ride_reports WHERE ride_id = $1 AND reporter_id = $2 LIMIT 1',
      [req.params.rideId, reporterId],
    )
    return res.json({ exists: rows.length > 0 })
  }

  const { rows } = await pool.query(
    `SELECT id, notes, created_at FROM ride_reports
      WHERE ride_id = $1 AND reporter_id = $2 LIMIT 1`,
    [req.params.rideId, reporterId],
  )
  res.json(rows[0] ?? null)
})

// POST /reports  { rideId, notes? }
router.post('/', requireAuth, async (req, res: Response) => {
  const reporterId = (req as AuthRequest).userId
  const { rideId, notes } = req.body
  if (!rideId) return res.status(400).json({ message: 'rideId required' })
  try {
    await pool.query(
      `INSERT INTO ride_reports (ride_id, reporter_id, notes) VALUES ($1, $2, $3)`,
      [rideId, reporterId, notes ?? null],
    )
    res.status(201).json({ error: null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Insert failed'
    res.status(400).json({ error: { message } })
  }
})

export default router
