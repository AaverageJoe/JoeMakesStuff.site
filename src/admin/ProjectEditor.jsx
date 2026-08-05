import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

const TEXT_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'client', label: 'Client', type: 'text' },
  { key: 'project_type', label: 'Project Type', type: 'text' },
  { key: 'sort_order', label: 'Sort order (lower = earlier in grid)', type: 'number' },
  { key: 'intro1', label: 'Intro — paragraph 1', type: 'textarea' },
  { key: 'intro2', label: 'Intro — paragraph 2', type: 'textarea' },
  { key: 'dev_heading', label: 'Build section — heading', type: 'text' },
  { key: 'dev_message', label: 'Build section — copy', type: 'textarea' },
  { key: 'outcomes_title', label: 'Outcome section — heading', type: 'text' },
  { key: 'outcomes_message', label: 'Outcome section — copy', type: 'textarea' },
  { key: 'youtube_url', label: 'YouTube video link', type: 'text' },
]

const IMAGE_FIELDS = [
  { key: 'banner_poster', label: 'Banner (still / poster)', kind: 'image' },
  { key: 'banner_video', label: 'Banner (video, plays on loop)', kind: 'video' },
  { key: 'showcase_image', label: 'Grid thumbnail', kind: 'image' },
  { key: 'dev1_image', label: 'Build image 1', kind: 'image' },
  { key: 'dev2_image', label: 'Build image 2', kind: 'image' },
  { key: 'dev3_image', label: 'Build image 3', kind: 'image' },
  { key: 'dev_video_poster', label: 'Build video (poster)', kind: 'image' },
  { key: 'dev_video', label: 'Build video', kind: 'video' },
]

export default function ProjectEditor({ slug, onBack }) {
  const [project, setProject] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getProject(slug).then((p) => {
      setProject(p)
      setForm(p)
    })
  }, [slug])

  if (!form) return <div className="admin-muted">Loading…</div>

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const changed = {}
      for (const { key } of TEXT_FIELDS) {
        if (form[key] !== project[key]) changed[key] = form[key]
      }
      if (Object.keys(changed).length > 0) {
        const updated = await api.updateProject(slug, changed)
        setProject(updated)
        setForm(updated)
      }
      setStatus('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (target, file) => {
    setError('')
    try {
      const { url } = await api.uploadImage(slug, target, file)
      setProject((p) => ({ ...p, [target]: url }))
      setForm((f) => ({ ...f, [target]: url }))
      setStatus(`Updated ${target}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddGalleryImage = async (file) => {
    setError('')
    try {
      const item = await api.addGalleryImage(slug, file)
      setProject((p) => ({ ...p, gallery: [...(p.gallery || []), item] }))
      setForm((f) => ({ ...f, gallery: [...(f.gallery || []), item] }))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteGalleryImage = async (id) => {
    setError('')
    try {
      await api.deleteGalleryImage(slug, id)
      setProject((p) => ({ ...p, gallery: p.gallery.filter((g) => g.id !== id) }))
      setForm((f) => ({ ...f, gallery: f.gallery.filter((g) => g.id !== id) }))
    } catch (err) {
      setError(err.message)
    }
  }

  const dirty = TEXT_FIELDS.some(({ key }) => form[key] !== project[key])

  return (
    <div>
      <button className="admin-btn admin-btn-ghost admin-back" onClick={onBack}>
        ← All projects
      </button>

      <div className="admin-editor-head">
        <h1 className="admin-page-title">{project.title}</h1>
        <a className="admin-btn admin-btn-ghost" href="/#work" target="_blank" rel="noreferrer">
          View live site
        </a>
      </div>

      <div className="admin-editor-grid">
        <div className="admin-card">
          <h2 className="admin-section-title">Content</h2>
          {TEXT_FIELDS.map(({ key, label, type }) => (
            <label className="admin-field" key={key}>
              <span>{label}</span>
              {type === 'textarea' ? (
                <textarea
                  rows={4}
                  value={form[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              ) : (
                <input
                  type={type}
                  value={form[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              )}
            </label>
          ))}

          <div className="admin-save-row">
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {status && <span className="admin-status-ok">{status}</span>}
            {error && <span className="admin-error">{error}</span>}
          </div>
        </div>

        <div>
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <h2 className="admin-section-title">Images &amp; video</h2>
            <div className="admin-image-grid">
              {IMAGE_FIELDS.map((field) => (
                <ImageSlot
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  onUpload={(file) => handleUpload(field.key, file)}
                />
              ))}
            </div>
          </div>

          <div className="admin-card">
            <h2 className="admin-section-title">
              Gallery ({(form.gallery || []).length})
            </h2>
            <GalleryGrid
              items={form.gallery || []}
              onAdd={handleAddGalleryImage}
              onDelete={handleDeleteGalleryImage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function GalleryGrid({ items, onAdd, onDelete }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onAdd(file)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="admin-gallery-grid">
      {items.map((item) => (
        <div className="admin-gallery-item" key={item.id}>
          <img src={item.url} alt="" />
          <button
            className="admin-gallery-delete"
            onClick={() => onDelete(item.id)}
            aria-label="Delete image"
            type="button"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        className="admin-gallery-add"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        type="button"
      >
        {uploading ? '…' : '+ Add'}
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />
    </div>
  )
}

function ImageSlot({ field, value, onUpload }) {
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
    <div className="admin-image-slot">
      <div className="admin-image-preview">
        {value ? (
          field.kind === 'video' ? (
            <video src={value} muted loop autoPlay playsInline />
          ) : (
            <img src={value} alt="" />
          )
        ) : (
          <span className="admin-muted">Empty</span>
        )}
      </div>
      <div className="admin-image-slot-label">{field.label}</div>
      <input
        ref={inputRef}
        type="file"
        accept={field.kind === 'video' ? 'video/*' : 'image/*'}
        hidden
        onChange={handleFile}
      />
      <button
        className="admin-btn admin-btn-ghost admin-btn-small"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
      </button>
    </div>
  )
}
