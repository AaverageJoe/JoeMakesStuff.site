import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function ServicesAdmin() {
  const [services, setServices] = useState(null)
  const [saved, setSaved] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminServices().then((rows) => {
      setServices(rows)
      setSaved(Object.fromEntries(rows.map((r) => [r.id, r])))
    })
  }, [])

  if (!services) return <div className="admin-muted">Loading…</div>

  const updateField = (id, field, value) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const handleSave = async (id) => {
    setError('')
    const service = services.find((s) => s.id === id)
    try {
      const updated = await api.updateService(id, {
        title: service.title,
        description: service.description,
      })
      setSaved((prev) => ({ ...prev, [id]: updated }))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpload = async (id, file) => {
    setError('')
    try {
      const { url } = await api.uploadServiceImage(id, file)
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, image_url: url } : s)))
      setSaved((prev) => ({ ...prev, [id]: { ...prev[id], image_url: url } }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Services</h1>
      <p className="admin-muted">Edit the copy and image/GIF for each service card.</p>
      {error && <div className="admin-error" style={{ margin: '12px 0' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
        {services.map((service) => {
          const dirty =
            service.title !== saved[service.id]?.title || service.description !== saved[service.id]?.description
          return (
            <div className="admin-card" key={service.id}>
              <div className="admin-editor-grid">
                <div>
                  <label className="admin-field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={service.title}
                      onChange={(e) => updateField(service.id, 'title', e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Description</span>
                    <textarea
                      rows={5}
                      value={service.description}
                      onChange={(e) => updateField(service.id, 'description', e.target.value)}
                    />
                  </label>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() => handleSave(service.id)}
                    disabled={!dirty}
                  >
                    Save changes
                  </button>
                </div>

                <ServiceImageSlot service={service} onUpload={(file) => handleUpload(service.id, file)} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ServiceImageSlot({ service, onUpload }) {
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
    <div>
      <div className="admin-image-preview" style={{ aspectRatio: '4 / 3' }}>
        {service.image_url ? <img src={service.image_url} alt="" /> : <span className="admin-muted">Empty</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button
        className="admin-btn admin-btn-ghost admin-btn-small"
        style={{ marginTop: 10 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        type="button"
      >
        {uploading ? 'Uploading…' : 'Replace image / GIF'}
      </button>
    </div>
  )
}
