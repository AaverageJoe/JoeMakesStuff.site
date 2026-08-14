import { useEffect, useState } from 'react'
import { api } from '../api'
import { useInView } from '../useInView'

const NAME_MAX = 30
const IDEA_MAX = 100
const LIMIT = 5
const PRINTER_POLL_MS = 20000

function PrinterStatus({ connected }) {
  if (connected === null) return null
  return (
    <p className={`crowd-ideas-printer-status ${connected ? 'ok' : 'fail'}`}>
      <span className="crowd-ideas-printer-dot" />
      {connected ? 'Printer online' : "Printer offline — your idea will still be saved, just won't print"}
    </p>
  )
}

function HowtoRow({ step, index }) {
  const [ref, inView] = useInView({ threshold: 0.25 })

  return (
    <div className={`howto-row ${index % 2 ? 'reverse' : ''} reveal ${inView ? 'in-view' : ''}`} ref={ref}>
      <div className="howto-media">
        {step.image_url && <img src={step.image_url} alt={step.title} loading="lazy" />}
      </div>
      <div className="howto-text">
        <div className="howto-index">0{index + 1}</div>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
      </div>
    </div>
  )
}

export default function CrowdIdeasPage() {
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [remaining, setRemaining] = useState(null)
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(null)
  const [steps, setSteps] = useState([])

  useEffect(() => {
    api.getCrowdHowtoSteps().then(setSteps)
  }, [])

  useEffect(() => {
    api
      .getCrowdIdeasRemaining()
      .then((r) => setRemaining(r.remaining))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = () => {
      api
        .getCrowdIdeasPrinterStatus()
        .then((r) => !cancelled && setPrinterConnected(r.connected))
        .catch(() => !cancelled && setPrinterConnected(false))
    }
    check()
    const poll = setInterval(check, PRINTER_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await api.submitCrowdIdea(name.trim(), idea.trim())
      setRemaining(res.remaining)
      setPrinterConnected(res.printed)
      setStatus({
        type: 'success',
        message: res.printed
          ? 'Printed! Thanks for the idea.'
          : "Saved — the printer didn't respond, but your idea's in.",
      })
      setName('')
      setIdea('')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const outOfSubmissions = remaining === 0

  return (
    <>
      <section id="crowd-ideas-howto">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Got An Idea?</div>
            <h2>Crowd Sourcing Ideas</h2>
            <p>Here's how it works — then try it for yourself just below.</p>
          </div>

          {steps.map((step, i) => (
            <HowtoRow step={step} index={i} key={step.id} />
          ))}
        </div>
      </section>

      <section id="crowd-ideas-form">
        <div className="container crowd-ideas-container">
          <PrinterStatus connected={printerConnected} />

          {outOfSubmissions ? (
            <p className="crowd-ideas-status crowd-ideas-status-info">
              You've used all {LIMIT} of your submissions on this device — thanks for taking part!
            </p>
          ) : (
            <div className="crowd-ideas-receipt">
              <div className="crowd-ideas-receipt-edge" />
              <div className="crowd-ideas-receipt-paper">
                <div className="crowd-ideas-receipt-heading">* YOUR IDEA *</div>

                <form className="crowd-ideas-form" onSubmit={handleSubmit}>
                  <label>
                    Name
                    <input
                      type="text"
                      value={name}
                      maxLength={NAME_MAX}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <span className="crowd-ideas-count">
                      {name.length}/{NAME_MAX}
                    </span>
                  </label>

                  <label>
                    Your idea
                    <textarea
                      value={idea}
                      maxLength={IDEA_MAX}
                      rows={4}
                      onChange={(e) => setIdea(e.target.value)}
                      required
                    />
                    <span className="crowd-ideas-count">
                      {idea.length}/{IDEA_MAX}
                    </span>
                  </label>

                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Printing…' : 'Submit idea'}
                  </button>

                  {remaining !== null && (
                    <p className="crowd-ideas-remaining">
                      {remaining} submission{remaining === 1 ? '' : 's'} left on this device
                    </p>
                  )}
                </form>

                {status && (
                  <p className={`crowd-ideas-status crowd-ideas-status-${status.type}`}>{status.message}</p>
                )}
              </div>
              <div className="crowd-ideas-receipt-edge bottom" />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
