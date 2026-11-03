import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { FONT_OPTIONS } from '../fonts'

const DEFAULT_BG = '#0b0c0e'

const DEFAULT_LOOP = true
const DEFAULT_OPACITY = 0.4

const ASSET_LABELS = {
  favicon_url: 'favicon',
  hero_bg_url: 'hero background',
  hero_banner_video_url: 'hero banner video',
}

export default function SiteSettings() {
  const [settings, setSettings] = useState(null)
  const [color, setColor] = useState(DEFAULT_BG)
  const [font, setFont] = useState('default')
  const [loop, setLoop] = useState(DEFAULT_LOOP)
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s)
      setColor(s.background_color || DEFAULT_BG)
      setFont(s.font_family || 'default')
      setLoop(s.hero_banner_loop == null ? DEFAULT_LOOP : !!s.hero_banner_loop)
      setOpacity(s.hero_banner_opacity ?? DEFAULT_OPACITY)
    })
  }, [])

  if (!settings) return <div className="admin-muted">Loading…</div>

  const dirty =
    color !== (settings.background_color || DEFAULT_BG) ||
    font !== (settings.font_family || 'default') ||
    loop !== (settings.hero_banner_loop == null ? DEFAULT_LOOP : !!settings.hero_banner_loop) ||
    opacity !== (settings.hero_banner_opacity ?? DEFAULT_OPACITY)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const updated = await api.updateSettings({
        background_color: color,
        font_family: font,
        hero_banner_loop: loop,
        hero_banner_opacity: opacity,
      })
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
    setLoop(DEFAULT_LOOP)
    setOpacity(DEFAULT_OPACITY)
  }

  const handleAssetUpload = async (target, file) => {
    setError('')
    try {
      const { url } = await api.uploadSettingsAsset(target, file)
      setSettings((s) => ({ ...s, [target]: url }))
      setStatus(`Updated ${ASSET_LABELS[target] || target}.`)
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
            hint="Shown full-bleed behind the landing page intro, dimmed for text legibility. Ignored while a hero banner video is set below."
            value={settings.hero_bg_url}
            onUpload={(file) => handleAssetUpload('hero_bg_url', file)}
            onClear={() => handleAssetClear('hero_bg_url')}
          />
        </div>

        <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="admin-section-title">Hero Banner Video</h2>
          <p className="admin-muted" style={{ marginTop: -8 }}>
            Plays behind the "Joe.MakesStuff" signature on the landing page, dimmed down so the logo and
            text stay readable on top of it. Takes over from the hero background image above while set.
          </p>

          <AssetSlot
            label="Banner video"
            hint="MP4 or WebM recommended. Plays muted and silent automatically — audio is never heard."
            kind="video"
            value={settings.hero_banner_video_url}
            onUpload={(file) => handleAssetUpload('hero_banner_video_url', file)}
            onClear={() => handleAssetClear('hero_banner_video_url')}
          />

          <label className="admin-field admin-checkbox-field">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            <span>Loop playback</span>
          </label>

          <label className="admin-field">
            <span>Opacity ({Math.round(opacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>

          <div className="admin-save-row">
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {status && <span className="admin-status-ok">{status}</span>}
            {error && <span className="admin-error">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AssetSlot({ label, hint, value, onUpload, onClear, kind = 'image' }) {
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
        {value ? (
          kind === 'video' ? (
            <video src={value} muted loop playsInline autoPlay />
          ) : (
            <img src={value} alt="" />
          )
        ) : (
          <span className="admin-muted">Default</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept={kind === 'video' ? 'video/*' : 'image/*'} hidden onChange={handleFile} />
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
