import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './env'
import { attachAuth } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error'
import { announcementRouter } from './routes/announcements'
import { auditRouter } from './routes/audit'
import { authRouter } from './routes/auth'
import { coachRouter } from './routes/coaches'
import { dashboardRouter } from './routes/dashboard'
import { registrationRouter } from './routes/registrations'
import { attendanceRouter, sessionRouter } from './routes/sessions'
import { syncRouter } from './routes/sync'
import { transactionRouter } from './routes/transactions'
import { uploadRouter } from './routes/uploads'
import { landingRouter } from './routes/landing'
import { userRouter } from './routes/users'
import { uploadDir } from './lib/uploads'

export function createApp() {
  const app = express()

  // Di produksi (di belakang reverse proxy) agar IP klien terbaca benar.
  if (env.isProd) app.set('trust proxy', 1)

  // Keamanan dasar: header HTTP
  app.use(helmet())

  // Pembatasan laju permintaan umum
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa menit lagi.' },
  })
  app.use('/api', globalLimiter)

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

  // Berkas unggahan (bukti transaksi, foto coach) disajikan sebagai statis.
  app.use('/uploads', express.static(uploadDir()))

  app.use('/api/auth', authRouter)
  app.use('/api/users', userRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/announcements', announcementRouter)
  app.use('/api/coaches', coachRouter)
  app.use('/api/registrations', registrationRouter)
  app.use('/api/transactions', transactionRouter)
  app.use('/api/audit-logs', auditRouter)
  app.use('/api/uploads', uploadRouter)
  app.use('/api/landing', landingRouter)
  app.use('/api/sync', syncRouter)
  app.use('/api', dashboardRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
