import { useEffect, useState } from 'react'
import { api } from '../api'
import './dashboard.css'

const REFRESH_MS = 30000

function formatNumber(n) {
  return (n ?? 0).toLocaleString('en-GB')
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short' })
}

function StatCard({ label, value, sub, className = '' }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function StatusCard({ health, onOpen }) {
  const online = health?.online
  return (
    <button
      type="button"
      className={`stat-card status-card ${online ? 'status-online' : 'status-offline'}`}
      onClick={onOpen}
    >
      <div className="stat-label">System Status</div>
      <div className="stat-value status-value">{online ? 'ONLINE' : 'OFFLINE'}</div>
      <div className="stat-sub">Tap for details</div>
    </button>
  )
}

function DebugModal({ health, onClose }) {
  if (!health) return null
  return (
    <div className="debug-overlay" onClick={onClose}>
      <div className="debug-panel" onClick={(e) => e.stopPropagation()}>
        <div className="debug-panel-header">
          <span className={`status-dot ${health.online ? 'online' : 'offline'}`} />
          <h2>{health.online ? 'ONLINE' : 'OFFLINE'}</h2>
          <button type="button" className="debug-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="debug-log">
          {health.checks.map((c) => (
            <div key={c.name} className={`debug-row ${c.ok ? 'ok' : 'fail'}`}>
              <span className="debug-check-icon">{c.ok ? '✓' : '✕'}</span>
              <span className="debug-check-name">{c.name}</span>
              <span className="debug-check-detail">{c.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatIdeaTime(iso) {
  return new Date(`${iso.replace(' ', 'T')}Z`).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function CrowdIdeasCard({ summary, onOpen }) {
  const count = summary?.count ?? 0
  return (
    <button type="button" className="stat-card wide-card crowd-ideas-card" onClick={onOpen}>
      <div className="stat-label">Crowd Ideas</div>
      <div className="stat-value">
        {formatNumber(count)} submission{count === 1 ? '' : 's'}
      </div>
      <div className="stat-sub crowd-ideas-card-last">
        {summary?.lastIdea ? `"${summary.lastIdea}" — ${summary.lastName}` : 'No submissions yet'}
      </div>
      <div className={`printer-pill ${summary?.printerConnected ? 'ok' : 'fail'}`}>
        <span className="printer-pill-dot" />
        {summary?.printerConnected ? 'Printer online' : 'Printer offline'}
      </div>
    </button>
  )
}

function CrowdIdeasModal({ onClose }) {
  const [ideas, setIdeas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getDashboardCrowdIdeas()
      .then(setIdeas)
      .catch(() => setError("Can't load submissions."))
  }, [])

  const handleDelete = async (id) => {
    setError('')
    try {
      await api.deleteDashboardCrowdIdea(id)
      setIdeas((prev) => prev.filter((i) => i.id !== id))
    } catch {
      setError('Could not delete that entry.')
    }
  }

  return (
    <div className="debug-overlay" onClick={onClose}>
      <div className="debug-panel crowd-ideas-panel" onClick={(e) => e.stopPropagation()}>
        <div className="debug-panel-header">
          <h2>Crowd Ideas {ideas ? `(${ideas.length})` : ''}</h2>
          <button type="button" className="debug-close" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="crowd-ideas-panel-error">{error}</div>}
        <div className="debug-log">
          {ideas === null && !error && <div className="debug-row">Loading…</div>}
          {ideas?.length === 0 && <div className="debug-row">No submissions yet.</div>}
          {ideas?.map((idea) => (
            <div key={idea.id} className="debug-row crowd-ideas-row">
              <span
                className={`printer-pill-dot ${idea.printed ? 'ok' : 'fail'}`}
                title={idea.printed ? 'Printed' : 'Print failed'}
              />
              <span className="crowd-ideas-row-name">{idea.name}</span>
              <span className="crowd-ideas-row-idea">{idea.idea}</span>
              <span className="crowd-ideas-row-time">{formatIdeaTime(idea.created_at)}</span>
              <button
                type="button"
                className="crowd-ideas-row-delete"
                onClick={() => handleDelete(idea.id)}
                aria-label={`Delete submission from ${idea.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UsageChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.views))
  return (
    <div className="stat-card usage-card">
      <div className="stat-label">Site Usage — Last 7 Days</div>
      <div className="usage-bars">
        {days.map((d) => (
          <div className="usage-bar-col" key={d.date}>
            <div className="usage-bar-track">
              <div className="usage-bar" style={{ height: `${(d.views / max) * 100}%` }} />
            </div>
            <div className="usage-bar-label">{formatDay(d.date)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardApp() {
  const [stats, setStats] = useState(null)
  const [now, setNow] = useState(new Date())
  const [error, setError] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [showCrowdModal, setShowCrowdModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      api
        .getDashboardStats()
        .then((data) => {
          if (!cancelled) {
            setStats(data)
            setError(false)
          }
        })
        .catch(() => !cancelled && setError(true))
    }
    load()
    const poll = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  const last7Days = buildFullWeek(stats?.last7Days)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          Joe<span className="dashboard-logo-dot">.</span>MakesStuff
        </div>
        <div className="dashboard-clock">
          <div className="dashboard-time">{now.toLocaleTimeString('en-GB')}</div>
          <div className="dashboard-date">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      {!stats && !error && <div className="dashboard-loading">Loading site stats…</div>}
      {error && !stats && <div className="dashboard-loading">Can't reach the site API.</div>}

      {stats && (
        <div className="dashboard-grid">
          <StatCard label="Total Site Visitors" value={formatNumber(stats.uniqueVisitors)} />
          <StatCard label="Total Page Views" value={formatNumber(stats.totalPageViews)} />
          <StatCard label="Visits Today" value={formatNumber(stats.todayViews)} />
          <StatCard label="Contact Requests" value={formatNumber(stats.contactRequests)} />
          <StatCard label="Server Uptime" value={formatUptime(stats.uptimeSeconds)} />
          <StatCard label="Site Storage" value={formatBytes(stats.storageBytes)} />
          <CrowdIdeasCard summary={stats.crowdIdeasSummary} onOpen={() => setShowCrowdModal(true)} />
          <StatusCard health={stats.health} onOpen={() => setShowDebug(true)} />
          <UsageChart days={last7Days} />
        </div>
      )}

      {showDebug && <DebugModal health={stats?.health} onClose={() => setShowDebug(false)} />}
      {showCrowdModal && <CrowdIdeasModal onClose={() => setShowCrowdModal(false)} />}

      <footer className="dashboard-footer">
        {stats?.serverStartedAt && `Server started ${new Date(stats.serverStartedAt).toLocaleString('en-GB')}`}
      </footer>
    </div>
  )
}

// The API only returns days that had at least one view — pad in the
// missing days (as zero) so the chart always shows a full, stable week.
function buildFullWeek(days) {
  const byDate = new Map((days || []).map((d) => [d.date, d.views]))
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, views: byDate.get(key) || 0 })
  }
  return out
}
