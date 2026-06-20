import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  // Load .env from parent directory
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  
  return {
    plugins: [
      tailwindcss(),
      react(),
    ],
    server: {
      host: env.FRONTEND_HOST || '0.0.0.0',
      port: parseInt(env.FRONTEND_PORT || '5000'),
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://localhost:${env.BACKEND_PORT || '8000'}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
