import { Link } from '../router'
import { useSettings } from '../settings'
import { useCopy } from '../copy'
import SelfDrawingLogo from './SelfDrawingLogo'

export default function Hero() {
  const { settings } = useSettings()
  const { copy } = useCopy()

  return (
    <section id="top" className="hero">
      {settings.hero_bg_url && (
        <>
          <img className="hero-bg" src={settings.hero_bg_url} alt="" />
          <div className="hero-bg-scrim" />
        </>
      )}
      <div className="container hero-inner">
        <div className="eyebrow">{copy.hero_eyebrow}</div>
        <h1 className="hero-signature-heading">
          <Link className="hero-signature" to="/#top">
            <span className="sr-only">Joe.</span>
            <SelfDrawingLogo className="signature-svg" />
            <span className="signature-rest">MakesStuff</span>
          </Link>
        </h1>
        <p className="lede">{copy.hero_lede}</p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#work">
            {copy.hero_cta_primary}
          </a>
          <Link className="btn btn-ghost" to="/contact">
            {copy.hero_cta_secondary}
          </Link>
        </div>
      </div>
    </section>
  )
}
