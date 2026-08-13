const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

async function uploadFile(path, file, extraFields = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(extraFields)) form.append(key, value)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
  return data
}

export const api = {
  getProjects: () => request('/projects'),
  getAdminProjects: () => request('/admin/projects'),
  getProject: (slug) => request(`/projects/${slug}`),
  createProject: (title) => request('/projects', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteProject: (slug) => request(`/projects/${slug}`, { method: 'DELETE' }),
  updateProject: (slug, fields) =>
    request(`/projects/${slug}`, { method: 'PUT', body: JSON.stringify(fields) }),
  uploadImage: (slug, target, file) => uploadFile(`/projects/${slug}/upload?target=${encodeURIComponent(target)}`, file),
  addGalleryImage: (slug, file) => uploadFile(`/projects/${slug}/gallery`, file),
  deleteGalleryImage: (slug, id) =>
    request(`/projects/${slug}/gallery/${id}`, { method: 'DELETE' }),

  getCopy: () => request('/copy'),
  updateCopy: (fields) => request('/copy', { method: 'PUT', body: JSON.stringify(fields) }),

  getSettings: () => request('/settings'),
  updateSettings: (fields) => request('/settings', { method: 'PUT', body: JSON.stringify(fields) }),
  uploadSettingsAsset: (target, file) => uploadFile(`/settings/upload?target=${encodeURIComponent(target)}`, file),
  clearSettingsAsset: (field) => request(`/settings/${field}`, { method: 'DELETE' }),

  getTinyBuilds: () => request('/tiny-builds'),
  addTinyBuild: (file) => uploadFile('/tiny-builds', file),
  deleteTinyBuild: (id) => request(`/tiny-builds/${id}`, { method: 'DELETE' }),

  getServices: () => request('/services'),
  getAdminServices: () => request('/admin/services'),
  updateService: (id, fields) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  uploadServiceImage: (id, file) => uploadFile(`/services/${id}/upload`, file),

  trackPageview: (path) =>
    request('/track/pageview', { method: 'POST', body: JSON.stringify({ path }) }).catch(() => {}),
  trackEvent: (type, path) =>
    request('/track/event', { method: 'POST', body: JSON.stringify({ type, path }) }).catch(() => {}),

  getDashboardStats: () => request('/stats/dashboard'),
  getDashboardCrowdIdeas: () => request('/stats/dashboard/crowd-ideas'),
  deleteDashboardCrowdIdea: (id) => request(`/stats/dashboard/crowd-ideas/${id}`, { method: 'DELETE' }),

  getCrowdIdeasRemaining: () => request('/crowd-ideas/remaining'),
  submitCrowdIdea: (name, idea) =>
    request('/crowd-ideas', { method: 'POST', body: JSON.stringify({ name, idea }) }),
  getCrowdIdeasPrinterStatus: () => request('/crowd-ideas/printer-status'),

  getCrowdIdeasBlocklist: () => request('/admin/crowd-ideas/blocklist'),
  addCrowdIdeasBlockedWord: (word) =>
    request('/admin/crowd-ideas/blocklist', { method: 'POST', body: JSON.stringify({ word }) }),
  deleteCrowdIdeasBlockedWord: (id) => request(`/admin/crowd-ideas/blocklist/${id}`, { method: 'DELETE' }),

  login: (username, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/logout', { method: 'POST' }),
  me: () => request('/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
}
