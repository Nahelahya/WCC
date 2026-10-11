/**
 * Entry point untuk Hostinger Node.js hosting.
 * Menjalankan backend Express dari folder server/ sambil tetap melayani
 * frontend yang di-build di root dist/.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const serverDir = path.join(__dirname, 'server')

const child = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('Gagal menjalankan backend Hostinger:', error)
  process.exit(1)
})
