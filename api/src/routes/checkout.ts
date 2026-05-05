import { Router, Response } from 'express'
import Stripe from 'stripe'
import pool from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /checkout  { ride_id }
// Creates a Stripe Checkout session for the authenticated guest.
router.post('/', requireAuth, async (req, res: Response) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return res.status(503).json({ message: 'Stripe not configured' })

  const guestId = (req as AuthRequest).userId
  const { ride_id } = req.body
  if (!ride_id) return res.status(400).json({ message: 'ride_id required' })

  try {
    const { rows } = await pool.query(
      `SELECT id, guest_id, pickup_location, destination, status, price_eur
         FROM rides WHERE id = $1`,
      [ride_id],
    )
    const ride = rows[0]
    if (!ride) return res.status(404).json({ message: 'Fahrt nicht gefunden' })
    if (ride.guest_id !== guestId) return res.status(403).json({ message: 'Forbidden' })
    if (!ride.price_eur) return res.status(422).json({ message: 'Preis nicht verfügbar' })

    const stripe = new Stripe(stripeKey)
    const origin = (req.headers.origin as string | undefined)
      ?? process.env.CORS_ORIGIN
      ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Rider — Fahrt in Konstanz',
            description: `Fahrt-ID ${(ride_id as string).slice(0, 8)}`,
          },
          unit_amount: Math.round(ride.price_eur * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/#/ride?payment=success`,
      cancel_url: `${origin}/#/ride`,
      metadata: { ride_id },
    })

    res.json({ url: session.url, amount_eur: ride.price_eur })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    res.status(500).json({ message })
  }
})

export default router
