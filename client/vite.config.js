
/*
I'll keep the original commented in case if something will go wrong.

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
*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      strict: false // This allows App.jsx to read your files from the Dashboards folder!
    }
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision', '@ricky0123/vad-web']
  }
})
