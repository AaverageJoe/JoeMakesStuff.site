import { CLIENT_LOGOS } from '../data/content'

// Acronyms/brand names that shouldn't be naively title-cased word-by-word.
const NAME_OVERRIDES = {
  hs2: 'HS2',
  lsbu: 'London South Bank University',
  rta: 'RTA (Roads & Transport Authority)',
  'hi3-network': 'HI3 Network',
  'ytl-arena-bristol': 'YTL Arena Bristol',
  'european-commission': 'European Commission',
  'north-london-heat-power': 'North London Heat and Power Project',
  'oman-botanic-garden': 'Oman Botanic Garden',
  'stadium-business-awards': 'The Stadium Business Awards',
  'stadium-for-bath': 'Stadium for Bath',
  'passenger-terminal-expo': 'Passenger Terminal Expo',
  'bap-biennale': 'BAP! Biennale',
  'golden-hinde': 'The Golden Hinde',
  'own-a-chord': 'Own A Chord',
  'further-space': 'FurtherSpace',
  'hughes-associates': 'Hughes & Associates',
  'whittle-laboratory': 'Whittle Laboratory',
  'ace-it': 'Ace IT',
  'foot-locker': 'Foot Locker',
}

function labelFor(src) {
  const key = src.split('/').pop().replace(/\.\w+$/, '')
  if (NAME_OVERRIDES[key]) return NAME_OVERRIDES[key]
  return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Clients() {
  return (
    <section id="clients" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="eyebrow">Worked With</div>
        <div className="clients-strip">
          {CLIENT_LOGOS.map((src) => (
            <img key={src} src={src} alt={labelFor(src)} loading="lazy" />
          ))}
        </div>
      </div>
    </section>
  )
}
