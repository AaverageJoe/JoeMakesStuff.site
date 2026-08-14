import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export default function CrowdIdeasAdmin() {
  const [words, setWords] = useState(null)
  const [newWord, setNewWord] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [steps, setSteps] = useState(null)
  const [savedSteps, setSavedSteps] = useState({})

  useEffect(() => {
    api.getCrowdIdeasBlocklist().then(setWords)
    api.getCrowdHowtoSteps().then((rows) => {
      setSteps(rows)
      setSavedSteps(Object.fromEntries(rows.map((r) => [r.id, r])))
    })
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    const word = newWord.trim()
    if (!word) return
    setAdding(true)
    setError('')
    try {
      const created = await api.addCrowdIdeasBlockedWord(word)
      setWords((prev) => [...prev, created].sort((a, b) => a.word.localeCompare(b.word)))
      setNewWord('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    setError('')
    try {
      await api.deleteCrowdIdeasBlockedWord(id)
      setWords((prev) => prev.filter((w) => w.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const updateStepField = (id, field, value) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const handleSaveStep = async (id) => {
    setError('')
    const step = steps.find((s) => s.id === id)
    try {
      const updated = await api.updateCrowdHowtoStep(id, {
        title: step.title,
        description: step.description,
      })
      setSavedSteps((prev) => ({ ...prev, [id]: updated }))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUploadStepImage = async (id, file) => {
    setError('')
    try {
      const { url } = await api.uploadCrowdHowtoStepImage(id, file)
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, image_url: url } : s)))
      setSavedSteps((prev) => ({ ...prev, [id]: { ...prev[id], image_url: url } }))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Crowd Ideas</h1>

      {error && (
        <div className="admin-error" style={{ margin: '12px 0' }}>
          {error}
        </div>
      )}

      <h2 className="admin-section-title" style={{ marginTop: 8 }}>
        How It Works page
      </h2>
      <p className="admin-muted">
        The 3 steps shown on the crowd-ideas page, each with a photo. Add a real photo for each
        once you've taken them — they show up on the live page as soon as you upload.
      </p>

      {!steps ? (
        <div className="admin-muted">Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
          {steps.map((step) => {
            const dirty =
              step.title !== savedSteps[step.id]?.title || step.description !== savedSteps[step.id]?.description
            return (
              <div className="admin-card" key={step.id}>
                <div className="admin-editor-grid">
                  <div>
                    <label className="admin-field">
                      <span>Title</span>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStepField(step.id, 'title', e.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Description</span>
                      <textarea
                        rows={4}
                        value={step.description}
                        onChange={(e) => updateStepField(step.id, 'description', e.target.value)}
                      />
                    </label>
                    <button
                      className="admin-btn admin-btn-primary"
                      onClick={() => handleSaveStep(step.id)}
                      disabled={!dirty}
                    >
                      Save changes
                    </button>
                  </div>

                  <StepImageSlot step={step} onUpload={(file) => handleUploadStepImage(step.id, file)} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="admin-section-title" style={{ marginTop: 40 }}>
        Blocked words
      </h2>
      <p className="admin-muted">
        A submission is rejected before it's saved or printed if its name or idea contains any of
        these words. Matching is whole-word and case-insensitive. "Joe" and "Joseph" are always
        blocked from the name field regardless of this list.
      </p>

      <form className="admin-card" style={{ marginTop: 20 }} onSubmit={handleAdd}>
        <label className="admin-field" style={{ marginBottom: 0 }}>
          <span>Add a word</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="e.g. spam"
              style={{ flex: 1 }}
            />
            <button className="admin-btn admin-btn-primary" type="submit" disabled={adding || !newWord.trim()}>
              Add
            </button>
          </div>
        </label>
      </form>

      {!words ? (
        <div className="admin-muted" style={{ marginTop: 20 }}>
          Loading…
        </div>
      ) : (
        <div className="admin-card" style={{ marginTop: 20 }}>
          <h3 className="admin-section-title">
            {words.length} blocked word{words.length === 1 ? '' : 's'}
          </h3>
          {words.length === 0 ? (
            <p className="admin-muted">No blocked words yet.</p>
          ) : (
            <div className="crowd-blocklist-grid">
              {words.map((w) => (
                <div className="crowd-blocklist-chip" key={w.id}>
                  <span>{w.word}</span>
                  <button type="button" onClick={() => handleDelete(w.id)} aria-label={`Remove ${w.word}`}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepImageSlot({ step, onUpload }) {
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
        {step.image_url ? <img src={step.image_url} alt="" /> : <span className="admin-muted">No photo yet</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button
        className="admin-btn admin-btn-ghost admin-btn-small"
        style={{ marginTop: 10 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        type="button"
      >
        {uploading ? 'Uploading…' : step.image_url ? 'Replace photo' : 'Upload photo'}
      </button>
    </div>
  )
}
