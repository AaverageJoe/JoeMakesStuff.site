import { useEffect, useState } from 'react'
import { api } from '../api'

export default function CrowdIdeasAdmin() {
  const [words, setWords] = useState(null)
  const [newWord, setNewWord] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.getCrowdIdeasBlocklist().then(setWords)
  }, [])

  if (!words) return <div className="admin-muted">Loading…</div>

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

  return (
    <div>
      <h1 className="admin-page-title">Crowd Ideas — Blocked Words</h1>
      <p className="admin-muted">
        A submission is rejected before it's saved or printed if its name or idea contains any of
        these words. Matching is whole-word and case-insensitive. "Joe" and "Joseph" are always
        blocked from the name field regardless of this list.
      </p>

      {error && (
        <div className="admin-error" style={{ margin: '12px 0' }}>
          {error}
        </div>
      )}

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

      <div className="admin-card" style={{ marginTop: 20 }}>
        <h2 className="admin-section-title">
          {words.length} blocked word{words.length === 1 ? '' : 's'}
        </h2>
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
    </div>
  )
}
