import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
import { paymentRouter } from './routes/payments'
import { userRouter } from './routes/users'
import { uploadDir } from './lib/uploads'

export function createApp() {
  const app = express()

  // Di produksi (di belakang reverse proxy) agar IP klien terbaca benar.
  if (env.isProd) app.set('trust proxy', 1)

  // Keamanan dasar: header HTTP
  app.use(helmet())

  // Pembatasan laju permintaan umum. Nonaktif secara default (API_RATE_LIMIT=0)
  // supaya pemakaian normal tidak pernah kena blokir sementara. Isi
  // API_RATE_LIMIT > 0 di .env bila ingin mengaktifkannya kembali.
  if (env.apiRateLimit > 0) {
    app.use(
      '/api',
      rateLimit({
        windowMs: env.rateLimitWindowMinutes * 60 * 1000,
        limit: env.apiRateLimit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa menit lagi.' },
      }),
    )
  }

  // Webhook DOKU perlu body MENTAH (untuk verifikasi HMAC), jadi route ini
  // dipasang express.raw SEBELUM express.json() global di bawah.
  app.use('/api/payments/doku/notification', express.raw({ type: '*/*', limit: '1mb' }))

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
  // H-02 + M-06: non-gambar (mis. PDF bukti) diatur sebagai lampiran/attachment
  // agar tidak punya pratinjau inline; semua file mendapat
  // `X-Content-Type-Options: nosniff` (dari helmet) supaya tidak ada MIME
  // sniffing yang memicu XSS.
  app.use(
    '/uploads',
    express.static(uploadDir(), {
      setHeaders(res, _filePath, _stat) {
        const name = path.basename(_filePath).toLowerCase()
        const isImage = /\.(png|jpe?g|webp|gif)$/i.test(name)
        if (!isImage) {
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(_filePath))}`,
          )
        }
        res.setHeader('Cache-Control', 'private, max-age=300')
      },
    }),
  )

  app.use('/api/auth', authRouter)
  app.use('/api/users', userRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/announcements', announcementRouter)
  app.use('/api/coaches', coachRouter)
  app.use('/api/registrations', registrationRouter)
  app.use('/api/payments', paymentRouter)
  app.use('/api/transactions', transactionRouter)
  app.use('/api/audit-logs', auditRouter)
  app.use('/api/uploads', uploadRouter)
  app.use('/api/landing', landingRouter)
  app.use('/api/sync', syncRouter)
  app.use('/api', dashboardRouter)

  // Sajikan frontend hasil build (dist/) bila ada. Diperlukan saat seluruh
  // permintaan domain diarahkan ke proses Node.js (mis. Hostinger Node.js),
  // sehingga rute SPA seperti /masuk tidak dibalas 404.
  const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist')
  if (existsSync(path.join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir, { index: false }))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
      res.sendFile(path.join(frontendDir, 'index.html'))
    })
  }

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
