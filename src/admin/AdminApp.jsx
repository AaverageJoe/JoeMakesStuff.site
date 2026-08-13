import { useEffect, useState } from 'react'
import { api } from '../api'
import Login from './Login'
import ProjectList from './ProjectList'
import ProjectEditor from './ProjectEditor'
import TinyBuildsAdmin from './TinyBuildsAdmin'
import ServicesAdmin from './ServicesAdmin'
import SiteSettings from './SiteSettings'
import SiteCopyAdmin from './SiteCopyAdmin'
import CrowdIdeasAdmin from './CrowdIdeasAdmin'
import ChangePassword from './ChangePassword'
import './admin.css'

const TABS = [
  { key: 'projects', label: 'Projects' },
  { key: 'tiny-builds', label: 'Tiny Builds' },
  { key: 'services', label: 'Services' },
  { key: 'copy', label: 'Site Copy' },
  { key: 'crowd-ideas', label: 'Crowd Ideas' },
  { key: 'settings', label: 'Site Settings' },
]

export default function AdminApp() {
  const [authState, setAuthState] = useState('checking') // checking | out | in
  const [username, setUsername] = useState('')
  const [view, setView] = useState('projects')
  const [activeSlug, setActiveSlug] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    api
      .me()
      .then((res) => {
        if (res.authenticated) {
          setUsername(res.username)
          setAuthState('in')
        } else {
          setAuthState('out')
        }
      })
      .catch(() => setAuthState('out'))
  }, [])

  const handleLogout = async () => {
    await api.logout()
    setAuthState('out')
    setActiveSlug(null)
  }

  if (authState === 'checking') {
    return <div className="admin-shell admin-loading">Loading…</div>
  }

  if (authState === 'out') {
    return (
      <div className="admin-shell">
        <Login
          onSuccess={(name) => {
            setUsername(name)
            setAuthState('in')
          }}
        />
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <a className="admin-brand" href="/">
            Joe.MakesStuff <span>Admin</span>
          </a>
          <nav className="admin-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`admin-tab ${view === tab.key ? 'active' : ''}`}
                onClick={() => {
                  setView(tab.key)
                  if (tab.key !== 'projects') setActiveSlug(null)
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="admin-header-right">
            <span className="admin-username">{username}</span>
            <button className="admin-btn admin-btn-ghost" onClick={() => setShowPasswordModal(true)}>
              Change password
            </button>
            <button className="admin-btn admin-btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {view === 'settings' && <SiteSettings />}
        {view === 'copy' && <SiteCopyAdmin />}
        {view === 'crowd-ideas' && <CrowdIdeasAdmin />}
        {view === 'tiny-builds' && <TinyBuildsAdmin />}
        {view === 'services' && <ServicesAdmin />}
        {view === 'projects' &&
          (activeSlug ? (
            <ProjectEditor slug={activeSlug} onBack={() => setActiveSlug(null)} />
          ) : (
            <ProjectList onSelect={setActiveSlug} />
          ))}
      </main>

      {showPasswordModal && <ChangePassword onClose={() => setShowPasswordModal(false)} />}
    </div>
  )
}
