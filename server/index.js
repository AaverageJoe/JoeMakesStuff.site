import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import os from 'os'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { db } from './db.js'
import { verifyLogin, requireAuth, getAdmin, setPassword } from './auth.js'
import { FONT_KEYS } from '../src/fonts.js'
import { buildMeta, injectSeo, generateSitemap, SITE_URL } from './seo.js'
import { printCrowdIdea, isPrinterConnected } from './printer.js'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const DIST_DIR = path.join(__dirname, '..', 'dist')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// Windows can briefly hold a file handle open after sharp/ffmpeg finish
// reading it, so an immediate unlink sometimes fails with EBUSY/EPERM.
// Retry a few times with a short backoff instead of leaking temp files.
async function safeUnlink(filePath, attempts = 5, delayMs = 150) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.promises.unlink(filePath)
      return
    } catch (err) {
      if (err.code === 'ENOENT') return
      if (i === attempts - 1) {
        console.warn(`[tiny-builds] Could not remove temp file ${filePath}: ${err.message}`)
        return
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}

// Converts a video (or an oversized animated GIF) into a small, looping GIF —
// scaled down and palette-optimized so a busy grid of these doesn't ship
// megabytes of animation per thumbnail. Videos are trimmed to a short loop
// since these are hover-preview clips, not full playback.
function convertToGif(inputPath, outputPath, { maxSeconds = 4, width = 280, fps = 8, maxColors = 96 } = {}) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .duration(maxSeconds)
      .complexFilter([
        `[0:v] fps=${fps},scale=${width}:-1:flags=lanczos,split [a][b]`,
        `[a] palettegen=max_colors=${maxColors}:stats_mode=diff [p]`,
        `[b][p] paletteuse=dither=bayer:bayer_scale=3`,
      ])
      .outputOptions(['-loop', '0'])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath)
  })
}

// Applied to freshly uploaded project images/posters/gallery images (never
// to the dedicated video slots or gallery video clips) — without this, an
// unresized phone photo or a raw animated GIF is stored exactly as
// uploaded, which is how a handful of showcase images ended up 5-24MB and
// dominating the homepage's payload. Overwrites the file in place, same
// path/extension, so callers don't need to change the URL they already
// computed from multer's filename.
async function optimizeImageFile(filePath, mimetype) {
  if (mimetype === 'image/gif') {
    const tmpOut = `${filePath}.tmp.gif`
    await convertToGif(filePath, tmpOut, { maxSeconds: 6, width: 480, fps: 10, maxColors: 128 })
    await safeUnlink(filePath)
    await fs.promises.rename(tmpOut, filePath)
  } else if (/^image\/(jpeg|png|webp)$/.test(mimetype)) {
    const buffer = await sharp(filePath)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    await fs.promises.writeFile(filePath, buffer)
  }
}

// Recursively sums file sizes under a directory, for the storage stat on
// the rack dashboard. Walking the whole uploads tree is too slow to do on
// every dashboard poll, so the result is cached for a few minutes.
function getDirSize(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    total += entry.isDirectory() ? getDirSize(full) : fs.statSync(full).size
  }
  return total
}

let storageCache = { at: 0, bytes: 0 }
function getStorageBytes() {
  const now = Date.now()
  if (now - storageCache.at > 5 * 60 * 1000) {
    const uploadsBytes = fs.existsSync(UPLOADS_DIR) ? getDirSize(UPLOADS_DIR) : 0
    const dbPath = path.join(__dirname, 'data', 'db.sqlite')
    const dbBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
    storageCache = { at: now, bytes: uploadsBytes + dbBytes }
  }
  return storageCache.bytes
}

// Local system + response-time stats for the rack dashboard's performance
// tiles. Reads straight from /proc and /sys rather than shelling out to
// vcgencmd/free, so it stays cheap enough to call on every dashboard poll.
function getSystemPerformance() {
  const loadAvg = os.loadavg()
  const cpuCount = os.cpus().length

  let memTotalKB = os.totalmem() / 1024
  let memAvailableKB = os.freemem() / 1024
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8')
    // MemAvailable (not MemFree) accounts for reclaimable disk cache, which
    // Linux happily fills with free RAM — using MemFree alone would make
    // the Pi look constantly near-full even when it isn't.
    memTotalKB = Number(meminfo.match(/MemTotal:\s+(\d+)/)?.[1]) || memTotalKB
    memAvailableKB = Number(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1]) ?? memAvailableKB
  } catch {
    // Not on Linux (local dev) — fall back to the os.* values above.
  }
  const memUsedMB = Math.round((memTotalKB - memAvailableKB) / 1024)
  const memTotalMB = Math.round(memTotalKB / 1024)
  const memUsedPercent = memTotalKB ? Math.round((memUsedMB / memTotalMB) * 100) : null

  let cpuTempC = null
  try {
    const raw = Number(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8'))
    cpuTempC = Math.round(raw / 100) / 10
  } catch {
    // Not a Pi / no thermal zone exposed — leave null, the dashboard hides the tile.
  }

  let diskFreeMB = null
  let diskTotalMB = null
  try {
    if (typeof fs.statfsSync === 'function') {
      const stat = fs.statfsSync(__dirname)
      diskFreeMB = Math.round((stat.bfree * stat.bsize) / 1024 / 1024)
      diskTotalMB = Math.round((stat.blocks * stat.bsize) / 1024 / 1024)
    }
  } catch {
    // Can't determine — leave null rather than fail the whole stats response.
  }

  const avgResponseMs = responseTimesMs.length
    ? Math.round(responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length)
    : null
  const lastResponseMs = responseTimesMs.length ? Math.round(responseTimesMs[responseTimesMs.length - 1]) : null

  return {
    loadAvg,
    cpuCount,
    memUsedPercent,
    memUsedMB,
    memTotalMB,
    cpuTempC,
    diskFreeMB,
    diskTotalMB,
    avgResponseMs,
    lastResponseMs,
  }
}

