import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

// Every piece of editable page copy, with its shipped default text. The
// admin's Site Copy page edits these one key at a time; a blank field there
// means "use the default" rather than literally saving an empty string —
// see the merge in CopyProvider below.
export const COPY_DEFAULTS = {
  hero_eyebrow: 'Creative Technology Studio',
  hero_lede:
    'I design and build the technology behind interactive exhibits, brand activations and rapid prototypes — blending hardware, software and fabrication to turn ideas into working experiences.',
  hero_cta_primary: 'See featured work',
  hero_cta_secondary: 'Get in touch',

  featured_work_eyebrow: 'Selected Work',
  featured_work_heading: 'Featured Work',
  featured_work_intro:
    'A selection of client projects spanning brand activations, interactive exhibits and hardware-driven experiences.',

  clients_eyebrow: 'Worked With',

  tiny_builds_eyebrow: 'Side Projects',
  tiny_builds_heading: 'The Tiny Builds',
  tiny_builds_intro:
    'Here’s some Tiny Builds — smaller things I’ve made over the years with and without clients. From demo smart homes to a Lego camera. More details for Tiny Builds coming soon.',

  services_eyebrow: 'What I Do',
  services_heading: 'Creative Technology Services',

  about_eyebrow: 'About',
  about_heading: 'Joe Allison',
  about_title: 'Principal Creative Technologist',
  about_intro:
    'For the past 8 years, I’ve been working across a range of industries as lead in the application of creative technologies for business. I have developed for clients and projects around the globe and consider myself a generalist across a range of technical skill sets, from game development, programming, CAD and electronics. A lot of my work includes rapid prototyping and R&D before project planning and leading the technical delivery for the project.',
  about_experience_heading: 'Experience',
  about_skills_heading: 'Skills',

  contact_eyebrow: 'Get In Touch',
  contact_heading: 'Got a project in mind?',
  contact_intro:
    "Whether it's rapid prototyping, an interactive exhibit, or an R&D consultation — let's talk about how to bring it to life.",

  footer_tagline: 'Creative Technology Studio',
}

// Grouped for the admin form — not used on the public site.
export const COPY_GROUPS = [
  {
    label: 'Hero',
    fields: [
      { key: 'hero_eyebrow', label: 'Eyebrow' },
      { key: 'hero_lede', label: 'Intro paragraph', multiline: true },
      { key: 'hero_cta_primary', label: 'Primary button label' },
      { key: 'hero_cta_secondary', label: 'Secondary button label' },
    ],
  },
  {
    label: 'Featured Work',
    fields: [
      { key: 'featured_work_eyebrow', label: 'Eyebrow' },
      { key: 'featured_work_heading', label: 'Heading' },
      { key: 'featured_work_intro', label: 'Intro paragraph', multiline: true },
    ],
  },
  {
    label: 'Worked With',
    fields: [{ key: 'clients_eyebrow', label: 'Eyebrow' }],
  },
  {
    label: 'Tiny Builds',
    fields: [
      { key: 'tiny_builds_eyebrow', label: 'Eyebrow' },
      { key: 'tiny_builds_heading', label: 'Heading' },
      { key: 'tiny_builds_intro', label: 'Intro paragraph', multiline: true },
    ],
  },
  {
    label: 'Services',
    fields: [
      { key: 'services_eyebrow', label: 'Eyebrow' },
      { key: 'services_heading', label: 'Heading' },
    ],
  },
  {
    label: 'About',
    fields: [
      { key: 'about_eyebrow', label: 'Eyebrow' },
      { key: 'about_heading', label: 'Heading' },
      { key: 'about_title', label: 'Job title' },
      { key: 'about_intro', label: 'Intro paragraph', multiline: true },
      { key: 'about_experience_heading', label: '"Experience" subheading' },
      { key: 'about_skills_heading', label: '"Skills" subheading' },
    ],
  },
  {
    label: 'Contact',
    fields: [
      { key: 'contact_eyebrow', label: 'Eyebrow' },
      { key: 'contact_heading', label: 'Heading' },
      { key: 'contact_intro', label: 'Intro paragraph', multiline: true },
    ],
  },
  {
    label: 'Footer',
    fields: [{ key: 'footer_tagline', label: 'Tagline' }],
  },
]

const CopyContext = createContext(null)

export function CopyProvider({ children }) {
  const [overrides, setOverrides] = useState({})

  const refresh = () => api.getCopy().then(setOverrides).catch(() => {})

  useEffect(() => {
    refresh()
  }, [])

  const copy = {}
  for (const key of Object.keys(COPY_DEFAULTS)) {
    copy[key] = overrides[key] || COPY_DEFAULTS[key]
  }

  return <CopyContext.Provider value={{ copy, overrides, refresh }}>{children}</CopyContext.Provider>
}

export function useCopy() {
  const ctx = useContext(CopyContext)
  if (!ctx) throw new Error('useCopy must be used within a CopyProvider')
  return ctx
}
