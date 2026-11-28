import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // '@/…' → 'src/…' (то же правило — в tsconfig.app.json, paths)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // VITE_API_MODE=http: /api/* уходит на сервер «Линия» (backend/, по умолчанию :8080) — без CORS и с телефона по http://<ip>:5173
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080',
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