// Runs a handful of real checks against the running server, for the
// ONLINE/OFFLINE status tile on the rack dashboard — tapping it shows this
// list so a fault (full disk, missing ffmpeg, DB lock) is diagnosable from
// the touchscreen alone, without SSH-ing into the Pi.
function runHealthChecks() {
  const checks = []

  try {
    db.prepare(`SELECT 1`).get()
    checks.push({ name: 'Database', ok: true, detail: 'Connected, query succeeded' })
  } catch (err) {
    checks.push({ name: 'Database', ok: false, detail: err.message })
  }

  try {
    fs.accessSync(UPLOADS_DIR, fs.constants.R_OK | fs.constants.W_OK)
    checks.push({ name: 'Uploads folder', ok: true, detail: UPLOADS_DIR })
  } catch (err) {
    checks.push({ name: 'Uploads folder', ok: false, detail: err.message })
  }

  try {
    const ok = fs.existsSync(ffmpegInstaller.path)
    checks.push({
      name: 'ffmpeg binary',
      ok,
      detail: ok ? ffmpegInstaller.path : `Not found at ${ffmpegInstaller.path}`,
    })
  } catch (err) {
    checks.push({ name: 'ffmpeg binary', ok: false, detail: err.message })
  }

  try {
    const admin = getAdmin()
    checks.push({
      name: 'Admin account',
      ok: !!admin,
      detail: admin ? `Configured (${admin.username})` : 'No admin account found',
    })
  } catch (err) {
    checks.push({ name: 'Admin account', ok: false, detail: err.message })
  }

  try {
    const connected = isPrinterConnected()
    checks.push({
      name: 'Thermal printer',
      ok: connected,
      detail: connected ? 'USB device present' : 'Not detected — check USB and power',
    })
  } catch (err) {
    checks.push({ name: 'Thermal printer', ok: false, detail: err.message })
  }

  try {
    if (typeof fs.statfsSync === 'function') {
      const stat = fs.statfsSync(__dirname)
      const freeMB = (stat.bfree * stat.bsize) / 1024 / 1024
      checks.push({ name: 'Disk space', ok: freeMB > 500, detail: `${freeMB.toFixed(0)} MB free` })
    } else {
      checks.push({ name: 'Disk space', ok: true, detail: 'Not checkable on this platform' })
    }
  } catch (err) {
    // Can't determine free space — that's not itself a fault, so don't fail the check over it.
    checks.push({ name: 'Disk space', ok: true, detail: `Could not check: ${err.message}` })
  }

  return { online: checks.every((c) => c.ok), checks }
}

// One-time bootstrap: create a default admin if none exists yet, so the
// server never starts in a state nobody can log into.
if (!getAdmin()) {
  const defaultPassword = process.env.ADMIN_PASSWORD || 'changeme'
  setPassword(process.env.ADMIN_USERNAME || 'admin', defaultPassword)
  console.warn(
    `\n[auth] No admin account found — created one.\n` +
      `  username: ${process.env.ADMIN_USERNAME || 'admin'}\n` +
      `  password: ${defaultPassword}\n` +
      (process.env.ADMIN_PASSWORD
        ? ''
        : `  This is the INSECURE DEFAULT password. Set ADMIN_PASSWORD in your .env and restart, or change it from /admin after logging in.\n`)
  )
}

const SECRET_PATH = path.join(__dirname, 'data', 'session-secret.txt')
let sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  if (fs.existsSync(SECRET_PATH)) {
    sessionSecret = fs.readFileSync(SECRET_PATH, 'utf8').trim()
  } else {
    sessionSecret = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(SECRET_PATH, sessionSecret)
  }
}

// One-way hash of the visitor's IP, salted with the server's own session
// secret — lets us count unique visitors without ever storing a raw IP.
// Prefers CF-Connecting-IP (set by Cloudflare's edge for tunnelled traffic —
// tamper-proof, since Cloudflare strips any client-supplied copy of this
// header before setting its own) and falls back to req.ip for LAN-only
// access that never touches Cloudflare.
function hashVisitor(req) {
  const ip = req.headers['cf-connecting-ip'] || req.ip
  return crypto.createHash('sha256').update(`${ip}:${sessionSecret}`).digest('hex').slice(0, 16)
}

const app = express()
// Caddy is the only thing that ever connects to this app directly (it's not
// exposed outside localhost) — trusting loopback lets Express read the real
// client IP out of X-Forwarded-For instead of seeing every request as
// 127.0.0.1. Without this, every visitor collapses into ~1-2 "unique"
// visitors regardless of who's actually browsing.
app.set('trust proxy', 'loopback')
const PORT = process.env.PORT || 4000
const SERVER_STARTED_AT = Date.now()

