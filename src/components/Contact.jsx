import { CONTACT } from '../data/content'

export default function Contact() {
  return (
    <section id="contact">
      <div className="container">
        <div className="contact-card">
          <div className="eyebrow" style={{ justifyContent: 'center' }}>
            Get In Touch
          </div>
          <h2>Got a project in mind?</h2>
          <p style={{ maxWidth: 480, margin: '0 auto 28px' }}>
            Whether it's rapid prototyping, an interactive exhibit, or an R&D consultation — let's
            talk about how to bring it to life.
          </p>
          <div className="hero-cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
