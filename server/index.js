import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { db } from './db.js'
import { verifyLogin, requireAuth, getAdmin, setPassword } from './auth.js'
import { FONT_KEYS } from '../src/fonts.js'
import { buildMeta, injectSeo, generateSitemap } from './seo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const DIST_DIR = path.join(__dirname, '..', 'dist')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

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

const app = express()
const PORT = process.env.PORT || 4000

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

app.post('/api/projects/:slug/upload', requireAuth, upload.single('file'), (req, res) => {
  const { slug } = req.params
  const target = req.body.target || req.query.target
  if (!IMAGE_FIELDS.includes(target)) return res.status(400).json({ error: 'Invalid target field' })
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

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

app.post('/api/projects/:slug/gallery', requireAuth, galleryUpload.single('file'), (req, res) => {
  const { slug } = req.params
  const existing = db.prepare(`SELECT slug FROM projects WHERE slug = ?`).get(slug)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const kind = req.file.mimetype.startsWith('video') ? 'video' : 'image'
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
const tinyBuildsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — covers a large GIF
})

app.get('/api/tiny-builds', (req, res) => {
  res.json(db.prepare(`SELECT * FROM tiny_builds ORDER BY position ASC, id ASC`).all())
})

app.post('/api/tiny-builds', requireAuth, tinyBuildsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  fs.mkdirSync(TINY_BUILDS_DIR, { recursive: true })

  const isGif = req.file.mimetype === 'image/gif'
  const id = crypto.randomBytes(6).toString('hex')

  try {
    let filename
    if (isGif) {
      // Animated GIFs are stored as-is — cropping risks breaking the
      // animation, and the grid already displays them square via CSS.
      filename = `${id}.gif`
      fs.writeFileSync(path.join(TINY_BUILDS_DIR, filename), req.file.buffer)
    } else {
      filename = `${id}.jpg`
      await sharp(req.file.buffer)
        .rotate() // respect EXIF orientation
        .resize(900, 900, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 88 })
        .toFile(path.join(TINY_BUILDS_DIR, filename))
    }

    const url = `/uploads/tiny-builds/${filename}`
    const maxPos = db.prepare(`SELECT MAX(position) AS m FROM tiny_builds`).get()
    const position = (maxPos.m ?? -1) + 1
    const info = db
      .prepare(`INSERT INTO tiny_builds (url, kind, position) VALUES (?, ?, ?)`)
      .run(url, isGif ? 'gif' : 'image', position)

    res.status(201).json({ id: info.lastInsertRowid, url, kind: isGif ? 'gif' : 'image', position })
  } catch (err) {
    res.status(500).json({ error: `Could not process image: ${err.message}` })
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

// ---------- SEO: sitemap ----------
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(generateSitemap())
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
