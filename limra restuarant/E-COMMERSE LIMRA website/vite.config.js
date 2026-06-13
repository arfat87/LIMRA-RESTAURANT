import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        adminLogin: 'admin-login.html',
        table: 'table/index.html',
        qrAdmin: 'table/qr-admin.html',
      },
    },
  },
})
