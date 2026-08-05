import { ABOUT_INTRO, ABOUT_TITLE, EXPERIENCE, SKILLS } from '../data/content'
import { useInView } from '../useInView'

export default function About() {
  return (
    <section id="about">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">About</div>
          <h2>Joe Allison</h2>
          <p className="about-title">{ABOUT_TITLE}</p>
        </div>

        <div className="about-grid">
          <div className="about-intro">
            <p className="about-lede">{ABOUT_INTRO}</p>
          </div>

          <div>
            <h3 style={{ fontSize: 18, marginBottom: 20 }}>Experience</h3>
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

        <SkillsSection />
      </div>
    </section>
  )
}

function SkillsSection() {
  return (
    <div className="skills-section">
      <h3 style={{ fontSize: 18, marginBottom: 28 }}>Skills</h3>
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
