import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = process.env.SEED_CSV_PATH || path.join(__dirname, 'data', 'Project+Pages.csv')
const MANIFEST_PATH = path.join(__dirname, 'uploads', 'projects', 'manifest.json')

const SORT_ORDER = [
  'sl72_project',
  'adi-predator-2024',
  'toyota--race-to-win',
  'furtherspace---ar-vr',
  'viewmaster-project',
  'ron---the-robot',
  'axis---smart-shoe-insert',
  'robotics',
  'predator-2025---football-cage',
  'thames-barrier',
  'tier',
  'bath-stadium',
  'scalerule',
]

function slugFromPage(page) {
  return decodeURIComponent(page.replace('/project-pages/', '')).replace(/\//g, '-')
}

function cleanProjectType(raw) {
  return (raw || '').replace(/^Project Type:\s*/, '').trim()
}

let csvRaw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
const records = parse(csvRaw, { columns: true, skip_empty_lines: true })
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
const manifestBySlug = Object.fromEntries(manifest.map((m) => [m.slug, m]))

const upsert = db.prepare(`
  INSERT INTO projects (
    slug, title, client, project_type, intro1, intro2,
    dev_heading, dev_message, dev1_image, dev2_image, dev3_image,
    dev_video, dev_video_poster, outcomes_title, outcomes_message,
    youtube_url, showcase_image, banner_video, banner_poster, sort_order
  ) VALUES (
    @slug, @title, @client, @project_type, @intro1, @intro2,
    @dev_heading, @dev_message, @dev1_image, @dev2_image, @dev3_image,
    @dev_video, @dev_video_poster, @outcomes_title, @outcomes_message,
    @youtube_url, @showcase_image, @banner_video, @banner_poster, @sort_order
  )
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title, client=excluded.client, project_type=excluded.project_type,
    intro1=excluded.intro1, intro2=excluded.intro2,
    dev_heading=excluded.dev_heading, dev_message=excluded.dev_message,
    dev1_image=excluded.dev1_image, dev2_image=excluded.dev2_image, dev3_image=excluded.dev3_image,
    dev_video=excluded.dev_video, dev_video_poster=excluded.dev_video_poster,
    outcomes_title=excluded.outcomes_title, outcomes_message=excluded.outcomes_message,
    youtube_url=excluded.youtube_url, showcase_image=excluded.showcase_image,
    banner_video=excluded.banner_video, banner_poster=excluded.banner_poster,
    sort_order=excluded.sort_order, updated_at=datetime('now')
`)

let count = 0
const insertMany = db.transaction((rows) => {
  for (const r of rows) {
    const slug = slugFromPage(r['Project Page'])
    const assets = manifestBySlug[slug] || {}
    upsert.run({
      slug,
      title: r['Title']?.trim() || '',
      client: r['Client: Name']?.trim() || '',
      project_type: cleanProjectType(r['Project: Type']),
      intro1: r['Intro: Paragraph 1']?.trim() || '',
      intro2: r['Intro: Paragraph 2']?.trim() || '',
      dev_heading: r['Development Heading']?.trim() || '',
      dev_message: r['Development Message']?.trim() || '',
      dev1_image: assets.devImages?.[0] || null,
      dev2_image: assets.devImages?.[1] || null,
      dev3_image: assets.devImages?.[2] || null,
      dev_video: assets.devVidVideo || null,
      dev_video_poster: assets.devVidPoster || null,
      outcomes_title: r['Outcomes Title']?.trim() || '',
      outcomes_message: r['Outcomes Message']?.trim() || '',
      youtube_url: r['EndCard']?.trim() || '',
      showcase_image: assets.showcase || null,
      banner_video: assets.bannerVideo || null,
      banner_poster: assets.bannerPoster || null,
      sort_order: SORT_ORDER.indexOf(slug) === -1 ? 999 : SORT_ORDER.indexOf(slug),
    })
    count++
  }
})

insertMany(records)
console.log(`Seeded ${count} projects.`)
