# Joe.MakesStuff — self-hosted site + CMS

A React (Vite) rebuild of joemakesstuff.co.uk with a small Express/SQLite backend behind it, so
project content, images and video can be edited from a password-protected `/admin` panel instead
of the Wix editor.

## Before you launch it

- **Change the admin password immediately.** The very first time the server starts with no admin
  account in the database, it creates one from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in your `.env`
  (defaults to `admin` / `changeme` if you never set one — copy `.env.example` to `.env` and set a
  real password before that first run). After that, change it any time from **Change password** in
  the `/admin` header.
- **Contact email**: edit `src/data/content.js` — `CONTACT.email` currently reads
  `YOUR_EMAIL@joemakesstuff.co.uk`, a placeholder (the live Wix site never had a real one filled in
  either). Add `phone`, `instagram`, `linkedin` there too if you want them shown.
- **Bath Stadium and Scale Rule** never had their case-study copy filled in on the original Wix
  site — their intro paragraph now comes from your local project notes (`Bath.txt` / `ScaleRule.txt`
  in `D:\Port\Portfolio`) instead, but the build/outcome sections are still empty. Fill them in from
  `/admin` whenever you're ready.
- **Some build/showcase images are large animated GIFs** (a few are 10–24MB, pulled as-is from the
  original CMS export since Wix doesn't let you downsize an animated GIF, and there's no image
  tooling on this machine to compress them). Worth re-exporting a couple of those as compressed
  video and uploading the replacement from `/admin` when you get a chance — the affected projects
  are FurtherSpace, Ron the Robot, Predator 2024/2025, Axis, Bath Stadium, and Tier.
- **Uploaded media lives in `server/uploads/`** (~1.1GB total, including the project galleries,
  which now hold real full-resolution photos/clips) — make sure whatever host you pick actually has
  that much disk, and that you're backing that folder up (it's not just cache, it's your content).
- **Axis - Smart Shoe Insert** has a smaller gallery than the other projects (Wix CDN downloads, not
  local originals) — no export folder for it was available when the galleries were rebuilt from your
  local Wix export. Re-run `scripts/rebuild-gallery-from-export.mjs` after adding an Axis folder to
  the export directory if you want it upgraded to match the others.
- **Set `SITE_URL` in `.env`** to your real domain once it's live (defaults to
  `https://www.joemakesstuff.co.uk`). It's used to build the sitemap and every canonical/Open
  Graph URL — if it's wrong, search engines and social share previews will point at the wrong place.

## How the pieces fit together

- **Frontend**: React + Vite, in `src/`. The public site (`src/App.jsx` and `src/components/`)
  fetches project data live from the backend API — it's no longer hardcoded.
- **Backend**: Express + SQLite (`better-sqlite3`, zero external DB server needed) in `server/`.
  Serves the API, handles admin login, receives image/video uploads, and in production also serves
  the built frontend — so the whole site is one Node process.
- **Admin panel**: `src/admin/`, mounted at the `/admin` URL path, with four tabs:
  - **Projects** — add a new project (+ New Project), delete one, reorder them (↑/↓) or hide/show
    them on the live grid, and edit every field of an existing one (title, client, intro
    paragraphs, build section, outcome section, YouTube link, all images/video, and the gallery).
  - **Tiny Builds** — upload more photos or GIFs; static images are auto-cropped to a square
    server-side (via `sharp`), GIFs are kept as-is and cropped visually with CSS so the animation
    isn't touched.
  - **Services** — edit the title/description and swap the image or GIF for each service card.
  - **Site Settings** — background colour, a curated font picker, favicon, and a hero background
    image/GIF for the landing page intro.
- **Routing**: each project has its own real page and URL (`/work/<slug>`), not a popup — a tiny
  custom router in `src/router.jsx` handles this without pulling in a routing library. The YouTube
  link plays inline on that page (click-to-load, so nothing loads from YouTube until you click).
  Tiny Builds, Services, About and Contact are each their own page too (`/tiny-builds`, `/services`,
  `/about`, `/contact`) rather than being stacked under the landing page.
