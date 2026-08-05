import { useEffect, useState } from 'react'
import { api } from '../api'

export default function ProjectList({ onSelect }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    api
      .getAdminProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="admin-muted">Loading projects…</div>

  const move = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= projects.length) return
    const a = projects[index]
    const b = projects[target]
    setError('')
    setBusySlug(a.slug)
    try {
      await Promise.all([
        api.updateProject(a.slug, { sort_order: b.sort_order }),
        api.updateProject(b.slug, { sort_order: a.sort_order }),
      ])
      const next = [...projects]
      next[index] = { ...b, sort_order: a.sort_order }
      next[target] = { ...a, sort_order: b.sort_order }
      setProjects(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusySlug(null)
    }
  }

  const toggleVisible = async (p) => {
    setError('')
    setBusySlug(p.slug)
    try {
      const updated = await api.updateProject(p.slug, { visible: p.visible ? 0 : 1 })
      setProjects((prev) => prev.map((x) => (x.slug === p.slug ? updated : x)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusySlug(null)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setError('')
    setCreating(true)
    try {
      const created = await api.createProject(newTitle.trim())
      setProjects((prev) => [...prev, created])
      setNewTitle('')
      onSelect(created.slug)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This removes all its content, images and gallery permanently.`)) {
      return
    }
    setError('')
    setBusySlug(p.slug)
    try {
      await api.deleteProject(p.slug)
      setProjects((prev) => prev.filter((x) => x.slug !== p.slug))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Projects</h1>
      <p className="admin-muted">
        {projects.length} projects. Use the arrows to change their order on the live site, the eye
        to hide/show one, or click a row to edit its content, images and gallery.
      </p>

      <form className="admin-new-project" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New project title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button className="admin-btn admin-btn-primary" type="submit" disabled={creating || !newTitle.trim()}>
          {creating ? 'Creating…' : '+ New Project'}
        </button>
      </form>

      {error && <div className="admin-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="admin-project-list">
        {projects.map((p, i) => (
          <div className={`admin-project-row ${p.visible ? '' : 'is-hidden'}`} key={p.slug}>
            <button className="admin-project-row-main" onClick={() => onSelect(p.slug)}>
              {p.showcase_image ? (
                <img src={p.showcase_image} alt="" />
              ) : (
                <div className="admin-project-row-placeholder">No image</div>
              )}
              <div>
                <div className="admin-project-card-client">{p.client || ' '}</div>
                <div className="admin-project-card-title">{p.title}</div>
              </div>
            </button>

            <div className="admin-project-row-controls">
              <button
                className="admin-btn admin-btn-ghost admin-btn-small"
                onClick={() => move(i, -1)}
                disabled={busySlug === p.slug || i === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="admin-btn admin-btn-ghost admin-btn-small"
                onClick={() => move(i, 1)}
                disabled={busySlug === p.slug || i === projects.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="admin-btn admin-btn-ghost admin-btn-small"
                onClick={() => toggleVisible(p)}
                disabled={busySlug === p.slug}
              >
                {p.visible ? 'Hide' : 'Show'}
              </button>
              <button
                className="admin-btn admin-btn-ghost admin-btn-small admin-btn-danger"
                onClick={() => handleDelete(p)}
                disabled={busySlug === p.slug}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
