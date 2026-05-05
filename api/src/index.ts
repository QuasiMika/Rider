import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import pool from './db'

import usersRouter from './routes/users'
import ridesRouter from './routes/rides'
import guestRequestsRouter from './routes/guest-requests'
import driverAvailabilityRouter from './routes/driver-availability'
import reviewsRouter from './routes/reviews'
import reportsRouter from './routes/reports'
import statsRouter from './routes/stats'
import checkoutRouter from './routes/checkout'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json())

app.use('/users', usersRouter)
app.use('/rides', ridesRouter)
app.use('/guest-requests', guestRequestsRouter)
app.use('/driver-availability', driverAvailabilityRouter)
app.use('/reviews', reviewsRouter)
app.use('/reports', reportsRouter)
app.use('/stats', statsRouter)
app.use('/checkout', checkoutRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

// Global error handler — catches any error passed to next(err) or thrown in async routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[error]', err)
  res.status(500).json({ message })
})

pool.connect()
  .then(client => { client.release(); console.log('Postgres connected') })
  .catch(err => { console.error('Postgres connection failed:', err.message); process.exit(1) })

app.listen(PORT, () => console.log(`API listening on port ${PORT}`))

export default app
