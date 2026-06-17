import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..', // 루트 .env 사용
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