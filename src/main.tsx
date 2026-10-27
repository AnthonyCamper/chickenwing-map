import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { registerServiceWorker } from './lib/pushManager'
import './index.css'

// Register service worker for push notifications
registerServiceWorker()

// Any photo that fails to load (deleted file, corrupt upload, dead URL) is
// hidden instead of showing the browser's broken-image icon and alt text;
// its frame's background shows through. Components with a nicer fallback
// (AvatarImage, feed cards) handle onError themselves first.
document.addEventListener('error', e => {
  const el = e.target
  if (el instanceof HTMLImageElement) el.classList.add('img-broken')
}, true)
// …and shown again if the same element later loads a working src.
document.addEventListener('load', e => {
  const el = e.target
  if (el instanceof HTMLImageElement) el.classList.remove('img-broken')
}, true)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)
