import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy all API calls to the backend server
      // You can change this to http://localhost:5000 for local development
      // or keep it as Fly.io for testing against production
      '/api': {
        target: process.env.VITE_API_TARGET || 'https://somnoviz-backend1.fly.dev',
        changeOrigin: true,
        secure: true,
        // Add timeout for development
        timeout: 600000, // 10 minutes
      }
    }
  }
})
