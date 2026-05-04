import { Router } from 'express'
import pool from '../db'

const router = Router()

// GET /stats — public, no auth required
router.get('/', async (_req, res) => {
  const { rows } = await pool.query<{
    completed_rides: string
    total_distance_km: string
    total_users: string
  }>('SELECT public.get_public_stats() AS s')

  if (!rows[0]) return res.status(500).json({ message: 'Stats unavailable' })

  const s = rows[0].s as unknown as {
    completed_rides: number
    total_distance_km: number
    total_users: number
  }
  res.json(s)
})

export default router
