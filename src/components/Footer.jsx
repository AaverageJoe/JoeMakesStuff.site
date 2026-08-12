import { useCopy } from '../copy'

export default function Footer() {
  const { copy } = useCopy()

  return (
    <footer className="site-footer">
      <div className="container">
        <span>© {new Date().getFullYear()} Joe.MakesStuff</span>
        <span>{copy.footer_tagline}</span>
      </div>
    </footer>
  )
}
