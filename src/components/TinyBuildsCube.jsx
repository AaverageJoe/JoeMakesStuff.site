import { useEffect, useRef, useState } from 'react'

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom']
const CELLS_PER_FACE = 36 // 6x6

// Each face gets its own offset through the image pool so the six faces
// don't all show an identical mosaic pattern.
function buildFaceIndexes(poolSize) {
  return FACES.map((_, faceIndex) =>
    Array.from({ length: CELLS_PER_FACE }, (_, cell) => (faceIndex * 41 + cell * 3) % poolSize)
  )
}

// One cell of the mosaic: cycles through the image pool forever on its own
// clock, independently of every other cell — fades out, swaps to a new
// random image, fades back in. Staggered random delays (rather than a
// shared interval) are what make the whole cube surface shimmer instead of
// blinking in lockstep.
function CubeCell({ items, initialIndex }) {
  const [index, setIndex] = useState(initialIndex)
  const [fading, setFading] = useState(false)
  const lastIndexRef = useRef(initialIndex)

  useEffect(() => {
    lastIndexRef.current = index
  }, [index])

  useEffect(() => {
    if (items.length < 2) return
    let swapTimer
    let holdTimer

    const scheduleSwap = () => {
      const holdTime = 3500 + Math.random() * 7000
      holdTimer = setTimeout(() => {
        setFading(true)
        swapTimer = setTimeout(() => {
          let next = Math.floor(Math.random() * items.length)
          if (next === lastIndexRef.current) next = (next + 1) % items.length
          setIndex(next)
          setFading(false)
          scheduleSwap()
        }, 380)
      }, holdTime)
    }

    scheduleSwap()
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(swapTimer)
    }
  }, [items.length])

  const item = items[index]
  if (!item) return <div className="cube-cell" />

  return (
    <div className={`cube-cell${fading ? ' is-fading' : ''}`}>
      <img src={item.url} alt="" loading="lazy" />
    </div>
  )
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

const FRICTION = 0.985 // per-frame velocity decay while coasting — close to 1 for a long, smooth coast
const CLICK_DRAG_THRESHOLD = 6 // px of movement beyond which a pointer down/up counts as a drag, not a click
const CLICK_SPIN_SPEED = 8 // degrees/frame impulse from a plain click
const MAX_FLICK_SPEED = 10 // degrees/frame cap, so one erratic fast drag can't send it spinning wildly

export default function TinyBuildsCube({ items }) {
  const cubeRef = useRef(null)
  const rotationRef = useRef({ x: -26, y: -35 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const faceIndexes = useRef(buildFaceIndexes(Math.max(items.length, 1)))

  useEffect(() => {
    faceIndexes.current = buildFaceIndexes(Math.max(items.length, 1))
  }, [items.length])

  const applyTransform = () => {
    if (!cubeRef.current) return
    const { x, y } = rotationRef.current
    cubeRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
  }

  useEffect(() => {
    applyTransform()
  }, [])

  // The cube never moves on its own — it only has momentum when a click or a
  // released drag ("flick") has put some into velocityRef, which this loop
  // bleeds off via friction each frame until it settles back to a stop.
  useEffect(() => {
    let raf
    const tick = () => {
      if (!dragRef.current) {
        const v = velocityRef.current
        if (Math.abs(v.x) > 0.002 || Math.abs(v.y) > 0.002) {
          rotationRef.current.x = clamp(rotationRef.current.x + v.x, -85, 85)
          rotationRef.current.y += v.y
          v.x *= FRICTION
          v.y *= FRICTION
          applyTransform()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handlePointerDown = (e) => {
    velocityRef.current = { x: 0, y: 0 }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      startRotX: rotationRef.current.x,
      startRotY: rotationRef.current.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > CLICK_DRAG_THRESHOLD || Math.abs(dy) > CLICK_DRAG_THRESHOLD) {
      drag.moved = true
    }
    rotationRef.current.y = drag.startRotY + dx * 0.4
    rotationRef.current.x = clamp(drag.startRotX - dy * 0.4, -85, 85)
    applyTransform()

    // Track instantaneous speed so a released drag can carry a "flick" of
    // momentum, scaled to roughly degrees-per-frame at 60fps.
    const now = performance.now()
    const dt = Math.max(now - drag.lastT, 1)
    velocityRef.current = {
      x: clamp((-(e.clientY - drag.lastY) * 0.4 * 16) / dt, -MAX_FLICK_SPEED, MAX_FLICK_SPEED),
      y: clamp(((e.clientX - drag.lastX) * 0.4 * 16) / dt, -MAX_FLICK_SPEED, MAX_FLICK_SPEED),
    }
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    drag.lastT = now
  }

  const handlePointerUp = () => {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved) {
      // A plain click/tap, not a drag — give it a spin instead of relying on
      // whatever noise the pointer picked up while sitting still.
      const direction = Math.random() < 0.5 ? -1 : 1
      velocityRef.current = { x: 0, y: direction * CLICK_SPIN_SPEED }
    }
    dragRef.current = null
  }

  return (
    <div className="cube-stage">
      <div
        className="cube"
        ref={cubeRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {FACES.map((face, faceIndex) => (
          <div className={`cube-face cube-face-${face}`} key={face}>
            <div className="cube-face-grid">
              {faceIndexes.current[faceIndex].map((cellIndex, i) => (
                <CubeCell items={items} initialIndex={cellIndex} key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
