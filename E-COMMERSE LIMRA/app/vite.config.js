import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // Local paths for absolute compatibility with native hybrid environments (Capacitor/Cordova)
  server: {
    port: 5174
  }
})
