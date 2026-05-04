import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /driver-availability/:driverId
router.get('/:driverId', requireAuth, async (req, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id FROM driver_availability WHERE driver_id = $1 LIMIT 1',
    [req.params.driverId],
  )
  res.json(rows[0] ?? null)
})

// POST /driver-availability — upsert own availability
router.post('/', requireAuth, async (req, res: Response) => {
  const driverId = (req as AuthRequest).userId
  try {
    const { rows } = await pool.query(
      `INSERT INTO driver_availability (driver_id, status)
       VALUES ($1, 'available')
       ON CONFLICT (driver_id) DO UPDATE SET status = 'available'
       RETURNING id`,
      [driverId],
    )
    res.status(201).json({ data: rows[0] ?? null, error: null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Insert failed'
    res.status(400).json({ data: null, error: { message } })
  }
})

export default router
