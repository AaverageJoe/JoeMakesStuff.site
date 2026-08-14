import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'db.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    client TEXT NOT NULL DEFAULT '',
    project_type TEXT NOT NULL DEFAULT '',
    intro1 TEXT NOT NULL DEFAULT '',
    intro2 TEXT NOT NULL DEFAULT '',
    dev_heading TEXT NOT NULL DEFAULT '',
    dev_message TEXT NOT NULL DEFAULT '',
    dev1_image TEXT,
    dev2_image TEXT,
    dev3_image TEXT,
    dev_video TEXT,
    dev_video_poster TEXT,
    outcomes_title TEXT NOT NULL DEFAULT '',
    outcomes_message TEXT NOT NULL DEFAULT '',
    youtube_url TEXT NOT NULL DEFAULT '',
    showcase_image TEXT,
    banner_video TEXT,
    banner_poster TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'image',
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_gallery_slug ON gallery(slug);

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    background_color TEXT,
    font_family TEXT,
    favicon_url TEXT,
    hero_bg_url TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tiny_builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'image',
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS site_copy (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
  CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    path TEXT,
    visitor_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

  CREATE TABLE IF NOT EXISTS crowd_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    idea TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    printed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_crowd_ideas_visitor ON crowd_ideas(visitor_id);

  CREATE TABLE IF NOT EXISTS crowd_ideas_blocklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crowd_howto_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    position INTEGER NOT NULL DEFAULT 0
  );
`)

// Migration: `visible` was added after the initial schema — existing
// databases won't have it yet, so add it if it's missing.
const projectColumns = db.prepare(`PRAGMA table_info(projects)`).all()
if (!projectColumns.some((c) => c.name === 'visible')) {
  db.exec(`ALTER TABLE projects ADD COLUMN visible INTEGER NOT NULL DEFAULT 1`)
}

// Bootstrap the single settings row so callers can always UPDATE it.
db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run()

// Seed the services table once from the original static copy, so the
// admin-managed version starts out matching what's already live.
const serviceCount = db.prepare(`SELECT COUNT(*) AS n FROM services`).get()
if (serviceCount.n === 0) {
  const defaults = [
    {
      title: 'Creative Technology Services',
      image_url: '/images/services/creative-tech.jpg',
      description:
        'The digital creative service centres on blending technology, hardware, and development to create engaging digital experiences. Joe.MakesStuff can support projects from early concept through prototyping, coding, systems integration, and on-site implementation, helping turn ideas into functional, interactive digital outputs. Whether it’s building custom software, connecting hardware with digital systems, or developing unique tech-driven experiences, we provide practical, hands-on expertise that brings creative technology projects to life.',
    },
    {
      title: 'Rapid Prototyping',
      image_url: '/images/services/rapid-prototyping.gif',
      description:
        'At Joe.MakesStuff, rapid prototyping is a core service — turning ideas into physical or digital prototypes quickly and effectively. From early ideation through CAD, fabrication, and iterative refinement, we help develop concepts into tangible, testable prototypes that support long-term product viability.',
    },
    {
      title: 'Interactive Exhibits / Activation',
      image_url: '/images/services/interactive-exhibits.jpg',
      description:
        'Another key service at Joe.MakesStuff is interactive exhibit and activation support, integrating technology seamlessly into physical builds. From concept exploration to hardware, software, and on-site implementation, we help create engaging, hands-on experiences that bring installations to life and enhance audience interaction.',
    },
    {
      title: 'Research and Development',
      image_url: '/images/services/rnd.jpg',
      description:
        'The R&D consultation service focuses on broader business and technology support, helping organisations uncover opportunities and shape strategic initiatives. Joe.MakesStuff can assist in identifying viable business cases, exploring emerging technologies, and defining early concepts that can strengthen operations, improve workflows, or unlock new avenues for innovation.',
    },
  ]
  const insertService = db.prepare(
    `INSERT INTO services (title, description, image_url, position) VALUES (?, ?, ?, ?)`
  )
  defaults.forEach((s, i) => insertService.run(s.title, s.description, s.image_url, i))
}

// Seed tiny_builds once from the original static gallery.
const tinyBuildCount = db.prepare(`SELECT COUNT(*) AS n FROM tiny_builds`).get()
if (tinyBuildCount.n === 0) {
  const files = [
    'tb01.jpg', 'tb02.png', 'tb03.jpg', 'tb04.jpg', 'tb05.jpg', 'tb06.jpg',
    'tb07.jpg', 'tb08.jpg', 'tb09.jpg', 'tb10.jpg', 'tb11.jpg', 'tb12.jpg',
  ]
  const insertTinyBuild = db.prepare(
    `INSERT INTO tiny_builds (url, kind, position) VALUES (?, 'image', ?)`
  )
  files.forEach((f, i) => insertTinyBuild.run(`/images/tiny-builds/${f}`, i))
}

// Seed the Crowd Sourcing Ideas blocklist with a starter set of common
// profanity — editable (add/remove) from /admin from then on.
const blocklistCount = db.prepare(`SELECT COUNT(*) AS n FROM crowd_ideas_blocklist`).get()
if (blocklistCount.n === 0) {
  const defaults = [
    'anal', 'anus', 'arse', 'arsehole', 'ass', 'asshole', 'bastard', 'bitch',
    'bollocks', 'bullshit', 'cock', 'crap', 'cum', 'cunt', 'dick', 'dildo',
    'douche', 'dyke', 'fag', 'faggot', 'fuck', 'fucked', 'fucker', 'fucking',
    'handjob', 'homo', 'jizz', 'kike', 'motherfucker', 'nigga', 'nigger',
    'paki', 'penis', 'piss', 'pissed', 'porn', 'prick', 'pussy', 'rape',
    'retard', 'scrotum', 'shit', 'shitty', 'slut', 'spic', 'tits', 'twat',
    'vagina', 'wank', 'whore',
  ]
  const insertWord = db.prepare(`INSERT OR IGNORE INTO crowd_ideas_blocklist (word) VALUES (?)`)
  defaults.forEach((w) => insertWord.run(w))
}

// Seed the Crowd Sourcing Ideas "how it works" steps — copy is ready, photos
// get added from /admin once real ones are taken.
const howtoStepCount = db.prepare(`SELECT COUNT(*) AS n FROM crowd_howto_steps`).get()
if (howtoStepCount.n === 0) {
  const defaults = [
    {
      title: 'Fill it in',
      description:
        "Pop your name and your idea into the form at the bottom of this page — name's capped at 30 characters, idea at 100, so keep it snappy.",
    },
    {
      title: "It's printing",
      description:
        'The second you hit submit, it starts printing out on the thermal printer on the rack, right there in the room.',
    },
    {
      title: 'Torn off and saved',
      description:
        "Your idea gets torn off the roll and kept, and it's saved digitally too — you can submit up to 5 ideas per device.",
    },
  ]
  const insertStep = db.prepare(
    `INSERT INTO crowd_howto_steps (title, description, position) VALUES (?, ?, ?)`
  )
  defaults.forEach((s, i) => insertStep.run(s.title, s.description, i))
}
