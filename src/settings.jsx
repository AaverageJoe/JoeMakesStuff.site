import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { getFont } from './fonts'

const SettingsContext = createContext(null)

function applyFont(font) {
  const linkId = 'site-google-font'
  let link = document.getElementById(linkId)
  if (font.google) {
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  } else if (link) {
    link.remove()
  }
  document.documentElement.style.setProperty('--font-display', font.display)
  document.documentElement.style.setProperty('--font-body', font.body)
}

function applyFavicon(url) {
  const href = url || '/images/logo.png'
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

function applyBackground(color) {
  document.documentElement.style.setProperty('--bg', color || '#0b0c0e')
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setSettings(s))
      .catch(() => setSettings({}))
  }, [])

  useEffect(() => {
    if (!settings) return
    applyBackground(settings.background_color)
    applyFont(getFont(settings.font_family))
    applyFavicon(settings.favicon_url)
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings: settings || {}, refresh: () => api.getSettings().then(setSettings) }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
