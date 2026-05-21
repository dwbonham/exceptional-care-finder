import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VITE_BASE_PATH is injected by the GitHub Actions workflow as /<repo-name>/
// Vercel and local dev leave it unset, defaulting to '/'
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [tailwindcss(), react()],
})
