import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Services() {
  const [services, setServices] = useState([])

  useEffect(() => {
    api.getServices().then(setServices)
  }, [])

  return (
    <section id="services">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">What I Do</div>
          <h2>Creative Technology Services</h2>
        </div>

        {services.map((service, i) => (
          <div className={`service-row ${i % 2 ? 'reverse' : ''}`} key={service.id}>
            <div className="service-media">
              {service.image_url && <img src={service.image_url} alt={service.title} loading="lazy" />}
            </div>
            <div className="service-text">
              <div className="service-index">0{i + 1}</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
