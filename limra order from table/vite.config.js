import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'index.html'),
        table:     resolve(__dirname, 'table.html'),
        status:    resolve(__dirname, 'order-status.html'),
        adminLogin:resolve(__dirname, 'admin/index.html'),
        dashboard: resolve(__dirname, 'admin/dashboard.html'),
        orders:    resolve(__dirname, 'admin/orders.html'),
        tables:    resolve(__dirname, 'admin/tables.html'),
        kitchen:   resolve(__dirname, 'admin/kitchen.html'),
        billing:   resolve(__dirname, 'admin/billing.html'),
        menu:      resolve(__dirname, 'admin/menu.html'),
        reports:   resolve(__dirname, 'admin/reports.html'),
        settings:  resolve(__dirname, 'admin/settings.html'),
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
