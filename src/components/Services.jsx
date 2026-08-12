import { useEffect, useState } from 'react'
import { api } from '../api'
import { useInView } from '../useInView'
import { useCopy } from '../copy'

function ServiceRow({ service, index }) {
  const [ref, inView] = useInView({ threshold: 0.25 })

  return (
    <div
      className={`service-row ${index % 2 ? 'reverse' : ''} reveal ${inView ? 'in-view' : ''}`}
      ref={ref}
    >
      <div className="service-media">
        {service.image_url && <img src={service.image_url} alt={service.title} loading="lazy" />}
      </div>
      <div className="service-text">
        <div className="service-index">0{index + 1}</div>
        <h3>{service.title}</h3>
        <p>{service.description}</p>
      </div>
    </div>
  )
}

export default function Services() {
  const [services, setServices] = useState([])
  const { copy } = useCopy()

  useEffect(() => {
    api.getServices().then(setServices)
  }, [])

  return (
    <section id="services">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{copy.services_eyebrow}</div>
          <h2>{copy.services_heading}</h2>
        </div>

        {services.map((service, i) => (
          <ServiceRow service={service} index={i} key={service.id} />
        ))}
      </div>
    </section>
  )
}
