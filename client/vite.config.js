import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Direct external imports from outside folders to the client's node_modules
      '@mediapipe/tasks-vision': path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision'),
      '@ricky0123/vad-web': path.resolve(__dirname, 'node_modules/@ricky0123/vad-web'),
    },
  },
  server: {
    fs: {
      strict: false,
      allow: ['..'], // Allows Vite to serve files from parent directories (e.g., /ML)
    },
  },
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision', '@ricky0123/vad-web'],
  },
});