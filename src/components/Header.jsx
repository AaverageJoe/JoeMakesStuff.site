import { useState } from 'react'
import { NAV_LINKS } from '../data/content'
import { Link } from '../router'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" to="/#top" onClick={() => setOpen(false)}>
          <img src="/images/logo.png" alt="Joe.MakesStuff" />
        </Link>
        <nav className={`site-nav ${open ? 'open' : ''}`}>
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          className="nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
    </header>
  )
}
