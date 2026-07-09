import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import plugin from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    react(),
    plugin(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
