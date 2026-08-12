import { CONTACT } from '../data/content'
import { useCopy } from '../copy'
import { api } from '../api'

export default function Contact() {
  const { copy } = useCopy()

  return (
    <section id="contact">
      <div className="container">
        <div className="contact-card">
          <div className="eyebrow" style={{ justifyContent: 'center' }}>
            {copy.contact_eyebrow}
          </div>
          <h2>{copy.contact_heading}</h2>
          <p style={{ maxWidth: 480, margin: '0 auto 28px' }}>{copy.contact_intro}</p>
          <div className="hero-cta" style={{ justifyContent: 'center' }}>
            <a
              className="btn btn-primary"
              href={`mailto:${CONTACT.email}`}
              onClick={() => api.trackEvent('contact_click', '/contact')}
            >
              {CONTACT.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
