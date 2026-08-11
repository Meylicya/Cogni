import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      strict: false // This allows App.jsx to read your files from the Dashboards folder!
    }
  }
})