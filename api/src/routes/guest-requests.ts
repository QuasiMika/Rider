import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { calculatePriceEur } from '../utils/pricing'

const router = Router()

// GET /guest-requests — driver sees all waiting (with price); guest sees own request
router.get('/', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId

  const { rows: profileRows } = await pool.query(
    'SELECT role FROM user_profile WHERE user_id = $1',
    [userId],
  )
  const role: string = profileRows[0]?.role ?? 'customer'

  if (role === 'driver') {
    const { rows } = await pool.query(
      `SELECT id, guest_id, created_at, pickup_location, destination, price_eur
         FROM guest_requests WHERE status = 'waiting'
         ORDER BY created_at ASC`,
    )
    return res.json(rows)
  }

  const { rows } = await pool.query(
    `SELECT id FROM guest_requests WHERE guest_id = $1 AND status = 'waiting' LIMIT 1`,
    [userId],
  )
  res.json(rows[0] ?? null)
})

// POST /guest-requests  { pickupLocation, destination }
// Price is calculated server-side before insert so drivers immediately see it.
router.post('/', requireAuth, async (req, res: Response) => {
  const guestId = (req as AuthRequest).userId
  const { pickupLocation, destination } = req.body
  if (!pickupLocation || !destination) {
    return res.status(400).json({ message: 'pickupLocation and destination required' })
  }
  if (pickupLocation.length > 255 || destination.length > 255) {
    return res.status(400).json({ message: 'Location strings too long' })
  }
  try {
    const price_eur = await calculatePriceEur(pickupLocation, destination)

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO guest_requests (guest_id, status, pickup_location, destination, price_eur)
       VALUES ($1, 'waiting', $2, $3, $4)
       RETURNING id`,
      [guestId, pickupLocation, destination, price_eur],
    )
    res.status(201).json({ id: rows[0].id, price_eur })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Insert failed'
    res.status(400).json({ message: msg })
  }
})

// DELETE /guest-requests — cancels own waiting request
router.delete('/', requireAuth, async (req, res: Response) => {
  const guestId = (req as AuthRequest).userId
  await pool.query(
    `DELETE FROM guest_requests WHERE guest_id = $1 AND status = 'waiting'`,
    [guestId],
  )
  res.json({ ok: true })
})

export default router
