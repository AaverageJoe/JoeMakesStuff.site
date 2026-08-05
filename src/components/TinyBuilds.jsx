import { useEffect, useState } from 'react'
import { api } from '../api'
import { TINY_BUILDS_INTRO } from '../data/content'

export default function TinyBuilds() {
  const [items, setItems] = useState([])

  useEffect(() => {
    api.getTinyBuilds().then(setItems)
  }, [])

  return (
    <section id="tiny-builds">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Side Projects</div>
          <h2>The Tiny Builds</h2>
          <p>{TINY_BUILDS_INTRO}</p>
        </div>

        <div className="tiny-grid">
          {items.map((item) => (
            <div className="tiny-item" key={item.id}>
              <img src={item.url} alt="Tiny build" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
