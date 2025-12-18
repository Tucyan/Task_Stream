import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const message = event?.error?.stack || event?.error?.message || event?.message
    console.error('[WindowError]', message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const message = reason?.stack || reason?.message || String(reason)
    console.error('[UnhandledRejection]', message)
  })
  console.log('[AppBoot]', {
    origin: window.location?.origin,
    href: window.location?.href,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    mode: import.meta.env.MODE,
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
