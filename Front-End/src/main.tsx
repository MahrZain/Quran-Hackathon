import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import { App } from './App'

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  const host = window.location.hostname
  const isLocalhost = host === 'localhost' || host === '127.0.0.1'
  if (!import.meta.env.PROD && !isLocalhost) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore registration errors (e.g. unsupported context) */
    })
  })
}

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
