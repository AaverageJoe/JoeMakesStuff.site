import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { db } from '../server/db.js'

const PORTFOLIO_DIR = 'D:\\Port\\Portfolio'
const UPLOADS_DIR = path.resolve('server/uploads/projects')
const CSV_PATH = 'C:\\Users\\joe.allison\\Downloads\\Project+Pages.csv'
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_PER_PROJECT = 14
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

const FOLDER_TO_SLUG = {
  '01_SL72': 'sl72_project',
  '02_Pred24': 'adi-predator-2024',
  '03_NavStar': 'axis---smart-shoe-insert',
  '04_Toyota': 'toyota--race-to-win',
  '05_Ian The Robot': 'robotics',
  '06_Ron the Robot': 'ron---the-robot',
  '07_ScaleRule': 'scalerule',
  '09_FurtherSpace': 'furtherspace---ar-vr',
  '10_Bath Stadium': 'bath-stadium',
  '11_Tier': 'tier',
}

// Bath Stadium and Scale Rule never got case-study copy in the CMS export —
// but Joe's local project notes have it. Backfill intro1 only if still empty.
const TEXT_BACKFILL = {
  'bath-stadium': path.join(PORTFOLIO_DIR, '10_Bath Stadium', 'Bath.txt'),
  scalerule: path.join(PORTFOLIO_DIR, '07_ScaleRule', 'ScaleRule.txt'),
}

db.prepare(`DELETE FROM gallery`).run()

const insertGallery = db.prepare(
  `INSERT INTO gallery (slug, url, kind, position) VALUES (?, ?, 'image', ?)`
)

function importLocalFolder(folderName, slug) {
  const dir = path.join(PORTFOLIO_DIR, folderName)
  if (!fs.existsSync(dir)) {
    console.log(`  (no local folder for ${slug})`)
    return
  }
  const destDir = path.join(UPLOADS_DIR, slug, 'gallery')
  fs.mkdirSync(destDir, { recursive: true })

  const files = fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => ({ name: f, full: path.join(dir, f) }))
    .filter((f) => fs.statSync(f.full).size <= MAX_IMAGE_BYTES)
    .slice(0, MAX_PER_PROJECT)

  files.forEach((f, i) => {
    const destName = `${i}${path.extname(f.name).toLowerCase()}`
    fs.copyFileSync(f.full, path.join(destDir, destName))
    insertGallery.run(slug, `/uploads/projects/${slug}/gallery/${destName}`, i)
  })
  console.log(`  ${slug}: imported ${files.length} local images`)
}

console.log('Importing local galleries...')
for (const [folder, slug] of Object.entries(FOLDER_TO_SLUG)) {
  importLocalFolder(folder, slug)
}

// Backfill missing case-study text from local notes.
for (const [slug, txtPath] of Object.entries(TEXT_BACKFILL)) {
  const row = db.prepare(`SELECT intro1 FROM projects WHERE slug = ?`).get(slug)
  if (row && !row.intro1 && fs.existsSync(txtPath)) {
    const text = fs.readFileSync(txtPath, 'utf8').trim()
    if (text) {
      db.prepare(`UPDATE projects SET intro1 = ?, updated_at = datetime('now') WHERE slug = ?`).run(
        text,
        slug
      )
      console.log(`  Backfilled intro copy for ${slug} from local notes`)
    }
  }
}

// The 3 remaining projects (viewmaster, thames-barrier, predator-2025) have
// no local folder — pull their gallery from the original Wix CMS export instead.
const REMOTE_SLUGS = ['viewmaster-project', 'thames-barrier', 'predator-2025---football-cage']

function parseImageUri(uri) {
  const m = uri?.match(/^wix:image:\/\/v1\/([^/]+)\//)
  return m ? m[1] : null
}

function extFromSlug(slug) {
  const m = slug.match(/~mv2\.(\w+)/) || slug.match(/\.(\w+)$/)
  return m ? m[1].toLowerCase() : 'jpg'
}

async function headSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const len = res.headers.get('content-length')
    return len ? parseInt(len, 10) : null
  } catch {
    return null
  }
}

async function importRemoteGallery(slug, galleryJson) {
  let items
  try {
    items = JSON.parse(galleryJson || '[]')
  } catch {
    items = []
  }
  const images = items.filter((i) => i.type === 'image').slice(0, MAX_PER_PROJECT)
  const destDir = path.join(UPLOADS_DIR, slug, 'gallery')
  fs.mkdirSync(destDir, { recursive: true })

  let position = 0
  for (const item of images) {
    const mediaSlug = parseImageUri(item.src)
    if (!mediaSlug) continue
    const url = `https://static.wixstatic.com/media/${mediaSlug}/v1/fill/w_1000,h_1000,al_c,q_85/${mediaSlug}`
    const size = await headSize(url)
    if (size !== null && size > MAX_IMAGE_BYTES) continue
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      const destName = `${position}.${extFromSlug(mediaSlug)}`
      fs.writeFileSync(path.join(destDir, destName), buf)
      insertGallery.run(slug, `/uploads/projects/${slug}/gallery/${destName}`, position)
      position++
    } catch (e) {
      console.log(`  ${slug}: failed ${mediaSlug}: ${e.message}`)
    }
  }
  console.log(`  ${slug}: imported ${position} remote images`)
}

console.log('Importing remote galleries (Wix CDN)...')
let csvRaw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
const records = parse(csvRaw, { columns: true, skip_empty_lines: true })
function slugFromPage(page) {
  return decodeURIComponent(page.replace('/project-pages/', '')).replace(/\//g, '-')
}
for (const r of records) {
  const slug = slugFromPage(r['Project Page'])
  if (!REMOTE_SLUGS.includes(slug)) continue
  await importRemoteGallery(slug, r['Project Gallery'])
}

console.log('Done.')
