import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// A dynamic import (not a static one) so Vite puts App, AdminApp, and
// DashboardApp in separate chunks — public visitors never download the
// admin panel's or rack dashboard's code, and vice versa. Which one loads
// is already known synchronously from the URL, so there's no need for
// React.lazy/Suspense here.
const { pathname } = window.location
const modulePromise = pathname.startsWith('/admin')
  ? import('./admin/AdminApp.jsx')
  : pathname.startsWith('/dashboard')
  ? import('./dashboard/DashboardApp.jsx')
  : import('./App.jsx')

modulePromise.then(({ default: RootComponent }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <RootComponent />
    </StrictMode>,
  )
})