// Rolling sample of real request durations, for the "Site Load Speed" tile
// on the rack dashboard — measured server-side (request in to response
// flushed) rather than faked, so it actually reflects the CPU-contention
// slowdowns seen in production. Capped so it tracks recent behaviour, not
// the server's entire lifetime.
const RESPONSE_TIME_SAMPLE_CAP = 50
const responseTimesMs = []
app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    responseTimesMs.push(ms)
    if (responseTimesMs.length > RESPONSE_TIME_SAMPLE_CAP) responseTimesMs.shift()
  })
  next()
})

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'strict',
    },
  })
)

app.use('/uploads', express.static(UPLOADS_DIR))

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' })
  if (!verifyLogin(username, password)) return res.status(401).json({ error: 'Invalid credentials' })
  req.session.authenticated = true
  req.session.username = username
  res.json({ ok: true, username })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

app.get('/api/me', (req, res) => {
  if (req.session?.authenticated) return res.json({ authenticated: true, username: req.session.username })
  res.json({ authenticated: false })
})

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' })
  const admin = getAdmin()
  if (!verifyLogin(admin.username, currentPassword)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })
  setPassword(admin.username, newPassword)
  res.json({ ok: true })
})

// ---------- Projects ----------
const PROJECT_COLUMNS = [
  'slug', 'title', 'client', 'project_type', 'intro1', 'intro2',
  'dev_heading', 'dev_message', 'dev1_image', 'dev2_image', 'dev3_image',
  'dev_video', 'dev_video_poster', 'outcomes_title', 'outcomes_message',
  'youtube_url', 'showcase_image', 'banner_video', 'banner_poster',
  'sort_order', 'updated_at',
]

const EDITABLE_TEXT_FIELDS = [
  'title', 'client', 'project_type', 'intro1', 'intro2',
  'dev_heading', 'dev_message', 'outcomes_title', 'outcomes_message',
  'youtube_url', 'sort_order', 'visible',
]

const IMAGE_FIELDS = [
  'dev1_image', 'dev2_image', 'dev3_image', 'dev_video', 'dev_video_poster',
  'showcase_image', 'banner_video', 'banner_poster',
]

// The only two IMAGE_FIELDS that are actually meant to hold a real playable
// video, not a static image/poster — everything else in that list gets
// optimizeImageFile() treatment.
const VIDEO_TARGETS = new Set(['dev_video', 'banner_video'])

// Public: only projects marked visible, in their live display order.
app.get('/api/projects', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM projects WHERE visible = 1 ORDER BY sort_order ASC, title ASC`)
    .all()
  res.json(rows)
})

// Admin: every project regardless of visibility, for the CMS list.
app.get('/api/admin/projects', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM projects ORDER BY sort_order ASC, title ASC`).all()
  res.json(rows)
})

app.get('/api/projects/:slug', (req, res) => {
  const row = db.prepare(`SELECT * FROM projects WHERE slug = ?`).get(req.params.slug)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const gallery = db
    .prepare(`SELECT id, url, kind FROM gallery WHERE slug = ? ORDER BY position ASC, id ASC`)
    .all(req.params.slug)
  res.json({ ...row, gallery })
})

app.post('/api/projects', requireAuth, (req, res) => {
  const title = (req.body?.title || '').trim()
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!baseSlug) return res.status(400).json({ error: 'Could not derive a URL slug from that title' })

  let slug = baseSlug
  let n = 2
  while (db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)) {
    slug = `${baseSlug}-${n}`
    n++
  }

  const maxSort = db.prepare(`SELECT MAX(sort_order) AS m FROM projects`).get()
  const sortOrder = (maxSort.m ?? -1) + 1

  db.prepare(
    `INSERT INTO projects (slug, title, sort_order, visible) VALUES (?, ?, ?, 0)`
  ).run(slug, title, sortOrder)

  res.status(201).json(db.prepare(`SELECT * FROM projects WHERE slug = ?`).get(slug))
})

app.delete('/api/projects/:slug', requireAuth, (req, res) => {
  const { slug } = req.params
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  db.prepare(`DELETE FROM projects WHERE slug = ?`).run(slug) // gallery rows cascade
  const dir = path.join(UPLOADS_DIR, 'projects', slug)
  fs.rm(dir, { recursive: true, force: true }, () => {})
  res.json({ ok: true })
})

app.put('/api/projects/:slug', requireAuth, (req, res) => {
  const { slug } = req.params
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const updates = []
  const values = []
  for (const field of EDITABLE_TEXT_FIELDS) {
    if (field in (req.body || {})) {
      updates.push(`${field} = ?`)
      values.push(req.body[field])
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No editable fields provided' })
  updates.push(`updated_at = datetime('now')`)
  values.push(slug)

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE slug = ?`).run(...values)
  res.json(db.prepare(`SELECT * FROM projects WHERE slug = ?`).get(slug))
})

// ---------- Image upload ----------
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'projects', req.params.slug)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    const target = req.body.target || req.query.target
    cb(null, `${target}-${Date.now()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const target = req.body.target || req.query.target
    if (!IMAGE_FIELDS.includes(target)) return cb(new Error('Invalid target field'))
    cb(null, true)
  },
})

app.post('/api/projects/:slug/upload', requireAuth, upload.single('file'), async (req, res) => {
  const { slug } = req.params
  const target = req.body.target || req.query.target
  if (!IMAGE_FIELDS.includes(target)) return res.status(400).json({ error: 'Invalid target field' })
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  if (!VIDEO_TARGETS.has(target)) {
    try {
      await optimizeImageFile(req.file.path, req.file.mimetype)
    } catch (err) {
      console.warn(`[projects] Could not optimize ${req.file.path}: ${err.message}`)
    }
  }

  const url = `/uploads/projects/${slug}/${req.file.filename}`
  db.prepare(`UPDATE projects SET ${target} = ?, updated_at = datetime('now') WHERE slug = ?`).run(url, slug)
  res.json({ url, target })
})

// ---------- Gallery ----------
const galleryStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'projects', req.params.slug, 'gallery')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
  },
})
const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB, gallery can hold short video clips
})

