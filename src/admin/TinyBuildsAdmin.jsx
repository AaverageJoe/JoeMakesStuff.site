import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function TinyBuildsAdmin() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.getTinyBuilds().then(setItems)
  }, [])

  if (!items) return <div className="admin-muted">Loading…</div>

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const item = await api.addTinyBuild(file)
      setItems((prev) => [...prev, item])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id) => {
    setError('')
    try {
      await api.deleteTinyBuild(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Tiny Builds</h1>
      <p className="admin-muted">
        {items.length} photos. Static images (jpg/png) are automatically cropped to a square.
        Animated GIFs are kept as uploaded and displayed square via cropping in the layout.
      </p>
      {error && <div className="admin-error" style={{ margin: '12px 0' }}>{error}</div>}

      <div className="admin-gallery-grid" style={{ marginTop: 20, gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {items.map((item) => (
          <div className="admin-gallery-item" key={item.id}>
            <img src={item.url} alt="" />
            <button
              className="admin-gallery-delete"
              onClick={() => handleDelete(item.id)}
              aria-label="Delete"
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
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>
    </div>
  )
}