- **SEO**: `server/seo.js` rewrites `index.html`'s `<head>` per-route in production — real
  title/meta-description/canonical/Open Graph/Twitter-card tags per project (pulled from the
  database) instead of one static tag block for the whole site, plus JSON-LD structured data (a
  `Person` schema on the homepage, `CreativeWork` on each project page). `/sitemap.xml` is
  generated live from whichever projects are currently visible; `public/robots.txt` allows
  crawling and points at it, while blocking `/admin`. **This only runs in the production build**
  (`npm run build` + `npm start`/`npm run server`) — in local dev (`npm run dev`), Vite serves
  `index.html`'s plain defaults untouched, which is fine since search engines only ever see the
  deployed site.

  This covers what shows up in Google's results and in social link previews. It doesn't make the
  page content itself server-rendered — Google's crawler does execute the JavaScript and index the
  real content, just on a slower "second pass" than a fully server-rendered site would get. Once
  it's deployed:
  1. Add the site in [Google Search Console](https://search.google.com/search-console), verify
     domain ownership, and submit `https://www.joemakesstuff.co.uk/sitemap.xml` — this is what
     actually gets you indexed quickly rather than waiting for Google to find it on its own.
  2. Real backlinks (past clients, LinkedIn, agency directories) still matter more for ranking than
     anything on-page — not something code can do for you.

## Local development

You need two things running at once: the backend (API + uploads) and the Vite dev server (hot
reload for the frontend, proxies `/api` and `/uploads` through to the backend).

```bash
npm install
cp .env.example .env   # then edit .env and set a real ADMIN_PASSWORD
npm run dev:full
```

That starts both together. Site: http://localhost:5173 — Admin: http://localhost:5173/admin

(`npm run dev` and `npm run server` also exist separately if you'd rather run them in two
terminals.)

### First-time database setup

The SQLite database (`server/data/db.sqlite`) is created automatically the first time the server
starts. It needs to be seeded with the project content once — this repo already ships with it
seeded from the original Wix CMS export, so you shouldn't need to do this again unless you delete
`server/data/`:

```bash
npm run seed
```

## Deploying (self-hosting for real)

This needs a host that can run a persistent Node.js process — a VPS, a Docker host, or a platform
like Render/Railway/Fly.io. It will **not** work on a static-only host like GitHub Pages or Netlify
free tier, because the CMS needs a real server to log in to and write to.

```bash
npm run build   # builds the frontend into dist/
npm start       # builds + starts the server, which then also serves dist/ itself
```

`npm start` runs everything as a single Node process on `PORT` (default 4000) — put it behind
Nginx/Caddy for HTTPS and your domain, or run it directly if your host handles TLS for you. Use a
process manager (`pm2`, `systemd`, Docker's own restart policy) to keep it running and restart it on
reboot.

For a Raspberry Pi specifically, `deploy/setup-pi.sh` automates all of this (Node, Caddy, the
systemd service, the reverse proxy) in one run; `deploy/setup-kiosk.sh` sets up a touchscreen to
auto-launch `/dashboard` fullscreen on boot; `deploy/update.sh` pulls, rebuilds, and restarts for
later updates. Read through a script before running it — see the comments at the top of each.

Make sure `.env` (with your real `ADMIN_PASSWORD`) and the `server/data/` and `server/uploads/`
folders travel with the deploy and persist across restarts/redeploys — they're not build artifacts,
they're your actual data. **None of these three are in git** (see `.gitignore`) — `server/uploads/`
alone is over 1GB of real photos/video, too large for a git repo to carry sensibly. Copy them to
the server directly instead, e.g.:

```bash
rsync -avz --progress server/uploads/ youruser@yourserver:/path/to/app/server/uploads/
rsync -avz --progress server/data/ youruser@yourserver:/path/to/app/server/data/
scp .env youruser@yourserver:/path/to/app/.env
```

## Project structure

- `src/components/` — public site sections (Header, Hero, FeaturedWork, TinyBuilds, Services,
  About, Clients, Contact, Footer). TinyBuilds and Services now fetch from the API rather than
  hardcoded data.
- `src/data/content.js` — copy not managed by the CMS (about intro/experience/skills, tiny builds
  intro text, client logos, nav, contact details). Note: About's intro/experience/skills are
  file-based, not admin-editable yet — edit this file directly to change them.
- `src/fonts.js` — the curated list of Google Fonts offered in Site Settings (shared between the
  admin dropdown and the code that injects the font on the public site).
- `src/useInView.js` — small IntersectionObserver hook used to animate the About page's skill
  pills in as you scroll to them.
- `src/settings.jsx` — fetches site settings once and applies them (background colour, font,
  favicon) at the document level; also passes the hero background image down to `Hero.jsx`.
- `src/admin/` — the `/admin` UI: `ProjectList`/`ProjectEditor` (projects), `TinyBuildsAdmin`,
  `ServicesAdmin`, `SiteSettings`, plus `Login`/`ChangePassword`.
- `src/api.js` — fetch wrapper the frontend uses to talk to the backend.
- `src/router.jsx` — the tiny custom History-API router (`<Link>`, `useRouter()`) used for
  `/work/<slug>` project pages instead of a modal.
- `src/pages/` — `Home.jsx` (Hero + Featured Work + Clients), `ProjectPage.jsx` (the full project
  case-study page), and `TinyBuildsPage.jsx`/`ServicesPage.jsx`/`AboutPage.jsx`/`ContactPage.jsx`
  (thin wrappers so each section is also its own route).
- `server/index.js` — Express app: auth, projects/gallery/tiny-builds/services/settings APIs,
  image upload (including `sharp`-based square cropping for Tiny Builds), static serving.
- `server/db.js` — SQLite schema (`projects`, `gallery`, `tiny_builds`, `services`, `settings`,
  `admin` tables) and the one-time seed data for `services`/`tiny_builds`.
- `server/seed.js` — one-off script that populates the `projects` table from the original Wix CMS
  export.
- `server/seo.js` — builds per-route meta/JSON-LD and rewrites `index.html`'s `<head>` with it;
  also generates `/sitemap.xml`.
- `server/uploads/` — all uploaded media: `projects/<slug>/…` (with a `gallery/` subfolder),
  `tiny-builds/`, `services/`, and `site/` (favicon, hero background). Served at `/uploads/…`.
- `public/images/` — images not tied to any admin-editable content (logo, client logos, and the
  original Tiny Builds/Services images that got seeded into the database — safe to leave in place).
- `public/robots.txt` — allows crawling, blocks `/admin`, points at the sitemap.
- `scripts/download-assets.mjs` — pulled the banner/build media from Wix's CDN using the CMS
  export. Kept for reference, not something you need to run again.
- `scripts/import-gallery.mjs` — the first-pass gallery import: real photos from `D:\Port\Portfolio`
  for 10 projects, Wix CDN downloads for the other 3. Superseded by the script below; kept for
  reference.
- `scripts/rebuild-gallery-from-export.mjs` — rebuilt the `gallery` table again from Joe's full Wix
  project export (`WixExports` zips, one per project). Wix only number-prefixes video filenames on
  export ("05 - clip.mp4"), so the script uses those numbers for video order and appends all photos
  after; anything over 15MB is skipped to keep the site light. Machine-specific paths, kept for
  reference — the gallery is fully manageable from `/admin` now, so you shouldn't need to re-run it
  unless you get a fresh export to import (e.g. for Axis, see above).
