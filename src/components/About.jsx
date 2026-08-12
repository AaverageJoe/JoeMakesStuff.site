import { EXPERIENCE, SKILLS } from '../data/content'
import { useInView } from '../useInView'
import { useCopy } from '../copy'

export default function About() {
  const { copy } = useCopy()

  return (
    <section id="about">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{copy.about_eyebrow}</div>
          <h2>{copy.about_heading}</h2>
          <p className="about-title">{copy.about_title}</p>
        </div>

        <div className="about-grid">
          <div className="about-intro">
            <p className="about-lede">{copy.about_intro}</p>
          </div>

          <div>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>{copy.about_experience_heading}</h3>
            <ul className="timeline">
              {EXPERIENCE.map((item) => (
                <li key={`${item.org}-${item.year}`}>
                  <div className="year">{item.year}</div>
                  <div className="org">{item.org}</div>
                  <div className="role">{item.role}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SkillsSection heading={copy.about_skills_heading} />
      </div>
    </section>
  )
}

function SkillsSection({ heading }) {
  return (
    <div className="skills-section">
      <h3 style={{ fontSize: 18, marginBottom: 28 }}>{heading}</h3>
      <div className="skills-grid">
        {SKILLS.map((group) => (
          <SkillGroup key={group.category} group={group} />
        ))}
      </div>
    </div>
  )
}

function SkillGroup({ group }) {
  const [ref, inView] = useInView()

  return (
    <div className="skill-group" ref={ref}>
      <div className="skill-group-title">{group.category}</div>
      <div className="skill-pills">
        {group.items.map((item, i) => (
          <span
            key={item}
            className={`skill-pill ${inView ? 'in-view' : ''}`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
