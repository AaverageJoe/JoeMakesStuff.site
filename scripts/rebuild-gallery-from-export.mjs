import fs from 'fs'
import path from 'path'
import { db } from '../server/db.js'

const EXPORT_DIR =
  'C:\\Users\\JOE~1.ALL\\AppData\\Local\\Temp\\claude\\D--Unity-Projects-SkateBoard-Project\\f2f46e67-f28f-44d4-939d-11efc7f9578d\\scratchpad\\wix-exports'
const UPLOADS_DIR = path.resolve('server/uploads/projects')

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_BYTES = 15 * 1024 * 1024
const MAX_PER_PROJECT = 20

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const VIDEO_EXT = new Set(['.mp4', '.webm'])
// .mov / .mkv / .m4v deliberately excluded — poor/no native <video> support in browsers.

const FOLDER_TO_SLUG = {
  'Bath Stadium': 'bath-stadium',
  'F50 _ Robot': 'robotics',
  FurtherSpace: 'furtherspace---ar-vr',
  Pred24_ProjectContent: 'adi-predator-2024',
  Pred25: 'predator-2025---football-cage',
  Ron_TheRobot: 'ron---the-robot',
  SL72_ProjectContent: 'sl72_project',
  ScaleRule: 'scalerule',
  'Thames Barrier': 'thames-barrier',
  Tier: 'tier',
  Toyota_ProjectContent: 'toyota--race-to-win',
  Viewmaster: 'viewmaster-project',
}

const insertGallery = db.prepare(
  `INSERT INTO gallery (slug, url, kind, position) VALUES (?, ?, ?, ?)`
)
const clearGallery = db.prepare(`DELETE FROM gallery WHERE slug = ?`)

let summary = []

for (const [folder, slug] of Object.entries(FOLDER_TO_SLUG)) {
  const dir = path.join(EXPORT_DIR, folder)
  if (!fs.existsSync(dir)) {
    summary.push(`${slug}: SKIPPED (no export folder)`)
    continue
  }

  const allFiles = fs.readdirSync(dir)

  // Wix's export only number-prefixes video items ("05 - clip.mp4"); photos
  // keep their original filename. Both are real gallery content — use
  // numbered videos in their given order first, then all photos after.
  const numbered = allFiles
    .map((name) => {
      const m = name.match(/^(\d+)\s*-\s*(.+)$/)
      if (!m) return null
      return { num: parseInt(m[1], 10), name, full: path.join(dir, name) }
    })
    .filter(Boolean)
    .sort((a, b) => a.num - b.num)

  const numberedNames = new Set(numbered.map((n) => n.name))
  const unnumberedImages = allFiles
    .filter((name) => !numberedNames.has(name) && IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => ({ name, full: path.join(dir, name) }))

  const candidates = [...numbered, ...unnumberedImages]

  const destDir = path.join(UPLOADS_DIR, slug, 'gallery')
  fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  clearGallery.run(slug)

  let position = 0
  let skippedSize = 0
  let skippedType = 0

  for (const item of candidates) {
    if (position >= MAX_PER_PROJECT) break
    const ext = path.extname(item.name).toLowerCase()
    const isImage = IMAGE_EXT.has(ext)
    const isVideo = VIDEO_EXT.has(ext)
    if (!isImage && !isVideo) {
      skippedType++
      continue
    }
    const size = fs.statSync(item.full).size
    const cap = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
    if (size > cap) {
      skippedSize++
      continue
    }
    const destName = `${position}${ext}`
    fs.copyFileSync(item.full, path.join(destDir, destName))
    insertGallery.run(slug, `/uploads/projects/${slug}/gallery/${destName}`, isVideo ? 'video' : 'image', position)
    position++
  }

  summary.push(
    `${slug}: ${position} items from ${numbered.length} numbered files (skipped ${skippedSize} too large, ${skippedType} unsupported type)`
  )
}

console.log(summary.join('\n'))