app.post('/api/projects/:slug/gallery', requireAuth, galleryUpload.single('file'), async (req, res) => {
  const { slug } = req.params
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const kind = req.file.mimetype.startsWith('video') ? 'video' : 'image'
  if (kind === 'image') {
    try {
      await optimizeImageFile(req.file.path, req.file.mimetype)
    } catch (err) {
      console.warn(`[gallery] Could not optimize ${req.file.path}: ${err.message}`)
    }
  }

  const url = `/uploads/projects/${slug}/gallery/${req.file.filename}`
  const maxPos = db.prepare(`SELECT MAX(position) AS m FROM gallery WHERE slug = ?`).get(slug)
  const position = (maxPos.m ?? -1) + 1
  const info = db
    .prepare(`INSERT INTO gallery (slug, url, kind, position) VALUES (?, ?, ?, ?)`)
    .run(slug, url, kind, position)

  res.json({ id: info.lastInsertRowid, url, kind, position })
})

app.delete('/api/projects/:slug/gallery/:id', requireAuth, (req, res) => {
  const { slug, id } = req.params
  const row = db.prepare(`SELECT * FROM gallery WHERE id = ? AND slug = ?`).get(id, slug)
  if (!row) return res.status(404).json({ error: 'Not found' })
  db.prepare(`DELETE FROM gallery WHERE id = ?`).run(id)
  const filePath = path.join(UPLOADS_DIR, row.url.replace(/^\/uploads\//, ''))
  fs.unlink(filePath, () => {})
  res.json({ ok: true })
})

// ---------- Tiny Builds ----------
const TINY_BUILDS_DIR = path.join(UPLOADS_DIR, 'tiny-builds')
const TINY_BUILDS_TMP_DIR = path.join(UPLOADS_DIR, 'tmp')
const tinyBuildsUpload = multer({
  // Disk storage, not memory — raw phone videos before GIF conversion can
  // run to tens of megabytes, too large to hold as in-memory buffers.
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(TINY_BUILDS_TMP_DIR, { recursive: true })
      cb(null, TINY_BUILDS_TMP_DIR)
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname)}`)
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 }, // raw source video; discarded once converted to a small GIF
})

app.get('/api/tiny-builds', (req, res) => {
  res.json(db.prepare(`SELECT * FROM tiny_builds ORDER BY position ASC, id ASC`).all())
})

app.post('/api/tiny-builds', requireAuth, tinyBuildsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  fs.mkdirSync(TINY_BUILDS_DIR, { recursive: true })

  const isVideo = req.file.mimetype.startsWith('video/')
  const isGif = req.file.mimetype === 'image/gif'
  const id = crypto.randomBytes(6).toString('hex')
  const tempPath = req.file.path

  try {
    let filename
    if (isVideo || isGif) {
      // Videos and oversized animated GIFs are both re-encoded into a small,
      // palette-optimized looping GIF — the grid already displays them
      // square via CSS, so no separate cropping step is needed here.
      filename = `${id}.gif`
      await convertToGif(tempPath, path.join(TINY_BUILDS_DIR, filename))
    } else {
      filename = `${id}.jpg`
      await sharp(tempPath)
        .rotate() // respect EXIF orientation
        .resize(900, 900, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 88 })
        .toFile(path.join(TINY_BUILDS_DIR, filename))
    }

    const kind = isVideo || isGif ? 'gif' : 'image'
    const url = `/uploads/tiny-builds/${filename}`
    const maxPos = db.prepare(`SELECT MAX(position) AS m FROM tiny_builds`).get()
    const position = (maxPos.m ?? -1) + 1
    const info = db
      .prepare(`INSERT INTO tiny_builds (url, kind, position) VALUES (?, ?, ?)`)
      .run(url, kind, position)

    res.status(201).json({ id: info.lastInsertRowid, url, kind, position })
  } catch (err) {
    res.status(500).json({ error: `Could not process file: ${err.message}` })
  } finally {
    safeUnlink(tempPath)
  }
})

app.delete('/api/tiny-builds/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM tiny_builds WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  db.prepare(`DELETE FROM tiny_builds WHERE id = ?`).run(req.params.id)
  const filePath = path.join(UPLOADS_DIR, row.url.replace(/^\/uploads\//, ''))
  fs.unlink(filePath, () => {})
  res.json({ ok: true })
})

// ---------- Site copy ----------
// A schemaless key/value store — only fields an admin has actually edited
// exist as rows here. The frontend merges these over its own hardcoded
// defaults (src/copy.js), so the site reads correctly even with an empty
// table and new editable fields never need a migration.
function getSiteCopy() {
  const rows = db.prepare(`SELECT key, value FROM site_copy`).all()
  const copy = {}
  rows.forEach((row) => {
    copy[row.key] = row.value
  })
  return copy
}

app.get('/api/copy', (req, res) => {
  res.json(getSiteCopy())
})

app.put('/api/copy', requireAuth, (req, res) => {
  const fields = req.body || {}
  const upsert = db.prepare(
    `INSERT INTO site_copy (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
  const applyAll = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, String(value ?? ''))
    }
  })
  applyAll(Object.entries(fields))

  res.json(getSiteCopy())
})

