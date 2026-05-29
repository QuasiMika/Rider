import { Router } from 'express'
import pool from '../db'

const router = Router()

// GET /stats — public, no auth required
router.get('/', async (_req, res) => {
  const { rows } = await pool.query<{
    s: {
      completed_rides: number
      total_distance_km: number
      total_users: number
    }
  }>('SELECT public.get_public_stats() AS s')

  if (!rows[0]) return res.status(500).json({ message: 'Stats unavailable' })

  res.json(rows[0].s)
})

export default router
