interface LandingHero {
  title: string
  subtitle: string
  ctaPrimaryLabel: string
  ctaPrimaryHref: string
  ctaSecondaryLabel: string
  ctaSecondaryHref: string
  imageUrl?: string
}

interface LandingAbout {
  badge: string
  title: string
  description: string
  stats: Array<{ label: string; value: string }>
}

interface LandingScheduleItem {
  day: string
  time: string
  activity: string
  note?: string
}

interface LandingSchedule {
  badge: string
  title: string
  description: string
  items: LandingScheduleItem[]
}

interface LandingCoachItem {
  id?: string
  name: string
  expertise: string[]
  experience: string
  photoUrl?: string
}

interface LandingCoaches {
  badge: string
  title: string
  description: string
  items: LandingCoachItem[]
}

interface LandingStepItem {
  title: string
  desc: string
}

interface LandingSteps {
  badge: string
  title: string
  description?: string
  items: LandingStepItem[]
}

export interface LandingActivityItem {
  id: string
  title: string
  description: string
  imageUrl?: string
  /** Titik fokus horizontal foto (0–100%). Default 50 (tengah). */
  focusX?: number
  /** Titik fokus vertikal foto (0–100%). Default 50 (tengah). */
  focusY?: number
  /** Perbesaran foto di dalam bingkai (1–3). Default 1. */
  zoom?: number
}

interface LandingActivities {
  badge: string
  title: string
  description: string
  items: LandingActivityItem[]
}

interface LandingCta {
  title: string
  description: string
  ctaPrimaryLabel: string
  ctaPrimaryHref: string
  ctaSecondaryLabel: string
  ctaSecondaryHref: string
}

interface LandingFooterContact {
  address: string
  email: string
  phone: string
}

interface LandingFooterLink {
  label: string
  href: string
  external?: boolean
}

interface LandingFooterSection {
  title: string
  links: LandingFooterLink[]
}

interface LandingFooter {
  description: string
  contact: LandingFooterContact
  sections: LandingFooterSection[]
  copyright: string
}

export interface LandingContent {
  hero: LandingHero
  about: LandingAbout
  schedule: LandingSchedule
  coaches: LandingCoaches
  steps: LandingSteps
  activities: LandingActivities
  cta: LandingCta
  footer: LandingFooter
  updatedAt?: string
  updatedByName?: string | null
}