import { useEffect, useMemo, useState } from 'react'
import BadgeIcon from './BadgeIcon'
import { BADGES_UNLOCKED_EVENT, BadgesUnlockedDetail } from '../../lib/badgeUnlocks'
import { badgeRarity, rarityLine, RARITY_CHIP_CLASSES } from '../../lib/badgeRarity'
import type { BadgeWithEarned } from '../../lib/types'

const CONFETTI_COLORS = ['#f73d2a', '#f1c12d', '#fdedb0', '#ff6e60', '#fffdf5', '#cf9b14']

interface Particle {
  left: string
  color: string
  size: number
  x: string
  y: string
  r: string
  d: string
  delay: string
  round: boolean
}

/** Deterministic-ish per-badge confetti so re-renders don't reshuffle mid-flight. */
function makeParticles(seedKey: string): Particle[] {
  let seed = 0
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  return Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + rand() * 0.5
    const dist = 90 + rand() * 150
    return {
      left: `${8 + rand() * 84}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.round(rand() * 6),
      x: `${Math.cos(angle) * dist}px`,
      y: `${120 + Math.sin(angle) * dist + rand() * 160}px`,
      r: `${360 + Math.round(rand() * 540)}deg`,
      d: `${1.1 + rand() * 0.9}s`,
      delay: `${rand() * 0.25}s`,
      round: rand() > 0.5,
    }
  })
}

/** Plain-English rarity line shared by the single and multi-badge views. */
function rarityText(badge: BadgeWithEarned): { chip: string | null; tierClass: string; text: string } | null {
  const rarity = badgeRarity(badge.earned_count, badge.member_count)
  if (!rarity) return null
  if (rarity.earnedCount <= 1) return { chip: null, tierClass: '', text: '🏆 First to earn this!' }
  return { chip: rarity.label, tierClass: RARITY_CHIP_CLASSES[rarity.tier], text: rarityLine(rarity) }
}

/**
 * Full-screen "Badge unlocked!" celebration. Mounted once in App; shows
 * whenever a badges-unlocked window event fires (see lib/badgeUnlocks).
 * Everything one action unlocks is shown in ONE overlay — a single badge
 * gets the big plate, several get "You unlocked 3 badges" with a list —
 * so the user closes it once instead of clicking through a modal per badge.
 */
export default function BadgeUnlockOverlay() {
  const [batch, setBatch] = useState<BadgeWithEarned[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const badges = (e as CustomEvent<BadgesUnlockedDetail>).detail?.badges
      if (!badges?.length) return
      setBatch(prev => {
        const seen = new Set(prev.map(b => b.id))
        return [...prev, ...badges.filter(b => !seen.has(b.id))]
      })
    }
    window.addEventListener(BADGES_UNLOCKED_EVENT, handler)
    return () => window.removeEventListener(BADGES_UNLOCKED_EVENT, handler)
  }, [])

  const open = batch.length > 0
  const close = () => setBatch([])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') setBatch([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const seedKey = batch.map(b => b.id).join('|')

  // A short celebratory buzz, where the device supports it.
  useEffect(() => {
    if (!seedKey) return
    try { navigator.vibrate?.([35, 45, 70]) } catch { /* not supported */ }
  }, [seedKey])

  const particles = useMemo(() => (seedKey ? makeParticles(seedKey) : []), [seedKey])

  if (!open) return null

  const single = batch.length === 1 ? batch[0] : null
  const anyEvent = batch.some(b => !!b.event_id)
  const title = single ? `Badge unlocked: ${single.name}` : `You unlocked ${batch.length} badges`

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center px-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
    >
      <div className="absolute inset-0 bg-night-900/70 backdrop-blur-sm" />

      <div
        key={seedKey}
        className={`relative w-full max-w-sm max-h-[85dvh] flex flex-col bg-cream-50 border-2 rounded-3xl shadow-elevated text-center overflow-hidden animate-slide-up
          ${anyEvent && single ? 'border-gold-400' : 'border-night-900'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti burst */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0">
          {particles.map((p, i) => (
            <span
              key={i}
              className="animate-confetti absolute block"
              style={{
                left: p.left,
                top: '-8px',
                width: p.size,
                height: p.round ? p.size : p.size * 1.8,
                backgroundColor: p.color,
                borderRadius: p.round ? '9999px' : '2px',
                animationDelay: p.delay,
                ['--confetti-x' as string]: p.x,
                ['--confetti-y' as string]: p.y,
                ['--confetti-r' as string]: p.r,
                ['--confetti-d' as string]: p.d,
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 w-11 h-11 flex items-center justify-center rounded-full text-charcoal-500 hover:text-night-900 hover:bg-cream-100 transition-colors text-xl leading-none"
        >
          ×
        </button>

        <div className="overflow-y-auto px-6 pt-8 pb-4">
          {single ? <SingleBadge badge={single} /> : <BadgeList badges={batch} />}
        </div>

        <div className="px-6 pb-6 pt-2">
          <button type="button" onClick={close} className="btn-primary w-full py-3">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function SingleBadge({ badge }: { badge: BadgeWithEarned }) {
  const isEvent = !!badge.event_id
  const rarity = rarityText(badge)
  return (
    <>
      {isEvent && (
        <p className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full bg-gold-300 border-2 border-night-900 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm animate-rise-in">
          ★ Event exclusive
        </p>
      )}

      {/* Badge plate with rotating rays behind it */}
      <div className="relative mx-auto w-32 h-32 mb-4 flex items-center justify-center">
        <div
          aria-hidden="true"
          className="animate-rays-spin absolute inset-[-28px] opacity-70"
          style={{
            background: `repeating-conic-gradient(${isEvent ? '#f1c12d' : '#ff6e60'} 0deg 11deg, transparent 11deg 30deg)`,
            WebkitMaskImage: 'radial-gradient(circle, transparent 34%, black 40%, black 62%, transparent 70%)',
            maskImage: 'radial-gradient(circle, transparent 34%, black 40%, black 62%, transparent 70%)',
            borderRadius: '9999px',
          }}
        />
        <div
          className={`animate-badge-pop relative w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border-2 bg-night-800 text-cream-50
            ${isEvent ? 'border-gold-400 shadow-sticker-gold' : 'border-night-900 shadow-sticker'}`}
        >
          <BadgeIcon icon={badge.icon} className="w-12 h-12" />
          <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-night-900 flex items-center justify-center text-xs
            ${isEvent ? 'bg-gold-300' : 'bg-sauce-400'}`}>
            {isEvent ? '★' : '✓'}
          </span>
        </div>
      </div>

      <p className={`eyebrow mb-1 animate-rise-in ${isEvent ? 'text-gold-500' : 'text-sauce-500'}`} style={{ animationDelay: '0.15s' }}>
        Badge unlocked!
      </p>
      <h3
        className="font-display uppercase tracking-wide text-3xl text-night-900 mb-2 leading-none animate-rise-in break-words"
        style={{ animationDelay: '0.22s' }}
      >
        {badge.name}
      </h3>

      {badge.description && (
        <p
          className="text-sm text-charcoal-500 leading-relaxed max-w-[240px] mx-auto mb-3 animate-rise-in"
          style={{ animationDelay: '0.3s' }}
        >
          {badge.description}
        </p>
      )}

      {isEvent && badge.event_name && (
        <p className="text-xs font-extrabold uppercase tracking-crowd text-gold-500 mb-3 animate-rise-in" style={{ animationDelay: '0.34s' }}>
          ★ Earned at {badge.event_name}
        </p>
      )}

      {rarity && (
        <div className="flex items-center justify-center gap-2 mb-1 animate-rise-in" style={{ animationDelay: '0.38s' }}>
          {rarity.chip ? (
            <>
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-crowd ${rarity.tierClass}`}>
                {rarity.chip}
              </span>
              <span className="text-[11px] text-charcoal-500 font-bold">{rarity.text}</span>
            </>
          ) : (
            <span className="px-3 py-1 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[11px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
              {rarity.text}
            </span>
          )}
        </div>
      )}
    </>
  )
}

function BadgeList({ badges }: { badges: BadgeWithEarned[] }) {
  return (
    <>
      <p className="eyebrow mb-1 text-sauce-500">Badges unlocked!</p>
      <h3 className="font-display uppercase tracking-wide text-3xl text-night-900 mb-4 leading-none">
        You unlocked {badges.length} badges
      </h3>
      <ul className="space-y-2.5 text-left">
        {badges.map((b, i) => {
          const isEvent = !!b.event_id
          const rarity = rarityText(b)
          return (
            <li
              key={b.id}
              className={`flex items-start gap-3 p-3 rounded-2xl border-2 bg-cream-100 animate-rise-in ${isEvent ? 'border-gold-400' : 'border-night-900/15'}`}
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            >
              <span
                className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border-2 bg-night-800 text-cream-50
                  ${isEvent ? 'border-gold-400' : 'border-night-900'}`}
              >
                <BadgeIcon icon={b.icon} className="w-7 h-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-sm uppercase tracking-crowd text-night-900 leading-tight break-words">{b.name}</p>
                {b.description && (
                  <p className="text-xs text-charcoal-500 leading-snug mt-0.5">{b.description}</p>
                )}
                {isEvent && b.event_name && (
                  <p className="text-[11px] font-extrabold uppercase tracking-crowd text-gold-500 mt-1">★ Earned at {b.event_name}</p>
                )}
                {rarity && (
                  <p className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {rarity.chip && (
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-crowd ${rarity.tierClass}`}>
                        {rarity.chip}
                      </span>
                    )}
                    <span className="text-[11px] text-charcoal-500 font-bold">{rarity.text}</span>
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