// ---------- Services ----------
app.get('/api/services', (req, res) => {
  res.json(db.prepare(`SELECT * FROM services ORDER BY position ASC, id ASC`).all())
})

app.get('/api/admin/services', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM services ORDER BY position ASC, id ASC`).all())
})

app.put('/api/services/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const existing = db.prepare(`SELECT id FROM services WHERE id = ?`).get(id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const fields = ['title', 'description', 'position']
  const updates = []
  const values = []
  for (const field of fields) {
    if (field in (req.body || {})) {
      updates.push(`${field} = ?`)
      values.push(req.body[field])
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No editable fields provided' })
  values.push(id)

  db.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare(`SELECT * FROM services WHERE id = ?`).get(id))
})

const serviceImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'services')
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ''
      cb(null, `${req.params.id}-${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
})

app.post('/api/services/:id/upload', requireAuth, serviceImageUpload.single('file'), (req, res) => {
  const { id } = req.params
  const existing = db.prepare(`SELECT id FROM services WHERE id = ?`).get(id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const url = `/uploads/services/${req.file.filename}`
  db.prepare(`UPDATE services SET image_url = ? WHERE id = ?`).run(url, id)
  res.json({ url })
})

// ---------- Site settings ----------
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

app.get('/api/settings', (req, res) => {
  res.json(db.prepare(`SELECT * FROM settings WHERE id = 1`).get())
})

app.put('/api/settings', requireAuth, (req, res) => {
  const { background_color, font_family } = req.body || {}
  const updates = []
  const values = []

  if ('background_color' in (req.body || {})) {
    if (background_color !== null && !HEX_COLOR_RE.test(background_color)) {
      return res.status(400).json({ error: 'background_color must be a hex color like #0b0c0e' })
    }
    updates.push('background_color = ?')
    values.push(background_color)
  }
  if ('font_family' in (req.body || {})) {
    if (font_family !== null && !FONT_KEYS.includes(font_family)) {
      return res.status(400).json({ error: 'Invalid font_family' })
    }
    updates.push('font_family = ?')
    values.push(font_family)
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No editable fields provided' })

  updates.push(`updated_at = datetime('now')`)
  db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`).run(...values)
  res.json(db.prepare(`SELECT * FROM settings WHERE id = 1`).get())
})

const SETTINGS_ASSET_FIELDS = ['favicon_url', 'hero_bg_url']
const settingsStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'site')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    const target = req.body.target || req.query.target
    cb(null, `${target}-${Date.now()}${ext}`)
  },
})
const settingsUpload = multer({
  storage: settingsStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — covers a favicon or a hero gif
  fileFilter: (req, file, cb) => {
    const target = req.body.target || req.query.target
    if (!SETTINGS_ASSET_FIELDS.includes(target)) return cb(new Error('Invalid target field'))
    cb(null, true)
  },
})

app.post('/api/settings/upload', requireAuth, settingsUpload.single('file'), (req, res) => {
  const target = req.body.target || req.query.target
  if (!SETTINGS_ASSET_FIELDS.includes(target)) return res.status(400).json({ error: 'Invalid target field' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const url = `/uploads/site/${req.file.filename}`
  db.prepare(`UPDATE settings SET ${target} = ?, updated_at = datetime('now') WHERE id = 1`).run(url)
  res.json({ url, target })
})

app.delete('/api/settings/:field', requireAuth, (req, res) => {
  const { field } = req.params
  if (!SETTINGS_ASSET_FIELDS.includes(field)) return res.status(400).json({ error: 'Invalid field' })
  db.prepare(`UPDATE settings SET ${field} = NULL, updated_at = datetime('now') WHERE id = 1`).run()
  res.json(db.prepare(`SELECT * FROM settings WHERE id = 1`).get())
})

// ---------- Analytics: tracking + rack dashboard ----------
const EVENT_TYPES = new Set(['contact_click'])

app.post('/api/track/pageview', (req, res) => {
  const p = (req.body?.path || '').slice(0, 200)
  if (!p || p.startsWith('/admin') || p.startsWith('/dashboard')) return res.status(204).end()
  db.prepare(`INSERT INTO page_views (path, visitor_hash) VALUES (?, ?)`).run(p, hashVisitor(req))
  res.status(204).end()
})

app.post('/api/track/event', (req, res) => {
  const type = req.body?.type
  if (!EVENT_TYPES.has(type)) return res.status(400).json({ error: 'Unknown event type' })
  const p = (req.body?.path || '').slice(0, 200)
  db.prepare(`INSERT INTO events (type, path, visitor_hash) VALUES (?, ?, ?)`).run(type, p, hashVisitor(req))
  res.status(204).end()
})

app.get('/api/stats/dashboard', (req, res) => {
  const totalPageViews = db.prepare(`SELECT COUNT(*) AS n FROM page_views`).get().n
  const uniqueVisitors = db.prepare(`SELECT COUNT(DISTINCT visitor_hash) AS n FROM page_views`).get().n
  const todayViews = db
    .prepare(`SELECT COUNT(*) AS n FROM page_views WHERE date(created_at) = date('now')`)
    .get().n
  const last7Days = db
    .prepare(
      `SELECT date(created_at) AS date, COUNT(*) AS views
       FROM page_views
       WHERE created_at >= datetime('now', '-6 days', 'start of day')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .all()
  const contactRequests = db
    .prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'contact_click'`)
    .get().n

  const topProjectView = db
    .prepare(
      `SELECT path, COUNT(*) AS views
       FROM page_views
       WHERE path LIKE '/work/%'
       GROUP BY path
       ORDER BY views DESC
       LIMIT 1`
    )
    .get()
  let mostViewedProject = null
  if (topProjectView) {
    const slug = decodeURIComponent(topProjectView.path.replace(/^\/work\//, '').replace(/\/$/, ''))
    const project = db.prepare(`SELECT title FROM projects WHERE slug = ?`).get(slug)
    mostViewedProject = { slug, title: project?.title || slug, views: topProjectView.views }
  }

  const projectCount = db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE visible = 1`).get().n
  const tinyBuildsCount = db.prepare(`SELECT COUNT(*) AS n FROM tiny_builds`).get().n
  const crowdIdeasCount = db.prepare(`SELECT COUNT(*) AS n FROM crowd_ideas`).get().n
  const lastCrowdIdea = db.prepare(`SELECT name, idea, created_at FROM crowd_ideas ORDER BY id DESC LIMIT 1`).get()

  res.json({
    uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
    serverStartedAt: new Date(SERVER_STARTED_AT).toISOString(),
    totalPageViews,
    uniqueVisitors,
    todayViews,
    last7Days,
    contactRequests,
    storageBytes: getStorageBytes(),
    mostViewedProject,
    projectCount,
    tinyBuildsCount,
    crowdIdeasSummary: {
      count: crowdIdeasCount,
      lastName: lastCrowdIdea?.name ?? null,
      lastIdea: lastCrowdIdea?.idea ?? null,
      lastCreatedAt: lastCrowdIdea?.created_at ?? null,
      printerConnected: isPrinterConnected(),
    },
    health: runHealthChecks(),
    performance: getSystemPerformance(),
  })
})

// Full submissions list + delete, for the dashboard's Crowd Ideas modal.
// Nested under /api/stats/dashboard so Caddy's existing Basic Auth guard on
// that prefix covers these too — deliberately not requireAuth, since the
// dashboard has no app-level login of its own.
app.get('/api/stats/dashboard/crowd-ideas', (req, res) => {
  const ideas = db
    .prepare(`SELECT id, name, idea, printed, created_at FROM crowd_ideas ORDER BY id DESC LIMIT 500`)
    .all()
  res.json(ideas)
})

app.delete('/api/stats/dashboard/crowd-ideas/:id', (req, res) => {
  db.prepare(`DELETE FROM crowd_ideas WHERE id = ?`).run(req.params.id)
  res.status(204).end()
})

// ---------- Crowd Sourcing Ideas ----------
const CROWD_IDEA_NAME_MAX = 30
const CROWD_IDEA_TEXT_MAX = 142
const CROWD_IDEA_LIMIT = 5
const CROWD_VISITOR_COOKIE = 'cs_visitor'

// Always blocked from the name field, regardless of the admin-editable
// blocklist below — people kept submitting as "Joe"/"Joseph" pretending to
// be the site owner.
const CROWD_NAME_ALWAYS_BLOCKED = ['joe', 'joseph']

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Common leetspeak/look-alike substitutions, e.g. "sh1t" / "5hit" / "$hit".
const LEET_MAP = { 0: 'o', 1: 'i', '!': 'i', 3: 'e', 4: 'a', '@': 'a', 5: 's', $: 's', 7: 't', '+': 't', 8: 'b', 9: 'g', '|': 'i' }

function deleetify(str) {
  return str
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')
}

// "fuuuuck" -> "fuck", "bollocks" -> "bolocks": collapse any run of a
// repeated character down to one. Applied identically to both the input and
// the blocklist word before comparing, so this doesn't need to know in
// advance which letters a given word normally doubles up.
function collapseRepeats(str) {
  return str.replace(/(.)\1+/g, '$1')
}

// Cleans up common ways people dodge a word filter — inserted punctuation
// ("f.u.c.k", "f-u-c-k", "f*ck"), spelling a word out one letter at a time
// with real spaces ("f u c k"), leetspeak, and stretched-out letters — while
// still relying on \b word-boundary matching below, so it doesn't start
// flagging substrings buried in unrelated words ("assassin", "class").
function normalizeForFuzzyMatch(text) {
  let s = text.toLowerCase()
  s = s.replace(/\b(?:[a-z0-9]\s+){2,}[a-z0-9]\b/g, (m) => m.replace(/\s+/g, ''))
  s = s.replace(/([a-z0-9])[^a-z0-9\s]+(?=[a-z0-9])/g, '$1')
  s = deleetify(s)
  return collapseRepeats(s)
}

// Whole-word, case-insensitive match — so e.g. a blocked word "ass" doesn't
// also flag "assassin" or "class". Checked against both the text as typed
// and a fuzzy-normalized version, to catch obfuscated spellings too.
function containsWord(text, word) {
  const collapsedWord = collapseRepeats(word)
  const pattern = new RegExp(`\\b${escapeRegExp(collapsedWord)}\\b`, 'i')
  return pattern.test(text) || pattern.test(normalizeForFuzzyMatch(text))
}

// Handles a single symbol standing in for a whole letter — "f*ck", "sh*t",
// "a**hole" — which punctuation-stripping can't recover, since there's no
// way to tell how many letters a "*" replaced. Instead: split into
// space-delimited tokens, and for any token containing a censor symbol,
// check whether it's the exact same length as a blocklist word with every
// non-wildcard character matching it position-for-position.
const CENSOR_WILDCARD = /[*#%]/
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9*#%]+|[^a-z0-9*#%]+$/g, ''))
}
function wildcardMatchesWord(token, word) {
  if (!CENSOR_WILDCARD.test(token) || token.length !== word.length) return false
  for (let i = 0; i < token.length; i++) {
    if (CENSOR_WILDCARD.test(token[i])) continue
    if (token[i] !== word[i]) return false
  }
  return true
}

function findBlockedWord(text, words) {
  const tokens = tokenize(text)
  return words.find((w) => containsWord(text, w) || tokens.some((t) => wildcardMatchesWord(t, w)))
}

function getCrowdIdeasBlocklist() {
  return db.prepare(`SELECT id, word FROM crowd_ideas_blocklist ORDER BY word ASC`).all()
}

// Counts only submissions made since the admin last reset the limit —
// resetting doesn't delete anything, it just moves this watermark forward
// so everyone's count effectively goes back to 0 without losing history.
function getVisitorSubmissionCount(visitorId) {
  const { crowd_ideas_reset_at: resetAt } = db.prepare(`SELECT crowd_ideas_reset_at FROM settings WHERE id = 1`).get()
  if (resetAt) {
    return db
      .prepare(`SELECT COUNT(*) AS n FROM crowd_ideas WHERE visitor_id = ? AND created_at > ?`)
      .get(visitorId, resetAt).n
  }
  return db.prepare(`SELECT COUNT(*) AS n FROM crowd_ideas WHERE visitor_id = ?`).get(visitorId).n
}

// Identifies a submitter by browser (a long-lived cookie), not by IP —
// several people at the same event are typically on the same WiFi/NAT, so
// an IP-based limit (like hashVisitor() above) would cap the whole crowd
// together instead of 5 each.
function getCrowdVisitorId(req, res) {
  let id = req.cookies?.[CROWD_VISITOR_COOKIE]
  if (!id) {
    id = crypto.randomUUID()
    res.cookie(CROWD_VISITOR_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    })
  }
  return id
}

