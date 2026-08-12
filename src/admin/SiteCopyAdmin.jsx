import { useEffect, useState } from 'react'
import { api } from '../api'
import { COPY_DEFAULTS, COPY_GROUPS } from '../copy'

export default function SiteCopyAdmin() {
  const [values, setValues] = useState(null)
  const [initialValues, setInitialValues] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.getCopy().then((overrides) => {
      const loaded = {}
      for (const key of Object.keys(COPY_DEFAULTS)) {
        loaded[key] = overrides[key] || ''
      }
      setValues(loaded)
      setInitialValues(loaded)
    })
  }, [])

  if (!values) return <div className="admin-muted">Loading…</div>

  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues)

  const handleChange = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setStatus('')
    try {
      await api.updateCopy(values)
      setInitialValues(values)
      setStatus('Saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = () => {
    const cleared = {}
    for (const key of Object.keys(COPY_DEFAULTS)) cleared[key] = ''
    setValues(cleared)
  }

  return (
    <div>
      <h1 className="admin-page-title">Site Copy</h1>
      <p className="admin-muted">
        Edit any heading, intro, or button label on the public site. Leave a field blank to fall
        back to its default text — shown greyed out as a placeholder.
      </p>
      {error && (
        <div className="admin-error" style={{ margin: '12px 0' }}>
          {error}
        </div>
      )}

      {COPY_GROUPS.map((group) => (
        <div className="admin-card" style={{ marginTop: 20 }} key={group.label}>
          <h2 className="admin-section-title">{group.label}</h2>
          {group.fields.map((field) => (
            <label className="admin-field" key={field.key}>
              <span>{field.label}</span>
              {field.multiline ? (
                <textarea
                  rows={3}
                  value={values[field.key]}
                  placeholder={COPY_DEFAULTS[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={values[field.key]}
                  placeholder={COPY_DEFAULTS[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      ))}

      <div className="admin-save-row" style={{ marginTop: 20 }}>
        <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="admin-btn admin-btn-ghost" onClick={handleResetAll} type="button">
          Reset all to default
        </button>
        {status && <span className="admin-status-ok">{status}</span>}
      </div>
    </div>
  )
}
