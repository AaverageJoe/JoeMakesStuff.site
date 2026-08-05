import { db } from './db.js'

const SITE_URL = (process.env.SITE_URL || 'https://www.joemakesstuff.co.uk').replace(/\/$/, '')
const SITE_NAME = 'Joe.MakesStuff'
const DEFAULT_DESCRIPTION =
  'Joe.MakesStuff — Creative technology studio specialising in rapid prototyping, interactive exhibits, and R&D consultation.'
const DEFAULT_IMAGE = `${SITE_URL}/images/logo.png`

function truncate(text, max = 160) {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).trim() + '…'
}

function absoluteUrl(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Builds { title, description, image, canonical, jsonld } for a given
// request path, pulling real data out of the database where relevant.
export function buildMeta(reqPath) {
  const canonical = `${SITE_URL}${reqPath === '/' ? '' : reqPath}`

  const workMatch = reqPath.match(/^\/work\/([^/]+)\/?$/)
  if (workMatch) {
    const slug = decodeURIComponent(workMatch[1])
    const project = db.prepare(`SELECT * FROM projects WHERE slug = ? AND visible = 1`).get(slug)
    if (project) {
      const description = truncate(project.intro1 || project.project_type || DEFAULT_DESCRIPTION)
      const image = absoluteUrl(project.showcase_image || project.banner_poster) || DEFAULT_IMAGE
      return {
        title: `${project.title} — ${SITE_NAME}`,
        description,
        image,
        canonical,
        jsonld: {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: project.title,
          description,
          image,
          url: canonical,
          creator: { '@type': 'Person', name: 'Joe Allison' },
          about: project.client || undefined,
        },
      }
    }
  }

  const pageMeta = {
    '/': {
      title: `${SITE_NAME} — Creative Technology Studio`,
      description: DEFAULT_DESCRIPTION,
    },
    '/tiny-builds': {
      title: `Tiny Builds — ${SITE_NAME}`,
      description:
        'Smaller side projects and experiments — from demo smart homes to a Lego camera — by creative technologist Joe Allison.',
    },
    '/services': {
      title: `Services — ${SITE_NAME}`,
      description:
        'Creative technology services: rapid prototyping, interactive exhibits and activations, and R&D consultation.',
    },
    '/about': {
      title: `About — ${SITE_NAME}`,
      description:
        'Joe Allison, Principal Creative Technologist — 8+ years building creative technology for Adidas, Toyota, Grimshaw, HS2 and more.',
    },
    '/contact': {
      title: `Contact — ${SITE_NAME}`,
      description: 'Get in touch about a rapid prototyping, interactive exhibit, or R&D project.',
    },
  }

  const meta = pageMeta[reqPath] || pageMeta['/']
  const isHome = reqPath === '/'

  return {
    title: meta.title,
    description: meta.description,
    image: DEFAULT_IMAGE,
    canonical,
    jsonld: isHome
      ? {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'Joe Allison',
          jobTitle: 'Principal Creative Technologist',
          url: SITE_URL,
          image: DEFAULT_IMAGE,
          worksFor: { '@type': 'Organization', name: SITE_NAME },
        }
      : undefined,
  }
}

// Rewrites the <head> of the built index.html with the real per-route meta.
export function injectSeo(html, meta) {
  let out = html

  out = out.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(meta.title)}</title>`)
  out = out.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`
  )
  out = out.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`)

  out = out.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeAttr(meta.title)}" />`)
  out = out.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeAttr(meta.description)}" />`)
  out = out.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${escapeAttr(meta.image)}" />`)
  out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escapeAttr(meta.canonical)}" />`)

  out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`)
  out = out.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`)
  out = out.replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`)

  if (meta.jsonld) {
    const script = `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>\n  </head>`
    out = out.replace('</head>', script)
  }

  return out
}

export function generateSitemap() {
  const projects = db.prepare(`SELECT slug FROM projects WHERE visible = 1`).all()
  const staticPaths = ['/', '/tiny-builds', '/services', '/about', '/contact']
  const paths = [...staticPaths, ...projects.map((p) => `/work/${p.slug}`)]

  const urls = paths
    .map((p) => `  <url><loc>${SITE_URL}${p === '/' ? '/' : p}</loc></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export { SITE_URL }
