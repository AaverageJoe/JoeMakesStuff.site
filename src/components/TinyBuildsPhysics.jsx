import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

// Headless matter-js: physics bodies are the source of truth for position
// and rotation, rendered by writing a transform onto a plain DOM element
// each frame — no canvas involved, so real <img> tags (including animated
// GIFs) work exactly as they do everywhere else on the site.
const MAX_TILES = 200 // effectively "all of them" — a safety ceiling, not a real-world cap
const TILE_SIZE = 56 // smaller than before so a much bigger pile still fits the stage
const SPAWN_STAGGER = 45 // ms between each tile starting to fall — a cascade, not a dump
const EXPLODE_RADIUS = 260
const EXPLODE_SPEED = 9 // velocity kick for the nearest tiles, in matter-js's own units
const MAX_SPEED = 26 // hard cap so a fast tile can never tunnel through a wall

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function TinyBuildsPhysics({ items }) {
  const stageRef = useRef(null)
  const engineRef = useRef(null)
  const entriesRef = useRef([])
  const [renderList, setRenderList] = useState([])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || items.length === 0) return

    const width = stage.clientWidth
    const height = stage.clientHeight

    const engine = Matter.Engine.create()
    engine.gravity.y = 1
    engineRef.current = engine

    // Thick walls (not just thin lines) so a fast body is less likely to
    // tunnel through in a single step — backed up by a hard position clamp
    // in the render loop below as the real guarantee.
    const wallOpts = { isStatic: true, restitution: 0.15, friction: 0.6 }
    const ground = Matter.Bodies.rectangle(width / 2, height + 60, width * 2, 120, wallOpts)
    const leftWall = Matter.Bodies.rectangle(-60, height / 2, 120, height * 4, wallOpts)
    const rightWall = Matter.Bodies.rectangle(width + 60, height / 2, 120, height * 4, wallOpts)
    Matter.World.add(engine.world, [ground, leftWall, rightWall])

    const pool = items.slice(0, MAX_TILES)
    const entries = pool.map((item, i) => {
      const body = Matter.Bodies.rectangle(
        Math.random() * (width - TILE_SIZE) + TILE_SIZE / 2,
        -TILE_SIZE * 2 - i * 36,
        TILE_SIZE,
        TILE_SIZE,
        {
          restitution: 0.35,
          friction: 0.5,
          frictionAir: 0.012,
          angle: (Math.random() - 0.5) * 1.2,
        }
      )
      return { body, item, el: null }
    })
    entriesRef.current = entries
    setRenderList(entries)

    let cancelled = false
    entries.forEach(({ body }, i) => {
      setTimeout(() => {
        if (!cancelled) Matter.World.add(engine.world, body)
      }, i * SPAWN_STAGGER)
    })

    let raf
    let lastTime = performance.now()
    const tick = (now) => {
      const delta = Math.min(now - lastTime, 33)
      lastTime = now
      Matter.Engine.update(engine, delta)
      entriesRef.current.forEach(({ body }) => {
        // Hard safety clamp — the real guarantee against ever seeing a tile
        // fly off into space, regardless of collision/velocity tuning.
        const speed = Matter.Vector.magnitude(body.velocity)
        if (speed > MAX_SPEED) {
          Matter.Body.setVelocity(body, Matter.Vector.mult(body.velocity, MAX_SPEED / speed))
        }
        const margin = TILE_SIZE
        if (
          body.position.x < -margin ||
          body.position.x > width + margin ||
          body.position.y > height + margin * 2
        ) {
          Matter.Body.setPosition(body, {
            x: clamp(body.position.x, -margin, width + margin),
            y: Math.min(body.position.y, height + margin * 2),
          })
          Matter.Body.setVelocity(body, { x: 0, y: 0 })
        }
      })
      entriesRef.current.forEach(({ body, el }) => {
        if (!el) return
        el.style.transform = `translate(${body.position.x - TILE_SIZE / 2}px, ${
          body.position.y - TILE_SIZE / 2
        }px) rotate(${body.angle}rad)`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      Matter.World.clear(engine.world)
      Matter.Engine.clear(engine)
      entriesRef.current = []
    }
  }, [items])

  const handleStageClick = (e) => {
    if (!engineRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    entriesRef.current.forEach(({ body }) => {
      const dx = body.position.x - cx
      const dy = body.position.y - cy
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      if (dist < EXPLODE_RADIUS) {
        const falloff = 1 - dist / EXPLODE_RADIUS
        // Setting velocity directly (rather than applyForce, which divides
        // by mass internally and is easy to badly over/under-scale) gives
        // a predictable, directly-tunable kick.
        const speed = clamp(EXPLODE_SPEED * falloff, 0, MAX_SPEED)
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.6 * falloff)
        Matter.Body.setVelocity(body, {
          x: body.velocity.x + (dx / dist) * speed,
          y: body.velocity.y + (dy / dist) * speed - speed * 0.5,
        })
      }
    })
  }

  return (
    <div className="physics-stage" ref={stageRef} onClick={handleStageClick}>
      {renderList.map(({ item }, i) => (
        <div
          className="physics-tile"
          key={item.id}
          ref={(el) => {
            if (entriesRef.current[i]) entriesRef.current[i].el = el
          }}
        >
          <img src={item.url} alt="Tiny build" loading="lazy" />
        </div>
      ))}
    </div>
  )
}
