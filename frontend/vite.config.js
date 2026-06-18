import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:3000'),
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://node:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})