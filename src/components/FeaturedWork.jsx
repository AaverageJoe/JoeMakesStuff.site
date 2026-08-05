import { useEffect, useState } from 'react'
import { api } from '../api'
import { Link } from '../router'

export default function FeaturedWork() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="work">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Selected Work</div>
          <h2>Featured Work</h2>
          <p>
            A selection of client projects spanning brand activations, interactive exhibits and
            hardware-driven experiences.
          </p>
        </div>

        {!loading && (
          <div className="work-grid">
            {projects.map((project) => (
              <Link key={project.slug} className="work-card" to={`/work/${project.slug}`}>
                {project.showcase_image ? (
                  <img src={project.showcase_image} alt={`${project.title} — ${project.client}`} />
                ) : (
                  <div className="placeholder-fill">{project.title}</div>
                )}
                <div className="work-card-hover">
                  <span className="work-card-title">{project.title}</span>
                  <span className="work-card-rule" />
                  <span className="work-card-client">{project.client}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
