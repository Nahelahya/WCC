import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { coachApi, landingApi, sessionApi } from '@/api/client'
import { useAsync } from '@/lib/hooks'
import { buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LogoMark } from '@/components/ui/Logo'
import { ScheduleCard } from '@/components/cards/ScheduleCard'
import { CoachCard } from '@/components/cards/CoachCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/Feedback'
import { todayISO } from '@/lib/date'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getLandingDefaults } from '@/lib/landing-defaults'
import type { LandingContent } from '@/types.landing'

/** Render link internal dengan react-router; selain itu pakai <a> biasa. */
function ContentLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const isExternal = /^(https?:|mailto:|tel:|#)/i.test(href) || href.includes('#')
  if (isExternal) {
    return (
      <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

export function LandingPage() {
  const landing = useAsync(() => landingApi.get(), [])
  const sessions = useAsync(() => sessionApi.list(), [])
  const coaches = useAsync(() => coachApi.list(), [])
  const liveStats = useAsync(() => landingApi.stats(), [])
  const today = todayISO()

  const content: LandingContent = (landing.data as LandingContent | null) ?? getLandingDefaults()

  const upcoming = (sessions.data ?? [])
    .filter((s) => !s.cancelled && s.date >= today)
    .slice(0, 3)

  const coachItems = content.coaches.items.length
    ? content.coaches.items
    : (coaches.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        expertise: c.expertise,
        experience: c.experience,
        photoUrl: c.photoUrl,
      }))

  const hero = content.hero
  const about = content.about

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #F28C28 0, transparent 42%), radial-gradient(circle at 85% 10%, #ffffff 0, transparent 38%)',
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold tracking-wide">
              <Icon name="mountain" size={15} />
              WISANGGENI CLIMBING CLUB
            </span>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.12] tracking-tight sm:text-[46px]">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-base">{hero.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ContentLink href={hero.ctaPrimaryHref} className={buttonClasses('accent', 'lg')}>
                <Icon name="plus" size={18} />
                {hero.ctaPrimaryLabel}
              </ContentLink>
              <ContentLink
                href={hero.ctaSecondaryHref}
                className={buttonClasses('secondary', 'lg', 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
              >
                {hero.ctaSecondaryLabel}
              </ContentLink>
            </div>

            {about.stats.length > 0 && (
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/20 pt-6">
                {about.stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-2xl font-bold text-accent">{s.value}</dt>
                    <dd className="mt-0.5 text-[12.5px] text-white/70">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Visual: foto hero, atau logo bila belum diunggah. */}
          <div className="relative">
            {hero.imageUrl ? (
              <img
                src={hero.imageUrl}
                alt="Kegiatan WISANGGENI CLIMBING CLUB"
                className="aspect-[4/3] w-full rounded-card border border-white/20 object-cover"
              />
            ) : (
              <div className="rounded-card border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-center rounded-card bg-white/95 p-6">
                  <LogoMark size={104} />
                </div>
                <p className="mt-4 text-center text-[12.5px] text-white/70">
                  Area foto kegiatan klub — siap diganti dengan foto dokumentasi.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tentang */}
      <section id="tentang" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <StatusBadge tone="accent" icon="mountain">
              {about.badge}
            </StatusBadge>
            <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{about.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{about.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {about.stats.map((s, i) => (
              <div key={s.label} className="card p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon name={i % 2 === 0 ? 'check-circle' : 'users'} size={20} />
                </span>
                <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{s.value}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistik anggota (real-time) */}
      <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5 text-center">
            <p className="text-[32px] font-bold text-primary">
              {liveStats.loading ? '…' : (liveStats.data?.activeMembers ?? 0).toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[14px] text-muted">Anggota Aktif</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-[32px] font-bold text-primary">
              {liveStats.loading ? '…' : (liveStats.data?.coachCount ?? 0).toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[14px] text-muted">Coach</p>
          </div>
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-16">
        <div className="text-center">
          <StatusBadge tone="accent" icon="wallet">Harga</StatusBadge>
          <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">Paket &amp; Biaya</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Pilih paket yang sesuai untuk Anda. Semua harga dalam Rupiah.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card p-6 text-center">
            <h3 className="text-[17px] font-semibold text-ink">Trial</h3>
            <p className="mt-2 text-[28px] font-bold text-primary">Rp10.000</p>
            <p className="mt-1 text-[13px] text-muted">per sesi latihan</p>
            <p className="mt-3 text-[13px] text-muted">Coba latihan tanpa komitmen.</p>
          </div>
          <div className="card p-6 text-center">
            <h3 className="text-[17px] font-semibold text-ink">Anggota</h3>
            <p className="mt-2 text-[28px] font-bold text-primary">Rp50.000</p>
            <p className="mt-1 text-[13px] text-muted">biaya pendaftaran (sekali bayar)</p>
            <p className="mt-3 text-[13px] text-muted">Akses penuh ke latihan &amp; fasilitas klub.</p>
          </div>
          <div className="card p-6 text-center">
            <h3 className="text-[17px] font-semibold text-ink">Iuran Kas</h3>
            <p className="mt-2 text-[28px] font-bold text-primary">Rp60.000</p>
            <p className="mt-1 text-[13px] text-muted">per bulan (boleh dicicil)</p>
            <p className="mt-3 text-[13px] text-muted">Iuran kas bulanan anggota.</p>
          </div>
        </div>
      </section>

      {/* Jadwal */}
      <section id="jadwal" className="scroll-mt-20 border-y border-line bg-surface/70 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <StatusBadge tone="info" icon="calendar">
                {content.schedule.badge}
              </StatusBadge>
              <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{content.schedule.title}</h2>
              {content.schedule.description && (
                <p className="mt-1.5 text-sm text-muted">{content.schedule.description}</p>
              )}
            </div>
          </div>

          {content.schedule.items.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {content.schedule.items.map((it) => (
                <div key={`${it.day}-${it.time}`} className="card p-5">
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">{it.day}</p>
                  <p className="mt-2 text-lg font-bold text-ink">{it.time}</p>
                  <p className="mt-1.5 text-[14px] text-muted">{it.activity}</p>
                  {it.note && <p className="mt-2 text-[12.5px] text-muted/80">{it.note}</p>}
                </div>
              ))}
            </div>
          ) : sessions.loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : sessions.error ? (
            <div className="card">
              <ErrorState message={sessions.error} onRetry={sessions.reload} />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="calendar"
                title="Belum ada jadwal latihan mendatang."
                description="Jadwal baru akan tampil di sini setelah pengurus mempublikasikannya."
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((s) => (
                <ScheduleCard
                  key={s.id}
                  session={s}
                  coach={coaches.data?.find((c) => c.id === s.coachId) ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Coach */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <StatusBadge tone="primary" icon="users">
              {content.coaches.badge}
            </StatusBadge>
            <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{content.coaches.title}</h2>
            {content.coaches.description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted">{content.coaches.description}</p>
            )}
          </div>
          <Link to="/coach" className={buttonClasses('secondary', 'md')}>
            Lihat semua coach
            <Icon name="arrow-right" size={17} />
          </Link>
        </div>

        {coachItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coachItems.map((c) => {
              const live = 'id' in c && c.id ? coaches.data?.find((cc) => cc.id === c.id) ?? null : null
              if (live) return <CoachCard key={live.id} coach={live} />
              return (
                <div key={c.name} className="card p-5">
                  <div className="flex items-center gap-4">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-line" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon name="user" size={24} />
                      </span>
                    )}
                    <div>
                      <h3 className="text-[15.5px] font-semibold text-ink">{c.name}</h3>
                      <p className="mt-0.5 text-[13px] text-muted">{c.experience}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.expertise.map((e) => (
                      <span key={e} className="rounded-full bg-bg px-2.5 py-1 text-[12px] font-medium text-ink/80">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : coaches.loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} lines={2} />
            ))}
          </div>
        ) : null}
      </section>

      {/* Cara bergabung */}
      <section className="border-y border-line bg-surface/70 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <StatusBadge tone="accent" icon="list">
            {content.steps.badge}
          </StatusBadge>
          <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{content.steps.title}</h2>
          {content.steps.description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{content.steps.description}</p>}
          <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.steps.items.map((s, i) => (
              <li key={s.title} className="card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-[13.5px] text-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <ContentLink href={content.cta.ctaPrimaryHref} className={buttonClasses('primary', 'lg')}>
              Isi Formulir Pendaftaran
            </ContentLink>
            <Link to="/daftar/status" className={buttonClasses('secondary', 'lg')}>
              Cek Status Pendaftaran
            </Link>
          </div>
        </div>
      </section>

      {/* Galeri kegiatan */}
      {content.activities.items.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="mb-6">
            <StatusBadge tone="info" icon="image">
              {content.activities.badge}
            </StatusBadge>
            <h2 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{content.activities.title}</h2>
            {content.activities.description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted">{content.activities.description}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.activities.items.map((item) => (
              <figure key={item.id} className="group overflow-hidden rounded-card border border-line bg-surface">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex aspect-[16/10] w-full items-center justify-center bg-bg text-xs text-muted">
                    Belum ada gambar
                  </div>
                )}
                {(item.title || item.description) && (
                  <figcaption className="space-y-1 p-4">
                    {item.title && <p className="text-[14.5px] font-semibold text-ink">{item.title}</p>}
                    {item.description && <p className="text-[13px] text-muted">{item.description}</p>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-card bg-brand px-6 py-10 text-center text-white sm:px-12 sm:py-14">
          <h2 className="text-[26px] font-bold leading-tight sm:text-[32px]">{content.cta.title}</h2>
          {content.cta.description && (
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">{content.cta.description}</p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ContentLink href={content.cta.ctaPrimaryHref} className={buttonClasses('accent', 'lg')}>
              {content.cta.ctaPrimaryLabel}
            </ContentLink>
            <ContentLink
              href={content.cta.ctaSecondaryHref}
              className={buttonClasses('secondary', 'lg', 'border-white/30 bg-white/10 text-white hover:bg-white/20')}
            >
              {content.cta.ctaSecondaryLabel}
            </ContentLink>
          </div>
        </div>
      </section>
    </>
  )
}