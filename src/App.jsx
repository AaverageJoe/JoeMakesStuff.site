import { Suspense, lazy, useEffect } from 'react'
import { RouterProvider, useRouter } from './router'
import { SettingsProvider } from './settings'
import { ThemeProvider } from './theme'
import { CopyProvider } from './copy'
import { api } from './api'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'

// Lazy-loaded: only the homepage (the most common landing page) ships in the
// main bundle. Every other page is fetched on demand when the visitor
// actually navigates there.
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const TinyBuildsPage = lazy(() => import('./pages/TinyBuildsPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))

function Routes() {
  const { path } = useRouter()
  const workMatch = path.match(/^\/work\/([^/]+)\/?$/)

  useEffect(() => {
    api.trackPageview(path)
  }, [path])

  let page
  if (workMatch) page = <ProjectPage slug={decodeURIComponent(workMatch[1])} />
  else if (path === '/tiny-builds') page = <TinyBuildsPage />
  else if (path === '/services') page = <ServicesPage />
  else if (path === '/about') page = <AboutPage />
  else if (path === '/contact') page = <ContactPage />
  else page = <Home />

  return (
    <main>
      <Suspense fallback={null}>{page}</Suspense>
    </main>
  )
}

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <CopyProvider>
          <RouterProvider>
            <Header />
            <Routes />
            <Footer />
          </RouterProvider>
        </CopyProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default App
