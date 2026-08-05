import { Link } from '../router'
import { useSettings } from '../settings'

export default function Hero() {
  const { settings } = useSettings()

  return (
    <section id="top" className="hero">
      {settings.hero_bg_url && (
        <>
          <img className="hero-bg" src={settings.hero_bg_url} alt="" />
          <div className="hero-bg-scrim" />
        </>
      )}
      <div className="container hero-inner">
        <div className="eyebrow">Creative Technology Studio</div>
        <h1>Joe.MakesStuff</h1>
        <p className="lede">
          I design and build the technology behind interactive exhibits, brand activations and
          rapid prototypes — blending hardware, software and fabrication to turn ideas into
          working experiences.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#work">
            See featured work
          </a>
          <Link className="btn btn-ghost" to="/contact">
            Get in touch
          </Link>
        </div>
      </div>
    </section>
  )
}
