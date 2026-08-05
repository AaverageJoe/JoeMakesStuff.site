// Curated font options for the site-wide font setting. Using a fixed list
// (rather than a free-text field) means we can safely inject the Google
// Fonts <link> and there's no way an admin typo breaks the whole site.
export const FONT_OPTIONS = [
  {
    key: 'default',
    label: 'Default (Space Grotesk + Inter)',
    google: null,
    display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
  },
  {
    key: 'inter',
    label: 'Inter',
    google: 'Inter:wght@400;500;600;700',
    display: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  {
    key: 'poppins',
    label: 'Poppins',
    google: 'Poppins:wght@400;500;600;700',
    display: "'Poppins', system-ui, sans-serif",
    body: "'Poppins', system-ui, sans-serif",
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    google: 'Montserrat:wght@400;500;600;700',
    display: "'Montserrat', system-ui, sans-serif",
    body: "'Montserrat', system-ui, sans-serif",
  },
  {
    key: 'playfair-display',
    label: 'Playfair Display',
    google: 'Playfair+Display:wght@400;500;600;700',
    display: "'Playfair Display', Georgia, serif",
    body: "'Playfair Display', Georgia, serif",
  },
  {
    key: 'work-sans',
    label: 'Work Sans',
    google: 'Work+Sans:wght@400;500;600;700',
    display: "'Work Sans', system-ui, sans-serif",
    body: "'Work Sans', system-ui, sans-serif",
  },
  {
    key: 'dm-sans',
    label: 'DM Sans',
    google: 'DM+Sans:wght@400;500;600;700',
    display: "'DM Sans', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
  },
  {
    key: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    google: 'IBM+Plex+Sans:wght@400;500;600;700',
    display: "'IBM Plex Sans', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
  },
  {
    key: 'bebas-neue',
    label: 'Bebas Neue (display only, body stays Inter)',
    google: 'Bebas+Neue&family=Inter:wght@400;500;600',
    display: "'Bebas Neue', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
]

export const FONT_KEYS = FONT_OPTIONS.map((f) => f.key)

export function getFont(key) {
  return FONT_OPTIONS.find((f) => f.key === key) || FONT_OPTIONS[0]
}