app.get('/api/crowd-ideas/remaining', (req, res) => {
  const visitorId = getCrowdVisitorId(req, res)
  const count = getVisitorSubmissionCount(visitorId)
  res.json({ remaining: Math.max(0, CROWD_IDEA_LIMIT - count), limit: CROWD_IDEA_LIMIT })
})

app.post('/api/crowd-ideas', (req, res) => {
  const name = (req.body?.name || '').trim()
  const idea = (req.body?.idea || '').trim()
  if (!name) return res.status(400).json({ error: 'Name is required' })
  if (!idea) return res.status(400).json({ error: 'Idea is required' })
  if (name.length > CROWD_IDEA_NAME_MAX)
    return res.status(400).json({ error: `Name must be ${CROWD_IDEA_NAME_MAX} characters or fewer` })
  if (idea.length > CROWD_IDEA_TEXT_MAX)
    return res.status(400).json({ error: `Idea must be ${CROWD_IDEA_TEXT_MAX} characters or fewer` })

  const blockedWords = getCrowdIdeasBlocklist().map((w) => w.word)
  if (findBlockedWord(name, [...blockedWords, ...CROWD_NAME_ALWAYS_BLOCKED])) {
    return res.status(400).json({ error: "That name isn't allowed — please use something else." })
  }
  if (findBlockedWord(idea, blockedWords)) {
    return res.status(400).json({ error: "Your idea contains language that isn't allowed here." })
  }

  const visitorId = getCrowdVisitorId(req, res)
  const count = getVisitorSubmissionCount(visitorId)
  if (count >= CROWD_IDEA_LIMIT) {
    return res.status(429).json({ error: `You've already submitted the maximum of ${CROWD_IDEA_LIMIT} ideas.` })
  }

  let printed = true
  try {
    printCrowdIdea({ name, idea })
  } catch (err) {
    printed = false
    console.warn(`[crowd-ideas] print failed: ${err.message}`)
  }

  db.prepare(`INSERT INTO crowd_ideas (name, idea, visitor_id, printed) VALUES (?, ?, ?, ?)`).run(
    name,
    idea,
    visitorId,
    printed ? 1 : 0
  )

  res.json({ ok: true, printed, remaining: CROWD_IDEA_LIMIT - (count + 1) })
})

