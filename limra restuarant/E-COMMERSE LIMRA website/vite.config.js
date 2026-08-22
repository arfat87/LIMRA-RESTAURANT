import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function apiMiddlewarePlugin() {
  return {
    name: 'mongodb-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname.replace(/\/+$/, '');

        let body = {};
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString();
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = raw;
            }
          }
        }

        const mockRes = {
          statusCode: 200,
          setHeader: (k, v) => res.setHeader(k, v),
          getHeader: (k) => res.getHeader(k),
          status(code) {
            res.statusCode = code;
            return this;
          },
          json(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return this;
          },
          send(data) {
            res.end(typeof data === 'string' ? data : JSON.stringify(data));
            return this;
          },
          end(data) {
            res.end(data);
            return this;
          }
        };

        const mockReq = {
          method: req.method,
          url: req.url,
          query: Object.fromEntries(url.searchParams.entries()),
          body,
          headers: req.headers
        };

        try {
          if (pathname === '/api/db') {
            const { default: handler } = await import('./api/db.js');
            return handler(mockReq, mockRes);
          }
          if (pathname === '/api/orders') {
            const { default: handler } = await import('./api/orders.js');
            return handler(mockReq, mockRes);
          }
          if (pathname === '/api/menu') {
            const { default: handler } = await import('./api/menu.js');
            return handler(mockReq, mockRes);
          }
          if (pathname === '/api/db-status') {
            const { default: handler } = await import('./api/db-status.js');
            return handler(mockReq, mockRes);
          }
          if (pathname === '/api/verify-payment') {
            const { default: handler } = await import('./api/verify-payment.js');
            return handler(mockReq, mockRes);
          }
        } catch (err) {
          console.error('[Vite API Middleware Error]:', err);
          return mockRes.status(500).json({ error: err.message });
        }

        next();
      });
    }
  };
}

export default defineConfig({
  root: fs.realpathSync.native(path.resolve('./')),
  plugins: [
    tailwindcss(),
    apiMiddlewarePlugin()
  ],
  build: {
    chunkSizeWarningLimit: 2000,
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
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) return 'vendor-chart';
            if (id.includes('qrcode')) return 'vendor-qr';
            return 'vendor';
          }
        }
      }
    },
  },
})
