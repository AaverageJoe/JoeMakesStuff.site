import { useState } from 'react'
import { CONTACT } from '../data/content'
import { useCopy } from '../copy'
import { api } from '../api'

const NAME_MAX = 80
const COMPANY_MAX = 120
const MESSAGE_MAX = 2000

export default function Contact() {
  const { copy } = useCopy()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot — left empty by real visitors
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setStatus(null)
    try {
      await api.submitContactMessage(name.trim(), company.trim(), email.trim(), message.trim())
      setStatus({ type: 'success', message: "Thanks — I'll get back to you soon." })
      setName('')
      setCompany('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact">
      <div className="container">
        <div className="contact-card">
          <div className="eyebrow" style={{ justifyContent: 'center' }}>
            {copy.contact_eyebrow}
          </div>
          <h2>{copy.contact_heading}</h2>
          <p style={{ maxWidth: 480, margin: '0 auto 28px' }}>{copy.contact_intro}</p>

          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="contact-form-honeypot"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="contact-form-row">
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              <span>
                Company <span className="contact-form-optional">(optional)</span>
              </span>
              <input
                type="text"
                value={company}
                maxLength={COMPANY_MAX}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label>
              Message
              <textarea
                value={message}
                maxLength={MESSAGE_MAX}
                rows={6}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send message'}
            </button>

            {status && (
              <p className={`contact-form-status contact-form-status-${status.type}`}>{status.message}</p>
            )}
          </form>

          <p className="contact-form-alt">
            Prefer email? Reach me directly at{' '}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
        </div>
      </div>
    </section>
  )
}