app.get('/api/crowd-ideas/printer-status', (req, res) => {
  res.json({ connected: isPrinterConnected() })
})

app.get('/api/admin/crowd-ideas', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM crowd_ideas ORDER BY id DESC`).all()
  const { crowd_ideas_reset_at: resetAt } = db.prepare(`SELECT crowd_ideas_reset_at FROM settings WHERE id = 1`).get()
  res.json({ submissions: rows, resetAt })
})

app.delete('/api/admin/crowd-ideas/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM crowd_ideas WHERE id = ?`).run(req.params.id)
  res.status(204).end()
})

// Doesn't delete anything — moves the reset watermark forward so every
// visitor's submission count (checked against it in
// getVisitorSubmissionCount) effectively goes back to 0, letting everyone
// submit up to the limit again.
app.post('/api/admin/crowd-ideas/reset', requireAuth, (req, res) => {
  db.prepare(`UPDATE settings SET crowd_ideas_reset_at = datetime('now') WHERE id = 1`).run()
  res.json({ resetAt: db.prepare(`SELECT crowd_ideas_reset_at FROM settings WHERE id = 1`).get().crowd_ideas_reset_at })
})

app.get('/api/admin/crowd-ideas/blocklist', requireAuth, (req, res) => {
  res.json(getCrowdIdeasBlocklist())
})

