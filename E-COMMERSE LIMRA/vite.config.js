import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  base: '/',
  root: fs.realpathSync.native(path.resolve('./')),
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        adminLogin: 'admin-login.html',
        privacy: 'privacy.html',
        table: 'table/index.html',
        qrAdmin: 'table/qr-admin.html',
        stockManager: 'stock-manager/index.html',
      },
    },
  },
})
