import { useState } from 'react'
import { api } from '../api'

export default function ChangePassword({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setStatus('')
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setStatus('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <form
        className="admin-card admin-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="admin-section-title">Change password</h2>

        <label className="admin-field">
          <span>Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="admin-field">
          <span>New password (min. 8 characters)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="admin-field">
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {status && <div className="admin-status-ok">{status}</div>}
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-save-row">
          <button className="admin-btn admin-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
          <button className="admin-btn admin-btn-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>
  )
}
