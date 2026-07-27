import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  base: '/finance/',
  build: {
    outDir: path.resolve(__dirname, '../dist/finance'),
    emptyOutDir: true
  }
})
