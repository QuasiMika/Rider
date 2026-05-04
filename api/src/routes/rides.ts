import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /rides/active?field=driver_id|guest_id
router.get('/active', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const field = req.query.field === 'driver_id' ? 'driver_id' : 'guest_id'
  const { rows } = await pool.query(
    `SELECT * FROM rides
      WHERE ${field} = $1
        AND status IN ('pending', 'picked_up', 'active')
      LIMIT 1`,
    [userId],
  )
  res.json(rows[0] ?? null)
})

// GET /rides/completed?field=driver_id|guest_id
router.get('/completed', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const field = req.query.field === 'driver_id' ? 'driver_id' : 'guest_id'
  const { rows } = await pool.query(
    `SELECT * FROM rides
      WHERE ${field} = $1
        AND status = 'completed'
      ORDER BY created_at DESC`,
    [userId],
  )
  res.json(rows)
})

// GET /rides/:rideId
router.get('/:rideId', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const { rows } = await pool.query(
    `SELECT * FROM rides
      WHERE id = $1
        AND (driver_id = $2 OR guest_id = $2)`,
    [req.params.rideId, userId],
  )
  if (!rows[0]) return res.status(404).json({ message: 'Ride not found' })
  res.json(rows[0])
})

// POST /rides/accept  { requestId }
router.post('/accept', requireAuth, async (req, res: Response) => {
  const driverId = (req as AuthRequest).userId
  const { requestId } = req.body
  if (!requestId) return res.status(400).json({ message: 'requestId required' })

  type RpcResult =
    | { accepted: true; ride_id: string; price_eur: number | null }
    | { accepted: false; reason: string }

  const { rows } = await pool.query<{ accept_ride: RpcResult }>(
    'SELECT public.accept_ride($1::uuid, $2::uuid) AS accept_ride',
    [driverId, requestId],
  )
  res.json(rows[0].accept_ride)
})

// POST /rides/:rideId/confirm-pickup — guest advances pending → picked_up
router.post('/:rideId/confirm-pickup', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const { rowCount } = await pool.query(
    `UPDATE rides SET status = 'picked_up'
      WHERE id = $1 AND guest_id = $2 AND status = 'pending'`,
    [req.params.rideId, userId],
  )
  if (!rowCount) return res.status(400).json({ message: 'Pickup could not be confirmed' })
  res.json({ ok: true })
})

// POST /rides/:rideId/complete  { location }  — driver advances picked_up → completed
router.post('/:rideId/complete', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const location: string = req.body.location ?? ''
  const { rowCount } = await pool.query(
    `UPDATE rides
        SET status = 'completed',
            actual_end_location = NULLIF($3, '')
      WHERE id = $1 AND driver_id = $2 AND status = 'picked_up'`,
    [req.params.rideId, userId, location],
  )
  if (!rowCount) return res.status(400).json({ message: 'Ride could not be completed' })
  res.json({ ok: true })
})

export default router
