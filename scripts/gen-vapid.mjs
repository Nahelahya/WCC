#!/usr/bin/env node
// Helper: generate VAPID keys untuk Web Push.
// Jalankan: node scripts/gen-vapid.mjs
// Salin nilai yang dicetak ke .env (server) / hPanel.

import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log('# ---- Web Push (VAPID) ----')
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:no-reply@wcc.id')
console.log('')
console.log('# (opsional) ganti subject dengan PUBLIC_APP_URL jika HTTPS, mis.:')
console.log('# VAPID_SUBJECT=https://domain-anda.tld')