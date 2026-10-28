import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Lightbox({ images, index, onClose, onNavigate }) {
  const item = images[index]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && images.length > 1) onNavigate((index + 1) % images.length)
      if (e.key === 'ArrowLeft' && images.length > 1) onNavigate((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [index, images.length, onClose, onNavigate])

  if (!item) return null

  const filename = item.url.split('/').pop()

  // Rendered into document.body, not in place — fixed-position overlays get
  // trapped (clipped, and knocked out of the page's real stacking order)
  // by any ancestor with a transform/filter/mask, like the blueprint-grid
  // fade mask on the Tiny Builds section. A portal sidesteps that entirely.
  return createPortal(
    <div className="lightbox-backdrop" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <a
        className="lightbox-download"
        href={item.url}
        download={filename}
        onClick={(e) => e.stopPropagation()}
      >
        Download
      </a>

      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate((index - 1 + images.length) % images.length)
            }}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate((index + 1) % images.length)
            }}
            aria-label="Next image"
          >
            ›
          </button>
        </>
      )}

      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {item.kind === 'video' ? (
          <video src={item.url} controls autoPlay className="lightbox-media" />
        ) : (
          <img src={item.url} alt="" className="lightbox-media" />
        )}
      </div>

      {images.length > 1 && (
        <div className="lightbox-count">
          {index + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  )
}
