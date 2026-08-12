import { useEffect, useState } from 'react'

const CHANNEL_INTERVAL = 3400 // ms an image holds before the auto "channel change"
const GLITCH_DURATION = 260 // ms of glitch overlay during a channel change

export default function TinyBuildsRetro({ items }) {
  const [index, setIndex] = useState(0)
  const [glitching, setGlitching] = useState(false)

  const changeChannel = () => {
    setGlitching(true)
    setTimeout(() => {
      setIndex((i) => (i + 1) % items.length)
      setGlitching(false)
    }, GLITCH_DURATION)
  }

  useEffect(() => {
    if (items.length < 2) return
    const id = setInterval(changeChannel, CHANNEL_INTERVAL)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  const item = items[index]

  return (
    <div className="crt-stage">
      <div className="crt-set">
        <div className={`crt-screen${glitching ? ' is-glitching' : ''}`} onClick={changeChannel}>
          {item && <img src={item.url} alt="Tiny build" key={item.id} />}
          <div className="crt-scanlines" aria-hidden="true" />
          <div className="crt-vignette" aria-hidden="true" />
          <div className="crt-flicker" aria-hidden="true" />
        </div>
        <div className="crt-speaker" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <div className="crt-stand" aria-hidden="true" />
    </div>
  )
}
