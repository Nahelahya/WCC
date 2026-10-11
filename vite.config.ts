import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Memetakan "@/..." ke folder src (sama dengan "paths" pada tsconfig.json).
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      // Meneruskan /api ke backend Express (folder server/) sehingga cookie
      // sesi bersifat same-origin — tidak perlu konfigurasi CORS saat dev.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Berkas unggahan (bukti transaksi & foto coach) juga dilayani backend.
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
