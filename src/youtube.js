export function youtubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]
    if (u.searchParams.get('v')) return u.searchParams.get('v')
  } catch {
    return null
  }
  return null
}

export function youtubeThumbnail(url) {
  const id = youtubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
