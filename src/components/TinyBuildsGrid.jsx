import { useEffect, useRef, useState } from 'react'

// Growth is a plain transform: scale() on the tile itself — it stays in its
// own grid cell and visually overlaps its neighbours rather than changing
// grid-column/row span, so nothing ever reflows into a different row.
const AUTO_INTERVAL = 2200 // ms between ambient auto-cycled picks
const AUTO_RESUME_DELAY = 1200 // ms after the pointer leaves the grid before ambient cycling resumes
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function TinyBuildsGrid({ items }) {
  const [focusedId, setFocusedId] = useState(null)
  const [autoPlaying, setAutoPlaying] = useState(!prefersReducedMotion)
  const resumeTimerRef = useRef(null)
  const focusedIndexRef = useRef(-1)

  const focusedIndex = items.findIndex((item) => item.id === focusedId)

  useEffect(() => {
    focusedIndexRef.current = focusedIndex
  }, [focusedIndex])

  // Ambient auto-play: while nobody's interacting, spotlight one tile at a
  // time in sequence. Any genuine pointer interaction takes over immediately
  // and pauses this until the user moves on — resuming continues from
  // wherever attention last was, rather than restarting.
  useEffect(() => {
    if (!autoPlaying || items.length < 2) return
    const id = setInterval(() => {
      const next = (focusedIndexRef.current + 1) % items.length
      setFocusedId(items[next].id)
    }, AUTO_INTERVAL)
    return () => clearInterval(id)
  }, [autoPlaying, items])

  useEffect(() => () => clearTimeout(resumeTimerRef.current), [])

  const handleEnter = (id) => {
    setAutoPlaying(false)
    clearTimeout(resumeTimerRef.current)
    setFocusedId(id)
  }

  const handleLeave = () => {
    setFocusedId(null)
  }

  const handleGridLeave = () => {
    if (prefersReducedMotion) return
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setAutoPlaying(true), AUTO_RESUME_DELAY)
  }

  return (
    <div className="tiny-grid" onMouseLeave={handleGridLeave}>
      {items.map((item, i) => {
        const isFocused = focusedId === item.id
        const isNeighbor =
          !isFocused && focusedIndex !== -1 && (i === focusedIndex - 1 || i === focusedIndex + 1)
        return (
          <div
            className={`tiny-item${isFocused ? ' is-focused' : ''}${isNeighbor ? ' is-neighbor' : ''}`}
            key={item.id}
            onMouseEnter={() => handleEnter(item.id)}
            onMouseLeave={handleLeave}
          >
            <img src={item.url} alt="Tiny build" loading="lazy" />
          </div>
        )
      })}
    </div>
  )
}
