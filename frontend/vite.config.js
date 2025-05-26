import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    port: 3501,
    host: true, // This allows external access
    proxy: {
      '/api': {
        target: 'http://82.29.164.109:3100',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
