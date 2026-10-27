export interface LandingHero {
  title: string
  subtitle: string
  ctaPrimaryLabel: string
  ctaPrimaryHref: string
  ctaSecondaryLabel: string
  ctaSecondaryHref: string
  imageUrl?: string
}

export interface LandingAbout {
  badge: string
  title: string
  description: string
  stats: Array<{ label: string; value: string }>
}

export interface LandingScheduleItem {
  day: string
  time: string
  activity: string
  note?: string
}

export interface LandingSchedule {
  badge: string
  title: string
  description: string
  items: LandingScheduleItem[]
}

export interface LandingCoachItem {
  id?: string
  name: string
  expertise: string[]
  experience: string
  photoUrl?: string
}

export interface LandingCoaches {
  badge: string
  title: string
  description: string
  items: LandingCoachItem[]
}

export interface LandingStepItem {
  title: string
  desc: string
}

export interface LandingSteps {
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

export interface LandingActivities {
  badge: string
  title: string
  description: string
  items: LandingActivityItem[]
}

export interface LandingCta {
  title: string
  description: string
  ctaPrimaryLabel: string
  ctaPrimaryHref: string
  ctaSecondaryLabel: string
  ctaSecondaryHref: string
}

export interface LandingFooterContact {
  address: string
  email: string
  phone: string
}

export interface LandingFooterLink {
  label: string
  href: string
  external?: boolean
}

export interface LandingFooterSection {
  title: string
  links: LandingFooterLink[]
}

export interface LandingFooter {
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