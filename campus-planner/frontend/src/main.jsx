import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './lib/auth.jsx'
import { PrefsProvider } from './lib/prefs.jsx'
import { installDemo } from './lib/demo.js'
import './index.css'

if (import.meta.env.VITE_DEMO) installDemo()
else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
createRoot(document.getElementById('root')).render(
  <PrefsProvider><AuthProvider><App /></AuthProvider></PrefsProvider>
)
