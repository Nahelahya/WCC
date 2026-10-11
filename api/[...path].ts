/**
 * Vercel serverless function - catch-all API handler.
 * Semua request /api/* diarahkan ke Express app.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

let app: any = null

async function getApp() {
  if (!app) {
    const { createApp } = await import('../server/src/app')
    app = createApp()
  }
  return app
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = await getApp()
  return expressApp(req, res)
}
