import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1F2937',
          color: '#fff',
          border: '1px solid #374151',
          borderRadius: '0.75rem',
        },
      }}
    />
  </StrictMode>,
)
