import { Router, Response } from 'express'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /users/me — own profile
router.get('/me', requireAuth, async (req, res: Response) => {
  const userId = (req as AuthRequest).userId
  const { rows } = await pool.query(
    `SELECT user_id, first_name, family_name, role, currently_working, created_at
       FROM user_profile WHERE user_id = $1`,
    [userId],
  )
  if (!rows[0]) return res.status(404).json({ message: 'Profile not found' })
  res.json(rows[0])
})

// GET /users/:userId — any profile (authenticated)
router.get('/:userId', requireAuth, async (req, res: Response) => {
  const { rows } = await pool.query(
    `SELECT user_id, first_name, family_name, role, currently_working, created_at
       FROM user_profile WHERE user_id = $1`,
    [req.params.userId],
  )
  if (!rows[0]) return res.status(404).json({ message: 'Profile not found' })
  res.json(rows[0])
})

// GET /users?ids=id1,id2,... — batch basic profiles
router.get('/', requireAuth, async (req, res: Response) => {
  const ids = String(req.query.ids ?? '').split(',').filter(Boolean)
  if (!ids.length) return res.json([])
  const { rows } = await pool.query(
    `SELECT user_id, first_name, family_name
       FROM user_profile WHERE user_id = ANY($1::uuid[])`,
    [ids],
  )
  res.json(rows)
})

export default router
