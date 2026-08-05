import { RouterProvider, useRouter } from './router'
import { SettingsProvider } from './settings'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import TinyBuildsPage from './pages/TinyBuildsPage'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'

function Routes() {
  const { path } = useRouter()
  const workMatch = path.match(/^\/work\/([^/]+)\/?$/)

  let page
  if (workMatch) page = <ProjectPage slug={decodeURIComponent(workMatch[1])} />
  else if (path === '/tiny-builds') page = <TinyBuildsPage />
  else if (path === '/services') page = <ServicesPage />
  else if (path === '/about') page = <AboutPage />
  else if (path === '/contact') page = <ContactPage />
  else page = <Home />

  return <main>{page}</main>
}

function App() {
  return (
    <SettingsProvider>
      <RouterProvider>
        <Header />
        <Routes />
        <Footer />
      </RouterProvider>
    </SettingsProvider>
  )
}

export default App
