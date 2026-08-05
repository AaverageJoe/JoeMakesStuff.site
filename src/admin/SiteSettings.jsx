import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { FONT_OPTIONS } from '../fonts'

const DEFAULT_BG = '#0b0c0e'

export default function SiteSettings() {
  const [settings, setSettings] = useState(null)
  const [color, setColor] = useState(DEFAULT_BG)
  const [font, setFont] = useState('default')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s)
      setColor(s.background_color || DEFAULT_BG)
      setFont(s.font_family || 'default')
    })
  }, [])

  if (!settings) return <div className="admin-muted">Loading…</div>

  const dirty = color !== (settings.background_color || DEFAULT_BG) || font !== (settings.font_family || 'default')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const updated = await api.updateSettings({ background_color: color, font_family: font })
      setSettings(updated)
      setStatus('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setColor(DEFAULT_BG)
    setFont('default')
  }

  const handleAssetUpload = async (target, file) => {
    setError('')
    try {
      const { url } = await api.uploadSettingsAsset(target, file)
      setSettings((s) => ({ ...s, [target]: url }))
      setStatus(`Updated ${target === 'favicon_url' ? 'favicon' : 'hero background'}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAssetClear = async (target) => {
    setError('')
    try {
      const updated = await api.clearSettingsAsset(target)
      setSettings(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Site Settings</h1>
      <p className="admin-muted">
        These apply across the whole public site immediately after saving.
      </p>

      <div className="admin-editor-grid">
        <div className="admin-card">
          <h2 className="admin-section-title">Appearance</h2>

          <label className="admin-field">
            <span>Background colour</span>
            <div className="admin-color-row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#0b0c0e"
              />
            </div>
          </label>

          <label className="admin-field">
            <span>Font</span>
            <select value={font} onChange={(e) => setFont(e.target.value)}>
              {FONT_OPTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-save-row">
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button className="admin-btn admin-btn-ghost" onClick={handleReset} type="button">
              Reset to default
            </button>
            {status && <span className="admin-status-ok">{status}</span>}
            {error && <span className="admin-error">{error}</span>}
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-section-title">Branding</h2>

          <AssetSlot
            label="Favicon"
            hint="Square image, ideally 512×512 — shown in the browser tab."
            value={settings.favicon_url}
            onUpload={(file) => handleAssetUpload('favicon_url', file)}
            onClear={() => handleAssetClear('favicon_url')}
          />

          <AssetSlot
            label="Hero background (image or GIF)"
            hint="Shown full-bleed behind the landing page intro, dimmed for text legibility."
            value={settings.hero_bg_url}
            onUpload={(file) => handleAssetUpload('hero_bg_url', file)}
            onClear={() => handleAssetClear('hero_bg_url')}
          />
        </div>
      </div>
    </div>
  )
}

function AssetSlot({ label, hint, value, onUpload, onClear }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="admin-field">
      <span>{label}</span>
      <p className="admin-muted" style={{ margin: '0 0 10px' }}>
        {hint}
      </p>
      <div className="admin-image-preview" style={{ width: 160, marginBottom: 10 }}>
        {value ? <img src={value} alt="" /> : <span className="admin-muted">Default</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="admin-btn admin-btn-ghost admin-btn-small"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          type="button"
        >
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button className="admin-btn admin-btn-ghost admin-btn-small" onClick={onClear} type="button">
            Reset to default
          </button>
        )}
      </div>
    </div>
  )
}
