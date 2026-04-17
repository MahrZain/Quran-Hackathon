import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api/* to FastAPI unchanged (routes are /api/v1/...). Do not rewrite away /api.
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
