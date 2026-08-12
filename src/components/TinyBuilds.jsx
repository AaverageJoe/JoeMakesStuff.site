import { Suspense, lazy, useEffect, useState } from 'react'
import { api } from '../api'
import { useCopy } from '../copy'
import TinyBuildsGrid from './TinyBuildsGrid'

// Lazy-loaded: Grid is the default mode, so only it ships eagerly. The other
// three (Physics in particular, which pulls in matter-js) are fetched only
// when a visitor actually switches to them.
const TinyBuildsCube = lazy(() => import('./TinyBuildsCube'))
const TinyBuildsPhysics = lazy(() => import('./TinyBuildsPhysics'))
const TinyBuildsRetro = lazy(() => import('./TinyBuildsRetro'))

const MODES = [
  { key: 'grid', label: 'Grid Mode', hint: null },
  { key: 'cubic', label: 'Cubic Mode', hint: 'Click to give it a spin — hover any picture to see it up close.' },
  { key: 'physics', label: 'Physics Mode', hint: 'Click anywhere to send the pile flying.' },
  { key: 'retro', label: 'Retro Mode', hint: 'Click the screen to change the channel.' },
]

export default function TinyBuilds() {
  const [items, setItems] = useState([])
  const [mode, setMode] = useState('grid')
  const { copy } = useCopy()

  useEffect(() => {
    api.getTinyBuilds().then(setItems)
  }, [])

  const activeMode = MODES.find((m) => m.key === mode)

  return (
    <section id="tiny-builds">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">{copy.tiny_builds_eyebrow}</div>
          <h2>{copy.tiny_builds_heading}</h2>
          <p>{copy.tiny_builds_intro}</p>

          <div className="view-modes" role="tablist" aria-label="Tiny Builds view mode">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                className={`view-mode-btn${mode === m.key ? ' active' : ''}`}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {items.length > 0 && (
          <>
            <Suspense fallback={null}>
              {mode === 'grid' && <TinyBuildsGrid items={items} />}
              {mode === 'cubic' && <TinyBuildsCube items={items} />}
              {mode === 'physics' && <TinyBuildsPhysics items={items} />}
              {mode === 'retro' && <TinyBuildsRetro items={items} />}
            </Suspense>

            {activeMode?.hint && <p className="cube-hint">{activeMode.hint}</p>}
          </>
        )}
      </div>
    </section>
  )
}
