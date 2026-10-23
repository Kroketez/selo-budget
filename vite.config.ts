import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // Run `npm run server` alongside `npm run dev` to save to the database.
    // Without it the app falls back to browser storage.
    proxy: process.env.API_URL ? { '/api': process.env.API_URL } : undefined,
  },
})
