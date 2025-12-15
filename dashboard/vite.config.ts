import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    // Allow Railway (and any other) hosts to access the preview server
    // so we don't get "host is not allowed" errors in production.
    allowedHosts: true,
  },
})