app.post('/api/admin/crowd-ideas/blocklist', requireAuth, (req, res) => {
  const word = (req.body?.word || '').trim().toLowerCase()
  if (!word) return res.status(400).json({ error: 'Word is required' })
  try {
    const info = db.prepare(`INSERT INTO crowd_ideas_blocklist (word) VALUES (?)`).run(word)
    res.json({ id: info.lastInsertRowid, word })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That word is already blocked' })
    throw err
  }
})

app.delete('/api/admin/crowd-ideas/blocklist/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM crowd_ideas_blocklist WHERE id = ?`).run(req.params.id)
  res.status(204).end()
})

// "How it works" steps shown on the public crowd-ideas page — same
// title/description/image shape and edit pattern as services.
app.get('/api/crowd-howto-steps', (req, res) => {
  res.json(db.prepare(`SELECT * FROM crowd_howto_steps ORDER BY position ASC, id ASC`).all())
})

app.put('/api/crowd-howto-steps/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const existing = db.prepare(`SELECT id FROM crowd_howto_steps WHERE id = ?`).get(id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const fields = ['title', 'description']
  const updates = []
  const values = []
  for (const field of fields) {
    if (field in (req.body || {})) {
      updates.push(`${field} = ?`)
      values.push(req.body[field])
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No editable fields provided' })
  values.push(id)

  db.prepare(`UPDATE crowd_howto_steps SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  res.json(db.prepare(`SELECT * FROM crowd_howto_steps WHERE id = ?`).get(id))
})

const howtoStepImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'crowd-howto')
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ''
      cb(null, `${req.params.id}-${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
})

app.post(
  '/api/crowd-howto-steps/:id/upload',
  requireAuth,
  howtoStepImageUpload.single('file'),
  (req, res) => {
    const { id } = req.params
    const existing = db.prepare(`SELECT id FROM crowd_howto_steps WHERE id = ?`).get(id)
    if (!existing) return res.status(404).json({ error: 'Not found' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const url = `/uploads/crowd-howto/${req.file.filename}`
    db.prepare(`UPDATE crowd_howto_steps SET image_url = ? WHERE id = ?`).run(url, id)
    res.json({ url })
  }
)

// ---------- Kiosk control ----------
// Lets the rack touchscreen's own dashboard exit its fullscreen kiosk
// Chromium so the Pi's desktop underneath is usable. Deliberately gated on
// the Host header, not just app auth — the dashboard is also reachable
// remotely (joemakesstuff.uk, LAN IP), and a remote viewer shouldn't be able
// to blank the physical screen. Only a request that arrives with
// Host: localhost — i.e. the kiosk browser hitting the app directly,
// bypassing Caddy — is honoured.
app.post('/api/kiosk/hide', (req, res) => {
  const host = (req.headers.host || '').split(':')[0]
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return res.status(403).json({ error: 'Only available on the Pi itself' })
  }
  // Kill the lwrespawn supervisor first, then the browser itself — killing
  // just the browser would have lwrespawn immediately relaunch it.
  execFile('pkill', ['-f', 'lwrespawn.*chromium.*localhost:4000/dashboard'], () => {
    execFile('pkill', ['-f', 'chromium.*localhost:4000/dashboard'], () => {
      res.status(204).end()
    })
  })
})

// Reboots the Pi itself from the dashboard's Reboot button. Same
// Host-header gating as Hide, for the same reason — this must only be
// reachable by the kiosk browser hitting the app directly, never by a
// remote viewer on joemakesstuff.uk or the LAN. The `joe` user (this
// service's own user) has passwordless sudo for exactly this kind of
// system control, so no separate credential is needed.
app.post('/api/system/reboot', (req, res) => {
  const host = (req.headers.host || '').split(':')[0]
  if (host !== 'localhost' && host !== '127.0.0.1') {
    return res.status(403).json({ error: 'Only available on the Pi itself' })
  }
  res.status(204).end()
  // Let the response above actually reach the browser before the machine
  // goes down mid-request.
  setTimeout(() => execFile('sudo', ['reboot']), 500)
})

// ---------- SEO: sitemap & robots ----------
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(generateSitemap())
})

// Dynamic so it always points at the sitemap on whatever domain it's
// actually served from, instead of a stale hardcoded one.
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  )
})

// ---------- Static frontend (production) ----------
if (fs.existsSync(DIST_DIR)) {
  // index: false — otherwise express.static auto-serves the raw index.html
  // for "/" before the SEO middleware below ever runs, skipping injection.
  app.use(express.static(DIST_DIR, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    const template = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8')
    const meta = buildMeta(req.path)
    res.send(injectSeo(template, meta))
  })
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
