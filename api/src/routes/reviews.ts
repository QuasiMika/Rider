import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /reviews?revieweeId=...  — all reviews for a user
// GET /reviews?rideId=...&reviewerId=...  — single review lookup
router.get('/', requireAuth, async (req, res: Response) => {
  const { revieweeId, rideId, reviewerId } = req.query

  if (revieweeId) {
    const { rows } = await pool.query(
      'SELECT stars FROM ride_reviews WHERE reviewee_id = $1',
      [revieweeId],
    )
    return res.json(rows)
  }

  if (rideId && reviewerId) {
    const { rows } = await pool.query(
      'SELECT stars FROM ride_reviews WHERE ride_id = $1 AND reviewer_id = $2 LIMIT 1',
      [rideId, reviewerId],
    )
    return res.json(rows[0] ?? null)
  }

  res.status(400).json({ message: 'Provide revieweeId or both rideId and reviewerId' })
})

// POST /reviews  { rideId, revieweeId, stars }
router.post('/', requireAuth, async (req, res: Response) => {
  const reviewerId = (req as AuthRequest).userId
  const { rideId, revieweeId, stars } = req.body
  if (!rideId || !revieweeId || stars == null) {
    return res.status(400).json({ message: 'rideId, revieweeId and stars required' })
  }
  try {
    await pool.query(
      `INSERT INTO ride_reviews (ride_id, reviewer_id, reviewee_id, stars)
       VALUES ($1, $2, $3, $4)`,
      [rideId, reviewerId, revieweeId, stars],
    )
    res.status(201).json({ error: null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Insert failed'
    res.status(400).json({ error: { message } })
  }
})

export default router
