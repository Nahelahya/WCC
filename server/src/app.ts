import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { env } from './env'
import { attachAuth } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error'
import { announcementRouter } from './routes/announcements'
import { authRouter } from './routes/auth'
import { coachRouter } from './routes/coaches'
import { dashboardRouter } from './routes/dashboard'
import { registrationRouter } from './routes/registrations'
import { attendanceRouter, sessionRouter } from './routes/sessions'
import { syncRouter } from './routes/sync'
import { transactionRouter } from './routes/transactions'
import { userRouter } from './routes/users'

export function createApp() {
  const app = express()

  // Di produksi (di belakang reverse proxy) agar IP klien terbaca benar.
  if (env.isProd) app.set('trust proxy', 1)

  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true, // izinkan cookie lintas origin (dev: 5173 -> 4000)
    }),
  )

  // Verifikasi token (bila ada) untuk SEMUA request, lalu lanjut.
  app.use(attachAuth)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'wcc-server', time: new Date().toISOString() })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/users', userRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/announcements', announcementRouter)
  app.use('/api/coaches', coachRouter)
  app.use('/api/registrations', registrationRouter)
  app.use('/api/transactions', transactionRouter)
  app.use('/api/sync', syncRouter)
  app.use('/api', dashboardRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
