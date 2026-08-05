import { useEffect, useState } from 'react'
import { api } from '../api'
import { Link } from '../router'
import { youtubeId, youtubeThumbnail } from '../youtube'
import Lightbox from '../components/Lightbox'

export default function ProjectPage({ slug }) {
  const [project, setProject] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    setProject(null)
    setNotFound(false)
    api
      .getProject(slug)
      .then(setProject)
      .catch(() => setNotFound(true))
  }, [slug])

  useEffect(() => {
    document.title = project ? `${project.title} — Joe.MakesStuff` : 'Joe.MakesStuff'
    return () => {
      document.title = 'Joe.MakesStuff — Creative Technology Studio'
    }
  }, [project])

  if (notFound) {
    return (
      <section className="project-page">
        <div className="container">
          <p className="detail-placeholder">Project not found.</p>
          <Link className="btn btn-ghost" to="/#work">
            ← All work
          </Link>
        </div>
      </section>
    )
  }

  if (!project) {
    return (
      <section className="project-page">
        <div className="container admin-muted">Loading…</div>
      </section>
    )
  }

  const buildMedia = [
    project.dev1_image && { type: 'image', src: project.dev1_image },
    project.dev2_image && { type: 'image', src: project.dev2_image },
    project.dev3_image && { type: 'image', src: project.dev3_image },
    (project.dev_video || project.dev_video_poster) && {
      type: 'video',
      src: project.dev_video,
      poster: project.dev_video_poster,
    },
  ].filter(Boolean)

  const gallery = project.gallery || []

  return (
    <section className="project-page">
      {project.banner_video ? (
        <video
          className="project-hero"
          src={project.banner_video}
          poster={project.banner_poster}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : project.banner_poster ? (
        <img className="project-hero" src={project.banner_poster} alt={project.title} />
      ) : (
        <div className="project-hero placeholder-fill">{project.title}</div>
      )}

      <div className="container project-body">
        <Link className="project-back" to="/#work">
          ← All work
        </Link>

        <h1 className="project-title">{project.title}</h1>

        <div className="detail-meta">
          <div>
            <span className="detail-meta-label">Client</span>
            <span>{project.client}</span>
          </div>
          <div>
            <span className="detail-meta-label">Project Type</span>
            <span>{project.project_type}</span>
          </div>
        </div>

        {(project.intro1 || project.intro2) && (
          <div className="detail-intro">
            {project.intro1 && <p>{project.intro1}</p>}
            {project.intro2 && <p>{project.intro2}</p>}
          </div>
        )}

        {gallery.length > 0 && (
          <div className="detail-block">
            <div className="project-gallery">
              {gallery.map((item, i) => (
                <button
                  key={item.id}
                  className="project-gallery-item"
                  onClick={() => setLightboxIndex(i)}
                  aria-label="Expand image"
                >
                  {item.kind === 'video' ? (
                    <video src={item.url} muted playsInline />
                  ) : (
                    <img src={item.url} alt={`${project.title} — photo ${i + 1}`} loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(project.dev_heading || project.dev_message || buildMedia.length > 0) && (
          <div className="detail-block">
            {project.dev_heading && <h3>{project.dev_heading}</h3>}
            {project.dev_message.split('\n\n').map(
              (para, i) => para.trim() && <p key={i}>{para.trim()}</p>
            )}
            {buildMedia.length > 0 && (
              <div className="detail-media-grid">
                {buildMedia.map((m, i) =>
                  m.type === 'video' ? (
                    <video key={i} src={m.src} poster={m.poster} controls muted playsInline />
                  ) : (
                    <img key={i} src={m.src} alt={`${project.title} build photo ${i + 1}`} loading="lazy" />
                  )
                )}
              </div>
            )}
          </div>
        )}

        {(project.outcomes_title || project.outcomes_message) && (
          <div className="detail-block">
            {project.outcomes_title && <h3>{project.outcomes_title}</h3>}
            {project.outcomes_message && <p>{project.outcomes_message}</p>}
          </div>
        )}

        {project.youtube_url && (
          <div className="detail-block">
            <YouTubeEmbed url={project.youtube_url} />
          </div>
        )}

        {!project.intro1 && !project.dev_heading && !project.outcomes_message && (
          <p className="detail-placeholder">
            Full case study write-up coming soon for this project.
          </p>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  )
}

function YouTubeEmbed({ url }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(url)
  const thumb = youtubeThumbnail(url)

  if (playing && id) {
    return (
      <div className="yt-embed">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button className="detail-yt-card" onClick={() => setPlaying(true)}>
      {thumb && <img src={thumb} alt="" />}
      <span className="detail-yt-play">▶</span>
      <span className="detail-yt-label">Watch on YouTube</span>
    </button>
  )
}
